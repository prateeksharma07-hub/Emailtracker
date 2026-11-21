import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../index.js';
import { db } from '../db/database.js';

describe('🔒 Multi-User Data Isolation & IDOR Prevention Tests', () => {
  const userA = {
    id: 'usr_test_alpha_' + Date.now(),
    google_id: 'gid_alpha_' + Date.now(),
    email: 'alpha_tester@example.com',
    name: 'Alpha Tester',
    sessionToken: 'sess_token_alpha_' + Date.now()
  };

  const userB = {
    id: 'usr_test_beta_' + Date.now(),
    google_id: 'gid_beta_' + Date.now(),
    email: 'beta_tester@example.com',
    name: 'Beta Tester',
    sessionToken: 'sess_token_beta_' + Date.now()
  };

  const emailAId = 'eml_alpha_' + Date.now();
  const emailBId = 'eml_beta_' + Date.now();
  const taskAId = 'tsk_alpha_' + Date.now();
  const taskBId = 'tsk_beta_' + Date.now();
  const draftAId = 'dft_alpha_' + Date.now();
  const draftBId = 'dft_beta_' + Date.now();
  const scanAId = 'scn_alpha_' + Date.now();

  before(() => {
    // 1. Seed Users
    const insertUser = db.prepare(`
      INSERT INTO users (id, google_id, email, name, token_expiry)
      VALUES (?, ?, ?, ?, ?)
    `);
    insertUser.run(userA.id, userA.google_id, userA.email, userA.name, Date.now() + 86400000);
    insertUser.run(userB.id, userB.google_id, userB.email, userB.name, Date.now() + 86400000);

    // 2. Seed Sessions (7-day TTL)
    const insertSession = db.prepare(`
      INSERT INTO sessions (id, user_id, expires_at)
      VALUES (?, ?, ?)
    `);
    insertSession.run(userA.sessionToken, userA.id, Date.now() + 7 * 86400000);
    insertSession.run(userB.sessionToken, userB.id, Date.now() + 7 * 86400000);

    // 3. Seed Emails
    const now = new Date().toISOString();
    const insertEmail = db.prepare(`
      INSERT INTO emails (id, user_id, thread_id, account_id, sender, recipient, subject, body_text, snippet, date_received, shield_verdict)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertEmail.run(emailAId, userA.id, 'th_a', null, 'sender_a@example.com', userA.email, 'Confidential Project Alpha', 'Top secret Alpha details', 'Top secret Alpha', now, 'CLEARED');
    insertEmail.run(emailBId, userB.id, 'th_b', null, 'sender_b@example.com', userB.email, 'Confidential Project Beta', 'Top secret Beta details', 'Top secret Beta', now, 'CLEARED');

    // 4. Seed Tasks
    const insertTask = db.prepare(`
      INSERT INTO tasks (id, user_id, email_id, task_title)
      VALUES (?, ?, ?, ?)
    `);
    insertTask.run(taskAId, userA.id, emailAId, 'Review Alpha NDA');
    insertTask.run(taskBId, userB.id, emailBId, 'Review Beta Budget');

    // 5. Seed Drafts
    const insertDraft = db.prepare(`
      INSERT INTO drafts (id, user_id, email_id, to_address, subject, reply_body, status)
      VALUES (?, ?, ?, ?, ?, ?, 'PENDING_APPROVAL')
    `);
    insertDraft.run(draftAId, userA.id, emailAId, 'sender_a@example.com', 'Re: Alpha', 'Draft reply for Alpha');
    insertDraft.run(draftBId, userB.id, emailBId, 'sender_b@example.com', 'Re: Beta', 'Draft reply for Beta');

    // 6. Seed Shield Scan
    db.prepare(`
      INSERT INTO shield_scans (id, user_id, email_id, verdict, threat_score, layers_json, hidden_segments_json, visible_text, ai_text)
      VALUES (?, ?, ?, 'CLEARED', 0, '[]', '[]', 'Top secret Alpha details', 'Top secret Alpha details')
    `).run(scanAId, userA.id, emailAId);
  });

  after(() => {
    // Cleanup seeded test records
    db.prepare('DELETE FROM shield_scans WHERE user_id IN (?, ?)').run(userA.id, userB.id);
    db.prepare('DELETE FROM drafts WHERE user_id IN (?, ?)').run(userA.id, userB.id);
    db.prepare('DELETE FROM tasks WHERE user_id IN (?, ?)').run(userA.id, userB.id);
    db.prepare('DELETE FROM emails WHERE user_id IN (?, ?)').run(userA.id, userB.id);
    db.prepare('DELETE FROM sessions WHERE user_id IN (?, ?)').run(userA.id, userB.id);
    db.prepare('DELETE FROM users WHERE id IN (?, ?)').run(userA.id, userB.id);
  });

  test('1. Unauthenticated request to /api/emails is rejected with 401', async () => {
    const res = await request(app).get('/api/emails');
    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
  });

  test('2. User A cannot see User B\'s emails in /api/emails list', async () => {
    const res = await request(app)
      .get('/api/emails')
      .set('Cookie', `mailmind_session=${userA.sessionToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    const emails = res.body.emails;

    const hasA = emails.some(e => e.id === emailAId);
    const hasB = emails.some(e => e.id === emailBId);

    assert.equal(hasA, true, 'User A should see their own email');
    assert.equal(hasB, false, 'User A MUST NEVER see User B\'s email');
  });

  test('3. User B cannot see User A\'s emails in /api/emails list', async () => {
    const res = await request(app)
      .get('/api/emails')
      .set('Cookie', `mailmind_session=${userB.sessionToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    const emails = res.body.emails;

    const hasA = emails.some(e => e.id === emailAId);
    const hasB = emails.some(e => e.id === emailBId);

    assert.equal(hasB, true, 'User B should see their own email');
    assert.equal(hasA, false, 'User B MUST NEVER see User A\'s email');
  });

  test('4. IDOR Protection: User B requesting User A\'s email directly returns 404', async () => {
    const res = await request(app)
      .get(`/api/emails/${emailAId}`)
      .set('Cookie', `mailmind_session=${userB.sessionToken}`);

    assert.equal(res.status, 404, 'Direct access to other user email must return 404');
    assert.equal(res.body.success, false);
  });

  test('5. IDOR Protection: User B modifying User A\'s email read status returns 404', async () => {
    const res = await request(app)
      .patch(`/api/emails/${emailAId}/read`)
      .set('Cookie', `mailmind_session=${userB.sessionToken}`)
      .send({ is_read: 1 });

    assert.equal(res.status, 404);
  });

  test('6. IDOR Protection: User B deleting User A\'s email returns 404', async () => {
    const res = await request(app)
      .delete(`/api/emails/${emailAId}`)
      .set('Cookie', `mailmind_session=${userB.sessionToken}`);

    assert.equal(res.status, 404);
    // Verify email A is still safe in DB
    const stillExists = db.prepare('SELECT id FROM emails WHERE id = ?').get(emailAId);
    assert.ok(stillExists, 'Email A must not have been deleted');
  });

  test('7. Task Isolation: User B cannot view User A\'s tasks', async () => {
    const res = await request(app)
      .get('/api/tasks')
      .set('Cookie', `mailmind_session=${userB.sessionToken}`);

    assert.equal(res.status, 200);
    const tasks = res.body.tasks;
    assert.equal(tasks.some(t => t.id === taskAId), false, 'User A task must not be visible to User B');
  });

  test('8. Task IDOR: User B patching User A\'s task returns 404', async () => {
    const res = await request(app)
      .patch(`/api/tasks/${taskAId}`)
      .set('Cookie', `mailmind_session=${userB.sessionToken}`)
      .send({ is_completed: 1 });

    assert.equal(res.status, 404);
  });

  test('9. Draft Isolation & IDOR: User B cannot access User A\'s draft', async () => {
    const listRes = await request(app)
      .get('/api/drafts')
      .set('Cookie', `mailmind_session=${userB.sessionToken}`);

    assert.equal(listRes.status, 200);
    assert.equal(listRes.body.drafts.some(d => d.id === draftAId), false);

    const getRes = await request(app)
      .get(`/api/drafts/${draftAId}`)
      .set('Cookie', `mailmind_session=${userB.sessionToken}`);

    assert.equal(getRes.status, 404);

    const putRes = await request(app)
      .put(`/api/drafts/${draftAId}`)
      .set('Cookie', `mailmind_session=${userB.sessionToken}`)
      .send({ reply_body: 'Hacked draft' });

    assert.equal(putRes.status, 404);
  });

  test('10. Shield X-Ray IDOR: User B cannot access User A\'s shield scan data', async () => {
    const res = await request(app)
      .get(`/api/shield/emails/${emailAId}`)
      .set('Cookie', `mailmind_session=${userB.sessionToken}`);

    assert.equal(res.status, 404, 'Shield scan for other user must return 404');
  });
});
