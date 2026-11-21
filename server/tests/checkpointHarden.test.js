import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../index.js';
import { db } from '../db/database.js';

describe('🛡️ Checkpoint Hardening & Unscanned Fallback Tests', () => {
  const userA = {
    id: 'usr_chk_alpha_' + Date.now(),
    google_id: 'gid_chk_alpha_' + Date.now(),
    email: 'alpha_chk@example.com',
    name: 'Alpha Checkpoint User',
    sessionToken: 'sess_chk_alpha_' + Date.now()
  };

  const userB = {
    id: 'usr_chk_beta_' + Date.now(),
    google_id: 'gid_chk_beta_' + Date.now(),
    email: 'beta_chk@example.com',
    name: 'Beta Checkpoint User',
    sessionToken: 'sess_chk_beta_' + Date.now()
  };

  const unscannedEmailId = 'eml_unscanned_' + Date.now();
  const scannedEmailId = 'eml_scanned_' + Date.now();
  const emailBId = 'eml_beta_chk_' + Date.now();

  before(() => {
    // 1. Seed Users
    const insertUser = db.prepare(`
      INSERT INTO users (id, google_id, email, name, token_expiry)
      VALUES (?, ?, ?, ?, ?)
    `);
    insertUser.run(userA.id, userA.google_id, userA.email, userA.name, Date.now() + 86400000);
    insertUser.run(userB.id, userB.google_id, userB.email, userB.name, Date.now() + 86400000);

    // 2. Seed Sessions
    const insertSession = db.prepare(`
      INSERT INTO sessions (id, user_id, expires_at)
      VALUES (?, ?, ?)
    `);
    insertSession.run(userA.sessionToken, userA.id, Date.now() + 7 * 86400000);
    insertSession.run(userB.sessionToken, userB.id, Date.now() + 7 * 86400000);

    // 3. Seed Emails
    const now = new Date().toISOString();
    const insertEmail = db.prepare(`
      INSERT INTO emails (id, user_id, thread_id, sender, recipient, subject, body_text, snippet, date_received, shield_verdict)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    // Unscanned email has NO shield_scans row and shield_verdict = 'UNSCANNED'
    insertEmail.run(unscannedEmailId, userA.id, 'th_u', 'newcomer@partner.org', userA.email, 'Unscanned Project Brief', 'Please review the attached brief', 'Please review', now, 'UNSCANNED');
    insertEmail.run(scannedEmailId, userA.id, 'th_s', 'trusted@corp.com', userA.email, 'Scanned Financial Report', 'Q3 results overview', 'Q3 results', now, 'CLEARED');
    insertEmail.run(emailBId, userB.id, 'th_b', 'sender@other.com', userB.email, 'Beta Confidential Document', 'Confidential for B only', 'Confidential', now, 'CLEARED');

    // 4. Seed Scan for scannedEmailId
    db.prepare(`
      INSERT INTO shield_scans (id, user_id, email_id, verdict, threat_score, layers_json, hidden_segments_json, visible_text, ai_text, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(
      'scan_scanned_' + Date.now(),
      userA.id,
      scannedEmailId,
      'CLEARED',
      0,
      JSON.stringify([
        { name: 'HTML & Structure', score: 0, status: 'CLEARED', findings: ['Clean markup'] },
        { name: 'Override Patterns', score: 0, status: 'CLEARED', findings: ['No override language'] },
        { name: 'Groq Prompt Guard', score: 0, status: 'CLEARED', findings: ['Clean text'] },
        { 
          name: 'Sender Trust & Identity Memory', 
          score: 0, 
          status: 'CLEARED', 
          findings: [
            { signal: 'first_time_sender', reason: 'First-time sender: No prior bilateral correspondence.' }
          ] 
        }
      ]),
      JSON.stringify([]),
      'Q3 results overview',
      'Q3 results overview'
    );
  });

  after(() => {
    // Cleanup seeded data
    db.prepare('DELETE FROM shield_scans WHERE user_id IN (?, ?)').run(userA.id, userB.id);
    db.prepare('DELETE FROM emails WHERE user_id IN (?, ?)').run(userA.id, userB.id);
    db.prepare('DELETE FROM sessions WHERE user_id IN (?, ?)').run(userA.id, userB.id);
    db.prepare('DELETE FROM users WHERE id IN (?, ?)').run(userA.id, userB.id);
  });

  test('1. Unauthenticated request to /api/shield/emails/:id is rejected with 401', async () => {
    const res = await request(app).get(`/api/shield/emails/${unscannedEmailId}`);
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.success, false);
  });

  test('2. GET /api/shield/emails/:id on unscanned email returns 200 with safe UNSCANNED shape (no 500 error)', async () => {
    // Temporarily delete any scan row if generated
    db.prepare('DELETE FROM shield_scans WHERE email_id = ?').run(unscannedEmailId);

    const res = await request(app)
      .get(`/api/shield/emails/${unscannedEmailId}`)
      .set('Authorization', `Bearer ${userA.sessionToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.scan);
    assert.strictEqual(res.body.scan.emailId, unscannedEmailId);
    assert.strictEqual(res.body.scan.subject, 'Unscanned Project Brief');
    assert.ok(Array.isArray(res.body.scan.layers));
    assert.ok(Array.isArray(res.body.scan.hiddenSegments));
    assert.strictEqual(typeof res.body.scan.threatScore, 'number');
  });

  test('3. Scanned email with Layer 4 findings object returns structured findings safely', async () => {
    const res = await request(app)
      .get(`/api/shield/emails/${scannedEmailId}`)
      .set('Authorization', `Bearer ${userA.sessionToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.scan.verdict, 'CLEARED');
    assert.strictEqual(res.body.scan.threatScore, 0);
    assert.strictEqual(res.body.scan.layers.length, 4);

    const layer4 = res.body.scan.layers[3];
    assert.strictEqual(layer4.name, 'Sender Trust & Identity Memory');
    assert.ok(Array.isArray(layer4.findings));
    assert.strictEqual(typeof layer4.findings[0], 'object');
    assert.strictEqual(layer4.findings[0].signal, 'first_time_sender');
  });

  test('4. IDOR Protection: User B requesting User A unscanned email returns 404', async () => {
    const res = await request(app)
      .get(`/api/shield/emails/${unscannedEmailId}`)
      .set('Authorization', `Bearer ${userB.sessionToken}`);

    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.success, false);
  });

  test('5. IDOR Protection: User B requesting User A scanned email returns 404', async () => {
    const res = await request(app)
      .get(`/api/shield/emails/${scannedEmailId}`)
      .set('Authorization', `Bearer ${userB.sessionToken}`);

    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.success, false);
  });

  test('6. Non-existent email returns 404', async () => {
    const res = await request(app)
      .get('/api/shield/emails/non_existent_id_99999')
      .set('Authorization', `Bearer ${userA.sessionToken}`);

    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.success, false);
  });

  test('7. GET /api/shield/stats includes UNSCANNED count for authenticated user', async () => {
    const res = await request(app)
      .get('/api/shield/stats')
      .set('Authorization', `Bearer ${userA.sessionToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.stats);
    assert.strictEqual(typeof res.body.stats.CLEARED, 'number');
    assert.strictEqual(typeof res.body.stats.UNSCANNED, 'number');
    assert.ok(res.body.stats.total >= 2);
  });

  test('8. POST /api/shield/rescan/:id triggers scan and returns 200', async () => {
    const res = await request(app)
      .post(`/api/shield/rescan/${unscannedEmailId}`)
      .set('Authorization', `Bearer ${userA.sessionToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.scan);
    assert.ok(['CLEARED', 'SUSPICIOUS', 'DETAINED'].includes(res.body.scan.verdict));
  });
});
