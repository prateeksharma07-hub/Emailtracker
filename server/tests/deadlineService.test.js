import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { DateTime } from 'luxon';
import { db } from '../db/database.js';
import { setLLMProvider, resetLLMProvider } from '../services/llm/client.js';
import {
  matchesDeadlineKeywords,
  sanitizeTaskTitle,
  parseDateToUtc,
  checkAndIncrementDailyCap,
  resetDailyCapTracker,
  extractDeadlinesForEmail,
  detectClashes,
  annotateTasksWithClashes
} from '../services/deadlines/deadlineService.js';

describe('📅 Deadline Extraction & Timezone Service Tests', () => {
  const testUserId = 'usr_deadline_test_' + Date.now();
  const testUserTz = 'Asia/Kolkata';

  beforeEach(() => {
    resetDailyCapTracker();
    process.env.FEATURE_CALENDAR_EXPORT = 'true';
    process.env.DEADLINE_DAILY_CAP = '60';

    // Seed test user & settings
    db.prepare(`
      INSERT OR REPLACE INTO users (id, google_id, email, name)
      VALUES (?, ?, ?, ?)
    `).run(testUserId, 'gid_' + testUserId, `${testUserId}@example.com`, 'Deadline Tester');

    db.prepare(`
      INSERT OR REPLACE INTO user_settings (user_id, timezone, campus_mode)
      VALUES (?, ?, 0)
    `).run(testUserId, testUserTz);
  });

  afterEach(() => {
    resetLLMProvider();
    try {
      db.prepare('DELETE FROM tasks WHERE user_id = ?').run(testUserId);
      db.prepare('DELETE FROM emails WHERE user_id = ?').run(testUserId);
      db.prepare('DELETE FROM user_settings WHERE user_id = ?').run(testUserId);
      db.prepare('DELETE FROM users WHERE id = ?').run(testUserId);
    } catch (e) {}
  });

  it('1. Keyword prefilter correctly identifies deadline language and filters non-deadline text', () => {
    assert.equal(matchesDeadlineKeywords('Please submit the project by tomorrow evening'), true);
    assert.equal(matchesDeadlineKeywords('Final exam scheduled for Friday'), true);
    assert.equal(matchesDeadlineKeywords('Fees jama karo before 30th November'), true);
    assert.equal(matchesDeadlineKeywords('Meeting link for sync call'), true);
    assert.equal(matchesDeadlineKeywords('Invoice payment due next week'), true);

    // Negative cases
    assert.equal(matchesDeadlineKeywords('Just checking in, how was your weekend?'), false);
    assert.equal(matchesDeadlineKeywords('Here are some photos from the conference'), false);
    assert.equal(matchesDeadlineKeywords(''), false);
    assert.equal(matchesDeadlineKeywords(null), false);
  });

  it('2. sanitizeTaskTitle cleans control characters, excessive whitespace, and caps length at 120 chars', () => {
    const raw = 'Submit  \x00\x08 Assignment 1 \t\n  with all appendices and documentation ';
    const cleaned = sanitizeTaskTitle(raw);
    assert.equal(cleaned, 'Submit Assignment 1 with all appendices and documentation');

    const longTitle = 'A'.repeat(200);
    const capped = sanitizeTaskTitle(longTitle);
    assert.equal(capped.length, 120);

    assert.equal(sanitizeTaskTitle(null), 'Follow up on item');
  });

  it('3. parseDateToUtc handles exact ISO, format variants, and user timezone conversions', () => {
    const refDate = '2026-11-20T10:00:00.000Z';

    // Specific time in Asia/Kolkata (UTC+5:30)
    // 2026-11-25 15:30 IST => 2026-11-25 10:00:00 UTC
    const parsedIso = parseDateToUtc('2026-11-25 15:30', refDate, 'Asia/Kolkata', false);
    assert.ok(parsedIso);
    const dt = DateTime.fromISO(parsedIso, { zone: 'utc' });
    assert.equal(dt.year, 2026);
    assert.equal(dt.month, 11);
    assert.equal(dt.day, 25);
    assert.equal(dt.hour, 10);
    assert.equal(dt.minute, 0);

    // Date-only format
    const parsedDateOnly = parseDateToUtc('2026-11-30', refDate, 'Asia/Kolkata', true);
    assert.ok(parsedDateOnly);

    // Relative strings: tomorrow
    const parsedTomorrow = parseDateToUtc('tomorrow', refDate, 'Asia/Kolkata', true);
    assert.ok(parsedTomorrow);
    const dtTomorrow = DateTime.fromISO(parsedTomorrow, { zone: 'Asia/Kolkata' });
    assert.equal(dtTomorrow.day, 21);
  });

  it('4. parseDateToUtc enforces safety thresholds: rejects past dates and distant future dates', () => {
    const refDate = '2026-11-20T10:00:00.000Z';

    // 5 days before received date -> rejected
    const pastDate = parseDateToUtc('2026-11-14 10:00', refDate, 'Asia/Kolkata', false);
    assert.equal(pastDate, null);

    // 3 years into the future -> rejected
    const farFuture = parseDateToUtc('2029-12-01 10:00', refDate, 'Asia/Kolkata', false);
    assert.equal(farFuture, null);

    // Unparseable nonsense -> rejected (never hallucinated)
    assert.equal(parseDateToUtc('whenever you feel like it', refDate, 'Asia/Kolkata', false), null);
    assert.equal(parseDateToUtc('', refDate, 'Asia/Kolkata', false), null);
    assert.equal(parseDateToUtc('null', refDate, 'Asia/Kolkata', false), null);
  });

  it('5. Daily cap tracker limits extractions per user per calendar day', () => {
    process.env.DEADLINE_DAILY_CAP = '2';
    assert.equal(checkAndIncrementDailyCap(testUserId), true);
    assert.equal(checkAndIncrementDailyCap(testUserId), true);
    assert.equal(checkAndIncrementDailyCap(testUserId), false); // 3rd exceeds cap
  });

  it('6. Security Invariant: DETAINED emails strictly return empty tasks without invoking LLM', async () => {
    let llmCalled = false;
    setLLMProvider({
      name: 'mock-llm',
      async chatCompletion() {
        llmCalled = true;
        return { content: JSON.stringify({ items: [{ title: 'Adversarial Task', due_local: '2026-11-25' }] }) };
      }
    });

    const tasks = await extractDeadlinesForEmail({
      email: { subject: 'Urgent task due today', body_text: 'Submit report now', date_received: '2026-11-20T10:00:00Z' },
      visibleText: 'Submit report now',
      shieldVerdict: 'DETAINED',
      userId: testUserId
    });

    assert.equal(tasks.length, 0);
    assert.equal(llmCalled, false, 'LLM must never be invoked for DETAINED emails');
  });

  it('7. SUSPICIOUS emails set due_source_flagged = 1, and LLM output is bounded to max 5 items', async () => {
    setLLMProvider({
      name: 'mock-llm',
      async chatCompletion() {
        return {
          content: JSON.stringify({
            items: [
              { title: 'Project Part 1', due_local: '2026-11-25 18:00', all_day: false, confidence: 'high', deadline_kind: 'assignment' },
              { title: 'Project Part 2', due_local: '2026-11-26 18:00', all_day: false, confidence: 'high', deadline_kind: 'assignment' },
              { title: 'Project Part 3', due_local: '2026-11-27 18:00', all_day: false, confidence: 'high', deadline_kind: 'assignment' },
              { title: 'Project Part 4', due_local: '2026-11-28 18:00', all_day: false, confidence: 'high', deadline_kind: 'assignment' },
              { title: 'Project Part 5', due_local: '2026-11-29 18:00', all_day: false, confidence: 'high', deadline_kind: 'assignment' },
              { title: 'Overflow Item 6', due_local: '2026-11-30 18:00', all_day: false, confidence: 'low', deadline_kind: 'assignment' }
            ]
          })
        };
      }
    });

    const tasks = await extractDeadlinesForEmail({
      email: { subject: 'Assignment deadlines announced', body_text: 'Please submit assignments by deadline', date_received: '2026-11-20T10:00:00Z' },
      visibleText: 'Please submit assignments by deadline',
      shieldVerdict: 'SUSPICIOUS',
      userId: testUserId
    });

    assert.equal(tasks.length, 5, 'Output must be capped at 5 items');
    assert.equal(tasks[0].due_source_flagged, 1, 'Source flagged must be 1 for SUSPICIOUS email');
    assert.equal(tasks[0].deadline_kind, 'assignment');
  });

  it('8. Feature flag: When FEATURE_CALENDAR_EXPORT=false, deadline extraction is disabled', async () => {
    process.env.FEATURE_CALENDAR_EXPORT = 'false';

    let llmCalled = false;
    setLLMProvider({
      name: 'mock-llm',
      async chatCompletion() {
        llmCalled = true;
        return { content: '{}' };
      }
    });

    const tasks = await extractDeadlinesForEmail({
      email: { subject: 'Exam schedule released', body_text: 'Exam is due on Friday', date_received: '2026-11-20T10:00:00Z' },
      visibleText: 'Exam is due on Friday',
      shieldVerdict: 'CLEARED',
      userId: testUserId
    });

    assert.equal(tasks.length, 0);
    assert.equal(llmCalled, false);
  });

  it('9. Schedule Clash Detection catches +-60 min overlaps and same-day events', () => {
    const baseTime = '2026-11-25T10:00:00.000Z'; // 10:00 UTC

    // Insert dummy email for FK constraint
    db.prepare(`
      INSERT OR REPLACE INTO emails (id, user_id, thread_id, sender, recipient, date_received)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('em_test_fk', testUserId, 'th_1', 'boss@test.com', 'user@test.com', '2026-11-20T10:00:00Z');

    // Seed task A
    db.prepare(`
      INSERT INTO tasks (id, user_id, email_id, task_title, due_at, due_all_day, due_tz, is_completed)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0)
    `).run('task_a', testUserId, 'em_test_fk', 'Client Presentation', baseTime, 0, testUserTz);

    // Overlapping task B (+30 min => clash)
    const clash30Min = '2026-11-25T10:30:00.000Z';
    const clashes1 = detectClashes(testUserId, clash30Min, false);
    assert.equal(clashes1.length, 1);
    assert.equal(clashes1[0].id, 'task_a');

    // Non-overlapping task C (+150 min => no clash with either A or B)
    const nonClash150Min = '2026-11-25T12:30:00.000Z';
    const clashes2 = detectClashes(testUserId, nonClash150Min, false);
    assert.equal(clashes2.length, 0);

    // Test annotateTasksWithClashes helper
    const testList = [
      { id: 'task_a', task_title: 'Task A', due_at: baseTime, due_all_day: 0, is_completed: 0 },
      { id: 'task_b', task_title: 'Task B', due_at: clash30Min, due_all_day: 0, is_completed: 0 },
      { id: 'task_c', task_title: 'Task C', due_at: nonClash150Min, due_all_day: 0, is_completed: 0 }
    ];

    const annotated = annotateTasksWithClashes(testList, testUserTz);
    assert.equal(annotated[0].is_clashing, true);
    assert.equal(annotated[1].is_clashing, true);
    assert.equal(annotated[2].is_clashing, false);
  });
});
