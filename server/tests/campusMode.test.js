import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import ICAL from 'ical.js';
import { db } from '../db/database.js';
import { setLLMProvider, resetLLMProvider } from '../services/llm/client.js';
import {
  isCampusSender,
  matchesCampusKeywords,
  evaluateCampusSenderTrust,
  extractCampusItemsForEmail
} from '../services/campus/campusService.js';
import campusRouter from '../routes/campus.js';
import settingsRouter from '../routes/settings.js';

describe('🎓 Campus Mode & Settings Backend Tests', () => {
  const testUserId = 'usr_campus_' + Date.now();
  const otherUserId = 'usr_campus_other_' + Date.now();
  let app;

  beforeEach(() => {
    process.env.FEATURE_CAMPUS_MODE = 'true';
    process.env.FEATURE_CALENDAR_EXPORT = 'true';

    // Mock Express App
    app = express();
    app.use(cookieParser('mailmind-session-secret'));
    app.use(express.json());
    app.use('/api/campus', campusRouter);
    app.use('/api/settings', settingsRouter);

    // Seed test users
    db.prepare(`
      INSERT OR REPLACE INTO users (id, google_id, email, name)
      VALUES (?, ?, ?, ?)
    `).run(testUserId, 'gid_' + testUserId, `${testUserId}@example.com`, 'Campus Student');

    db.prepare(`
      INSERT OR REPLACE INTO users (id, google_id, email, name)
      VALUES (?, ?, ?, ?)
    `).run(otherUserId, 'gid_' + otherUserId, `${otherUserId}@example.com`, 'Other Student');

    // Seed sessions
    db.prepare(`
      INSERT OR REPLACE INTO sessions (id, user_id, expires_at)
      VALUES (?, ?, ?)
    `).run('sess_camp_a', testUserId, Date.now() + 86400000);

    db.prepare(`
      INSERT OR REPLACE INTO sessions (id, user_id, expires_at)
      VALUES (?, ?, ?)
    `).run('sess_camp_b', otherUserId, Date.now() + 86400000);

    // Seed settings for user A (campus_mode enabled)
    db.prepare(`
      INSERT OR REPLACE INTO user_settings (user_id, timezone, campus_mode, campus_domains_json, reminder_prefs_json)
      VALUES (?, 'Asia/Kolkata', 1, ?, '{"days_before":1,"hours_before":1}')
    `).run(testUserId, JSON.stringify(['college.edu', 'iitd.ac.in']));

    // Seed dummy emails for foreign key
    db.prepare(`
      INSERT OR REPLACE INTO emails (id, user_id, thread_id, sender, recipient, date_received)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('em_camp_1', testUserId, 'th_c1', 'hod@college.edu', `${testUserId}@example.com`, '2026-11-20T10:00:00Z');

    db.prepare(`
      INSERT OR REPLACE INTO emails (id, user_id, thread_id, sender, recipient, date_received)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('em_camp_2', otherUserId, 'th_c2', 'admin@other.edu', `${otherUserId}@example.com`, '2026-11-20T10:00:00Z');
  });

  afterEach(() => {
    resetLLMProvider();
    try {
      db.prepare('DELETE FROM campus_items WHERE user_id IN (?, ?)').run(testUserId, otherUserId);
      db.prepare('DELETE FROM sender_profiles WHERE user_id IN (?, ?)').run(testUserId, otherUserId);
      db.prepare('DELETE FROM user_settings WHERE user_id IN (?, ?)').run(testUserId, otherUserId);
      db.prepare('DELETE FROM emails WHERE user_id IN (?, ?)').run(testUserId, otherUserId);
      db.prepare('DELETE FROM sessions WHERE user_id IN (?, ?)').run(testUserId, otherUserId);
      db.prepare('DELETE FROM users WHERE user_id IN (?, ?)').run(testUserId, otherUserId);
    } catch (e) {}
  });

  it('1. isCampusSender correctly identifies academic domains (.edu, .ac.in, custom)', () => {
    const userDomains = ['bits-pilani.ac.in', 'custom-uni.org'];
    assert.equal(isCampusSender('prof@mit.edu', userDomains), true);
    assert.equal(isCampusSender('hod@iitb.ac.in', userDomains), true);
    assert.equal(isCampusSender('dean@bits-pilani.ac.in', userDomains), true);
    assert.equal(isCampusSender('registrar@custom-uni.org', userDomains), true);

    // Negative cases
    assert.equal(isCampusSender('seller@amazon.in', userDomains), false);
    assert.equal(isCampusSender('random@gmail.com', userDomains), false);
  });

  it('2. matchesCampusKeywords detects academic, examination, placement, and fee vocabulary', () => {
    assert.equal(matchesCampusKeywords('Endsem exam timetable released for CS Department'), true);
    assert.equal(matchesCampusKeywords('Semester tuition fee deadline is next week'), true);
    assert.equal(matchesCampusKeywords('Google placement internship drive registration open'), true);
    assert.equal(matchesCampusKeywords('Lab viva schedule for Data Structures'), true);

    // Negative case
    assert.equal(matchesCampusKeywords('Your order has shipped from Bangalore warehouse'), false);
  });

  it('3. Sender Trust Integration: Sensitive items (Fee / Scholarship) flag unknown senders with verification advisory', () => {
    // 1. Unknown sender requesting fee
    const feeBadgeUnknown = evaluateCampusSenderTrust(testUserId, 'accounts-office@freemail.com', 'fee');
    assert.ok(feeBadgeUnknown.includes('Official portal se verify karo'));

    // 2. Seed trusted sender profile
    db.prepare(`
      INSERT INTO sender_profiles (id, user_id, sender_email, sender_domain, trust_state)
      VALUES (?, ?, ?, ?, 'trusted')
    `).run('prof_trust_1', testUserId, 'accounts@college.edu', 'college.edu');

    // Trusted sender requesting fee
    const feeBadgeTrusted = evaluateCampusSenderTrust(testUserId, 'accounts@college.edu', 'fee');
    assert.equal(feeBadgeTrusted, 'Trusted Campus Source');

    // Normal assignment from trusted sender
    const assignmentBadge = evaluateCampusSenderTrust(testUserId, 'accounts@college.edu', 'assignment');
    assert.equal(assignmentBadge, 'Trusted Campus Source');
  });

  it('4. extractCampusItemsForEmail: Security Invariant - DETAINED emails never undergo extraction', async () => {
    let llmCalled = false;
    setLLMProvider({
      name: 'mock-llm',
      async chatCompletion() {
        llmCalled = true;
        return { content: '{}' };
      }
    });

    const items = await extractCampusItemsForEmail({
      email: { id: 'em_camp_1', subject: 'Exam Schedule', sender: 'prof@college.edu' },
      visibleText: 'Exam on Friday',
      shieldVerdict: 'DETAINED',
      userId: testUserId
    });

    assert.equal(items.length, 0);
    assert.equal(llmCalled, false, 'LLM must never run on DETAINED emails');
  });

  it('5. extractCampusItemsForEmail: Extracts and persists structured milestones into campus_items', async () => {
    setLLMProvider({
      name: 'mock-llm',
      async chatCompletion() {
        return {
          content: JSON.stringify({
            items: [
              {
                is_campus: true,
                kind: 'assignment',
                course: 'CS201',
                title: 'Data Structures Lab 3',
                due_local: '2026-11-28 17:00',
                all_day: false,
                confidence: 'high'
              },
              {
                is_campus: true,
                kind: 'fee',
                course: null,
                title: 'Semester Hostel Fee Installment',
                due_local: '2026-11-30',
                all_day: true,
                confidence: 'high'
              }
            ]
          })
        };
      }
    });

    const items = await extractCampusItemsForEmail({
      email: { id: 'em_camp_1', subject: 'Lab and Fee Notifications', sender: 'hod@college.edu', date_received: '2026-11-20T10:00:00Z' },
      visibleText: 'Submit Data Structures Lab 3 by 28th and Hostel Fee by 30th',
      shieldVerdict: 'CLEARED',
      userId: testUserId
    });

    assert.equal(items.length, 2);
    assert.equal(items[0].course, 'CS201');
    assert.equal(items[0].kind, 'assignment');
    assert.ok(items[0].due_at);

    // Verify row was persisted in SQLite
    const inDb = db.prepare('SELECT * FROM campus_items WHERE user_id = ?').all(testUserId);
    assert.equal(inDb.length, 2);
  });

  it('6. Settings API: GET and PATCH /api/settings handles timezone and campus preferences', async () => {
    // 1. GET settings
    const getRes = await request(app)
      .get('/api/settings')
      .set('Authorization', 'Bearer sess_camp_a');
    assert.equal(getRes.status, 200);
    assert.equal(getRes.body.settings.campus_mode, true);
    assert.equal(getRes.body.settings.timezone, 'Asia/Kolkata');

    // 2. PATCH settings with valid timezone and new campus domain
    const patchRes = await request(app)
      .patch('/api/settings')
      .set('Authorization', 'Bearer sess_camp_a')
      .send({
        timezone: 'Asia/Dubai',
        campus_domains: ['my-campus.edu', 'custom.ac.in'],
        reminder_prefs: { days_before: 2, hours_before: 3 }
      });

    assert.equal(patchRes.status, 200);
    assert.equal(patchRes.body.settings.timezone, 'Asia/Dubai');
    assert.deepEqual(patchRes.body.settings.campus_domains, ['my-campus.edu', 'custom.ac.in']);
    assert.equal(patchRes.body.settings.reminder_prefs.days_before, 2);

    // 3. PATCH with invalid timezone rejected with 400
    const invalidTzRes = await request(app)
      .patch('/api/settings')
      .set('Authorization', 'Bearer sess_camp_a')
      .send({ timezone: 'Invalid/City_Nowhere' });
    assert.equal(invalidTzRes.status, 400);
  });

  it('7. Campus Items API: Multi-user data isolation & IDOR prevention on items and deletion', async () => {
    // Seed item for user A
    db.prepare(`
      INSERT INTO campus_items (id, user_id, email_id, kind, course, title, due_at)
      VALUES (?, ?, ?, 'exam', 'MATH101', 'Calculus Midsem', '2026-11-26T09:00:00Z')
    `).run('camp_item_a', testUserId, 'em_camp_1');

    // 1. User B cannot see User A's campus items
    const listResB = await request(app)
      .get('/api/campus/items')
      .set('Authorization', 'Bearer sess_camp_b');
    assert.equal(listResB.status, 200);
    assert.equal(listResB.body.items.length, 0);

    // 2. User A sees own item
    const listResA = await request(app)
      .get('/api/campus/items')
      .set('Authorization', 'Bearer sess_camp_a');
    assert.equal(listResA.status, 200);
    assert.equal(listResA.body.items.length, 1);
    assert.equal(listResA.body.items[0].title, 'Calculus Midsem');

    // 3. User B attempting to delete User A's item -> 404 (IDOR protection)
    const delResB = await request(app)
      .delete('/api/campus/items/camp_item_a')
      .set('Authorization', 'Bearer sess_camp_b');
    assert.equal(delResB.status, 404);

    // 4. User A deletes own item -> 200
    const delResA = await request(app)
      .delete('/api/campus/items/camp_item_a')
      .set('Authorization', 'Bearer sess_camp_a');
    assert.equal(delResA.status, 200);
  });

  it('8. Campus Calendar Export: GET /api/campus/export.ics returns valid RFC 5545 .ics', async () => {
    // Seed campus milestone
    db.prepare(`
      INSERT INTO campus_items (id, user_id, email_id, kind, course, title, due_at, due_tz)
      VALUES (?, ?, ?, 'assignment', 'CS301', 'Compiler Design Project', '2026-11-27T18:00:00Z', 'Asia/Kolkata')
    `).run('camp_cal_1', testUserId, 'em_camp_1');

    const res = await request(app)
      .get('/api/campus/export.ics')
      .set('Authorization', 'Bearer sess_camp_a');

    assert.equal(res.status, 200);
    assert.ok(res.headers['content-type'].includes('text/calendar'));
    assert.ok(res.text.includes('Compiler Design Project'));

    // Parse with ical.js
    const jcal = ICAL.parse(res.text);
    const comp = new ICAL.Component(jcal);
    assert.equal(comp.name, 'vcalendar');
    assert.ok(comp.getFirstSubcomponent('vevent'));
  });

  it('9. Feature flag: When FEATURE_CAMPUS_MODE=false, campus endpoints return 403', async () => {
    process.env.FEATURE_CAMPUS_MODE = 'false';

    const res = await request(app)
      .get('/api/campus/items')
      .set('Authorization', 'Bearer sess_camp_a');
    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
  });
});
