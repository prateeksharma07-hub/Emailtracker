import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import ICAL from 'ical.js';
import express from 'express';
import cookieParser from 'cookie-parser';
import { db } from '../db/database.js';
import calendarRouter from '../routes/calendar.js';
import {
  foldLine,
  escapeIcsText,
  buildVEvent,
  buildIcsCalendar,
  generateGoogleCalendarUrl
} from '../services/calendar/icsBuilder.js';

describe('📅 RFC 5545 ICS Builder & Calendar API Tests', () => {
  const testUserId = 'usr_cal_' + Date.now();
  const otherUserId = 'usr_cal_other_' + Date.now();
  let app;

  beforeEach(() => {
    process.env.FEATURE_CALENDAR_EXPORT = 'true';

    // Mock Express App for route testing
    app = express();
    app.use(cookieParser('mailmind-session-secret'));
    app.use(express.json());
    app.use('/api/calendar', calendarRouter);

    // Seed test users
    db.prepare(`
      INSERT OR REPLACE INTO users (id, google_id, email, name)
      VALUES (?, ?, ?, ?)
    `).run(testUserId, 'gid_' + testUserId, `${testUserId}@example.com`, 'Calendar User');

    db.prepare(`
      INSERT OR REPLACE INTO users (id, google_id, email, name)
      VALUES (?, ?, ?, ?)
    `).run(otherUserId, 'gid_' + otherUserId, `${otherUserId}@example.com`, 'Other User');

    // Seed active sessions
    db.prepare(`
      INSERT OR REPLACE INTO sessions (id, user_id, expires_at)
      VALUES (?, ?, ?)
    `).run('sess_user_a', testUserId, Date.now() + 86400000);

    db.prepare(`
      INSERT OR REPLACE INTO sessions (id, user_id, expires_at)
      VALUES (?, ?, ?)
    `).run('sess_user_b', otherUserId, Date.now() + 86400000);

    // Seed dummy emails for foreign key
    db.prepare(`
      INSERT OR REPLACE INTO emails (id, user_id, thread_id, sender, recipient, date_received)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('em_cal_1', testUserId, 'th_cal_1', 'prof@college.edu', `${testUserId}@example.com`, '2026-11-20T10:00:00Z');

    db.prepare(`
      INSERT OR REPLACE INTO emails (id, user_id, thread_id, sender, recipient, date_received)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('em_cal_2', otherUserId, 'th_cal_2', 'dean@college.edu', `${otherUserId}@example.com`, '2026-11-20T10:00:00Z');
  });

  afterEach(() => {
    try {
      db.prepare('DELETE FROM tasks WHERE user_id IN (?, ?)').run(testUserId, otherUserId);
      db.prepare('DELETE FROM emails WHERE user_id IN (?, ?)').run(testUserId, otherUserId);
      db.prepare('DELETE FROM sessions WHERE user_id IN (?, ?)').run(testUserId, otherUserId);
      db.prepare('DELETE FROM users WHERE id IN (?, ?)').run(testUserId, otherUserId);
    } catch (e) {}
  });

  it('1. foldLine folds lines longer than 75 octets with CRLF and continuation space', () => {
    const longAscii = 'DESCRIPTION:' + 'A'.repeat(100);
    const folded = foldLine(longAscii);

    const lines = folded.split('\r\n');
    assert.ok(lines.length >= 2, 'Line must be folded into at least 2 lines');
    assert.ok(Buffer.byteLength(lines[0], 'utf8') <= 75, 'First line octets <= 75');
    assert.ok(lines[1].startsWith(' '), 'Continuation line must start with space');
    assert.ok(Buffer.byteLength(lines[1], 'utf8') <= 75, 'Continuation line octets <= 75');
  });

  it('2. foldLine cleanly folds Hindi / multibyte UTF-8 without corrupting or splitting code points', () => {
    // 3-byte Hindi Devanagari string
    const hindiText = 'SUMMARY:कृपया अपनी अंतिम परीक्षा की तैयारी करें और असाइनमेंट समय पर जमा करें';
    const folded = foldLine(hindiText);

    const lines = folded.split('\r\n');
    for (const l of lines) {
      assert.ok(Buffer.byteLength(l, 'utf8') <= 75, 'Each folded line must be <= 75 octets');
    }

    // Reconstruct without the folding prefix space to verify zero data loss
    const reconstructed = lines[0] + lines.slice(1).map(l => l.slice(1)).join('');
    assert.equal(reconstructed, hindiText, 'Multibyte characters must remain intact without corruption');
  });

  it('3. escapeIcsText properly escapes semicolons, commas, backslashes, and newlines per RFC 5545', () => {
    const raw = 'Meeting with Boss, VP; bring report \\ notes\nSecond line';
    const escaped = escapeIcsText(raw);
    assert.equal(escaped, 'Meeting with Boss\\, VP\\; bring report \\\\ notes\\nSecond line');
  });

  it('4. Header Injection Defense: Control characters in summary or description are neutralized', () => {
    const malicious = 'Normal Title\r\nTRIGGER:-PT0M\r\nACTION:EMAIL\r\nATTENDEE:attacker@hack.com';
    const sanitized = escapeIcsText(malicious);
    assert.ok(!sanitized.includes('\r'), 'Must not contain raw carriage returns');
    assert.ok(sanitized.includes('\\n'), 'Newlines must be escaped as literal \\n');
  });

  it('5. buildIcsCalendar outputs RFC 5545 compliant calendar parsed successfully by ical.js', () => {
    const testTask = {
      id: 'task_ics_test',
      task_title: 'Math Assignment 4',
      due_at: '2026-11-28T14:30:00.000Z',
      due_tz: 'Asia/Kolkata',
      due_all_day: 0,
      deadline_kind: 'assignment',
      due_source_flagged: 0,
      email_subject: 'Math Homework Due Soon',
      email_sender: 'prof@college.edu'
    };

    const icsString = buildIcsCalendar([testTask]);
    assert.ok(icsString.includes('BEGIN:VCALENDAR'));
    assert.ok(icsString.includes('BEGIN:VEVENT'));
    assert.ok(icsString.includes('UID:task-task_ics_test@mailmind.local'));
    assert.ok(icsString.includes('SUMMARY:Math Assignment 4'));
    assert.ok(icsString.includes('BEGIN:VALARM'));
    assert.ok(icsString.includes('END:VCALENDAR'));

    // Validate using RFC 5545 parser ical.js
    const jcalData = ICAL.parse(icsString);
    const comp = new ICAL.Component(jcalData);
    assert.equal(comp.name, 'vcalendar');

    const vevent = comp.getFirstSubcomponent('vevent');
    assert.ok(vevent, 'Must contain a VEVENT component');
    assert.equal(vevent.getFirstPropertyValue('summary'), 'Math Assignment 4');

    const alarms = vevent.getAllSubcomponents('valarm');
    assert.ok(alarms.length >= 1, 'Must contain reminder alarms');
  });

  it('6. All-day events emit VALUE=DATE attributes for both DTSTART and DTEND', () => {
    const allDayTask = {
      id: 'task_allday',
      task_title: 'Hackathon Submission Day',
      due_at: '2026-11-30T00:00:00.000Z',
      due_tz: 'Asia/Kolkata',
      due_all_day: 1,
      deadline_kind: 'submission',
      due_source_flagged: 0
    };

    const icsString = buildIcsCalendar([allDayTask]);
    assert.ok(icsString.includes('DTSTART;VALUE=DATE:20261130'));
    assert.ok(icsString.includes('DTEND;VALUE=DATE:20261201')); // Exclusive next day
  });

  it('7. generateGoogleCalendarUrl creates a well-formed zero-scope calendar URL', () => {
    const url = generateGoogleCalendarUrl({
      title: 'Physics Lab Viva',
      dueAt: '2026-11-25T09:00:00.000Z',
      allDay: false,
      dueTz: 'Asia/Kolkata',
      details: 'Bring lab notebook and ID card'
    });

    assert.ok(url.startsWith('https://calendar.google.com/calendar/render?'));
    assert.ok(url.includes('action=TEMPLATE'));
    assert.ok(url.includes('Physics+Lab+Viva') || url.includes('Physics%20Lab%20Viva'));
    assert.ok(url.includes('20261125T090000Z'));
  });

  it('8. Route Security: GET /api/calendar/task/:id.ics enforces authentication and user isolation', async () => {
    // Insert task for user A
    db.prepare(`
      INSERT INTO tasks (id, user_id, email_id, task_title, due_at, due_all_day, due_tz)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('task_user_a', testUserId, 'em_cal_1', 'Confidential Exam', '2026-11-26T10:00:00.000Z', 0, 'Asia/Kolkata');

    // 1. Unauthenticated -> 401
    const unauthRes = await request(app).get('/api/calendar/task/task_user_a.ics');
    assert.equal(unauthRes.status, 401);

    // 2. User B accessing User A task -> 404 (IDOR protection)
    const idorRes = await request(app)
      .get('/api/calendar/task/task_user_a.ics')
      .set('Authorization', 'Bearer sess_user_b');
    assert.equal(idorRes.status, 404);

    // 3. User A accessing own task -> 200 with text/calendar
    const validRes = await request(app)
      .get('/api/calendar/task/task_user_a.ics')
      .set('Authorization', 'Bearer sess_user_a');
    assert.equal(validRes.status, 200);
    assert.ok(validRes.headers['content-type'].includes('text/calendar'));
    assert.ok(validRes.text.includes('BEGIN:VCALENDAR'));
    assert.ok(validRes.text.includes('Confidential Exam'));
  });

  it('9. Batch Export: GET /api/calendar/export.ics excludes flagged sources when includeFlagged=false', async () => {
    // Task 1: Cleared source
    db.prepare(`
      INSERT INTO tasks (id, user_id, email_id, task_title, due_at, due_source_flagged, is_completed)
      VALUES (?, ?, ?, ?, ?, 0, 0)
    `).run('t_clean', testUserId, 'em_cal_1', 'Clean Assignment', '2026-11-29T10:00:00.000Z');

    // Task 2: Flagged source
    db.prepare(`
      INSERT INTO tasks (id, user_id, email_id, task_title, due_at, due_source_flagged, is_completed)
      VALUES (?, ?, ?, ?, ?, 1, 0)
    `).run('t_flagged', testUserId, 'em_cal_1', 'Flagged Phishing Homework', '2026-11-29T11:00:00.000Z');

    // Default export (includeFlagged=false)
    const resDefault = await request(app)
      .get('/api/calendar/export.ics?scope=all')
      .set('Authorization', 'Bearer sess_user_a');
    assert.equal(resDefault.status, 200);
    assert.ok(resDefault.text.includes('Clean Assignment'));
    assert.ok(!resDefault.text.includes('Flagged Phishing Homework'));

    // Export with includeFlagged=true
    const resInclude = await request(app)
      .get('/api/calendar/export.ics?scope=all&includeFlagged=true')
      .set('Authorization', 'Bearer sess_user_a');
    assert.equal(resInclude.status, 200);
    assert.ok(resInclude.text.includes('Clean Assignment'));
    assert.ok(resInclude.text.includes('Flagged Phishing Homework'));
  });

  it('10. Feature flag: FEATURE_CALENDAR_EXPORT=false disables calendar endpoints with 403', async () => {
    process.env.FEATURE_CALENDAR_EXPORT = 'false';

    const res = await request(app)
      .get('/api/calendar/export.ics')
      .set('Authorization', 'Bearer sess_user_a');
    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
  });
});
