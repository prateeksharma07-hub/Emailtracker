import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../index.js';
import { db } from '../db/database.js';

describe('🌐 Sender Memory REST API & Data Erasure Tests', () => {
  const userA = {
    id: 'usr_snd_alpha_' + Date.now(),
    google_id: 'gid_snd_alpha_' + Date.now(),
    email: 'alpha_snd@example.com',
    name: 'Alpha Sender User',
    sessionToken: 'sess_snd_alpha_' + Date.now()
  };

  const userB = {
    id: 'usr_snd_beta_' + Date.now(),
    google_id: 'gid_snd_beta_' + Date.now(),
    email: 'beta_snd@example.com',
    name: 'Beta Sender User',
    sessionToken: 'sess_snd_beta_' + Date.now()
  };

  const profileA1Id = 'snd_prof_a1_' + Date.now();
  const profileA2Id = 'snd_prof_a2_' + Date.now();
  const profileB1Id = 'snd_prof_b1_' + Date.now();

  const emailA1Id = 'eml_snd_a1_' + Date.now();

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
    const insertEmail = db.prepare(`
      INSERT INTO emails (id, user_id, thread_id, account_id, sender, recipient, subject, body_text, date_received)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertEmail.run(emailA1Id, userA.id, 'th_a1', null, 'vendor@service.com', userA.email, 'Invoice update', 'Please find attached invoice', new Date().toISOString());

    // 4. Seed Sender Profiles
    const insertProfile = db.prepare(`
      INSERT INTO sender_profiles (
        id, user_id, sender_email, sender_domain, display_names_json,
        received_count, sent_to_count, trust_state, user_set,
        first_seen_at, last_seen_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertProfile.run(
      profileA1Id, userA.id, 'trusted_partner@corp.com', 'corp.com', JSON.stringify(['Trusted Partner']),
      5, 3, 'trusted', 1, new Date().toISOString(), new Date().toISOString()
    );
    insertProfile.run(
      profileA2Id, userA.id, 'newsletter@updates.io', 'updates.io', JSON.stringify(['Updates Daily']),
      10, 0, 'unknown', 0, new Date().toISOString(), new Date().toISOString()
    );
    insertProfile.run(
      profileB1Id, userB.id, 'secret_client@finance.com', 'finance.com', JSON.stringify(['Secret Client']),
      2, 1, 'trusted', 1, new Date().toISOString(), new Date().toISOString()
    );

    // 5. Seed Email Header Meta
    const insertHeader = db.prepare(`
      INSERT INTO email_headers_meta (
        id, email_id, user_id, from_addr, from_name, reply_to, spf, dkim, dmarc
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertHeader.run(
      'hdr_a1_' + Date.now(), emailA1Id, userA.id, 'trusted_partner@corp.com', 'Trusted Partner',
      null, 'pass', 'pass', 'pass'
    );
  });

  after(() => {
    // Cleanup
    try {
      db.prepare('DELETE FROM email_headers_meta WHERE user_id IN (?, ?)').run(userA.id, userB.id);
      db.prepare('DELETE FROM sender_profiles WHERE user_id IN (?, ?)').run(userA.id, userB.id);
      db.prepare('DELETE FROM emails WHERE user_id IN (?, ?)').run(userA.id, userB.id);
      db.prepare('DELETE FROM sessions WHERE user_id IN (?, ?)').run(userA.id, userB.id);
      db.prepare('DELETE FROM users WHERE id IN (?, ?)').run(userA.id, userB.id);
    } catch (e) {}
  });

  test('1. Authentication Gate: Unauthenticated request to /api/senders is rejected with 401', async () => {
    const res = await request(app).get('/api/senders');
    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
  });

  test('2. Multi-User Isolation: User A and User B cannot see each other sender profiles', async () => {
    const resA = await request(app)
      .get('/api/senders')
      .set('Cookie', `mailmind_session=${userA.sessionToken}`);

    assert.equal(resA.status, 200);
    assert.equal(resA.body.success, true);
    assert.equal(resA.body.senders.length, 2);
    const emailsA = resA.body.senders.map(s => s.sender_email);
    assert.ok(emailsA.includes('trusted_partner@corp.com'));
    assert.ok(!emailsA.includes('secret_client@finance.com'));

    const resB = await request(app)
      .get('/api/senders')
      .set('Cookie', `mailmind_session=${userB.sessionToken}`);

    assert.equal(resB.status, 200);
    assert.equal(resB.body.senders.length, 1);
    assert.equal(resB.body.senders[0].sender_email, 'secret_client@finance.com');
  });

  test('3. Query Filtering: Filter by state and keyword search operates strictly within user context', async () => {
    const resFiltered = await request(app)
      .get('/api/senders?state=trusted')
      .set('Cookie', `mailmind_session=${userA.sessionToken}`);

    assert.equal(resFiltered.status, 200);
    assert.equal(resFiltered.body.senders.length, 1);
    assert.equal(resFiltered.body.senders[0].sender_email, 'trusted_partner@corp.com');

    const resSearch = await request(app)
      .get('/api/senders?q=newsletter')
      .set('Cookie', `mailmind_session=${userA.sessionToken}`);

    assert.equal(resSearch.status, 200);
    assert.equal(resSearch.body.senders.length, 1);
    assert.equal(resSearch.body.senders[0].sender_email, 'newsletter@updates.io');
  });

  test('4. IDOR Protection: User B fetching User A profile returns 404', async () => {
    const res = await request(app)
      .get(`/api/senders/${profileA1Id}`)
      .set('Cookie', `mailmind_session=${userB.sessionToken}`);

    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
  });

  test('5. Detail View: User A gets profile with associated header authentication history', async () => {
    const res = await request(app)
      .get(`/api/senders/${profileA1Id}`)
      .set('Cookie', `mailmind_session=${userA.sessionToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.sender.id, profileA1Id);
    assert.ok(Array.isArray(res.body.recentHeaders));
    assert.equal(res.body.recentHeaders.length, 1);
    assert.equal(res.body.recentHeaders[0].spf, 'pass');
  });

  test('6. IDOR Protection: User B modifying User A profile returns 404', async () => {
    const res = await request(app)
      .patch(`/api/senders/${profileA1Id}`)
      .set('Cookie', `mailmind_session=${userB.sessionToken}`)
      .send({ trust_state: 'blocked' });

    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);

    // Verify uncompromised in database
    const profile = db.prepare('SELECT trust_state FROM sender_profiles WHERE id = ?').get(profileA1Id);
    assert.equal(profile.trust_state, 'trusted');
  });

  test('7. Validation & Update: PATCH rejects invalid trust_state and accepts valid transitions', async () => {
    const resInvalid = await request(app)
      .patch(`/api/senders/${profileA1Id}`)
      .set('Cookie', `mailmind_session=${userA.sessionToken}`)
      .send({ trust_state: 'super_trusted_invalid' });

    assert.equal(resInvalid.status, 400);

    const resValid = await request(app)
      .patch(`/api/senders/${profileA1Id}`)
      .set('Cookie', `mailmind_session=${userA.sessionToken}`)
      .send({ trust_state: 'blocked' });

    assert.equal(resValid.status, 200);
    assert.equal(resValid.body.sender.trust_state, 'blocked');
    assert.equal(resValid.body.sender.user_set, 1);
  });

  test('8. IDOR Protection: User B deleting User A profile returns 404', async () => {
    const res = await request(app)
      .delete(`/api/senders/${profileA2Id}`)
      .set('Cookie', `mailmind_session=${userB.sessionToken}`);

    assert.equal(res.status, 404);

    const stillExists = db.prepare('SELECT id FROM sender_profiles WHERE id = ?').get(profileA2Id);
    assert.ok(stillExists);
  });

  test('9. Profile Deletion: User A deletes own profile successfully', async () => {
    const res = await request(app)
      .delete(`/api/senders/${profileA2Id}`)
      .set('Cookie', `mailmind_session=${userA.sessionToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);

    const deleted = db.prepare('SELECT id FROM sender_profiles WHERE id = ?').get(profileA2Id);
    assert.equal(deleted, undefined);
  });

  test('10. Bulk Forget: DELETE /api/senders requires confirm=true and only deletes caller profiles', async () => {
    // Missing confirmation
    const resNoConfirm = await request(app)
      .delete('/api/senders')
      .set('Cookie', `mailmind_session=${userA.sessionToken}`);

    assert.equal(resNoConfirm.status, 400);

    // With confirmation
    const resConfirmed = await request(app)
      .delete('/api/senders?confirm=true')
      .set('Cookie', `mailmind_session=${userA.sessionToken}`);

    assert.equal(resConfirmed.status, 200);
    assert.equal(resConfirmed.body.success, true);

    // Verify User A profiles are gone
    const sendersA = db.prepare('SELECT * FROM sender_profiles WHERE user_id = ?').all(userA.id);
    assert.equal(sendersA.length, 0);

    // Verify User B profile is completely untouched
    const sendersB = db.prepare('SELECT * FROM sender_profiles WHERE user_id = ?').all(userB.id);
    assert.equal(sendersB.length, 1);
  });

  test('11. Profile Rebuild: POST /api/senders/rebuild creates profiles from stored emails', async () => {
    const res = await request(app)
      .post('/api/senders/rebuild')
      .set('Cookie', `mailmind_session=${userA.sessionToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.profilesCount >= 1);

    const rebuiltProfile = db.prepare('SELECT * FROM sender_profiles WHERE user_id = ? AND sender_email = ?').get(userA.id, 'vendor@service.com');
    assert.ok(rebuiltProfile);
    assert.equal(rebuiltProfile.sender_domain, 'service.com');
  });

  test('12. Disconnect & Delete My Data (GDPR): Wipes sender profiles and headers meta', async () => {
    // Seed temporary user
    const gdprUser = {
      id: 'usr_gdpr_' + Date.now(),
      google_id: 'gid_gdpr_' + Date.now(),
      email: 'gdpr_' + Date.now() + '@example.com',
      sessionToken: 'sess_gdpr_' + Date.now()
    };
    db.prepare('INSERT INTO users (id, google_id, email, token_expiry) VALUES (?, ?, ?, ?)').run(gdprUser.id, gdprUser.google_id, gdprUser.email, Date.now() + 86400000);
    db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(gdprUser.sessionToken, gdprUser.id, Date.now() + 86400000);
    db.prepare(`
      INSERT INTO sender_profiles (id, user_id, sender_email, sender_domain)
      VALUES (?, ?, ?, ?)
    `).run('prof_gdpr_' + Date.now(), gdprUser.id, 'gdpr_target@test.com', 'test.com');
    
    const gdprEmailId = 'eml_gdpr_' + Date.now();
    db.prepare(`
      INSERT INTO emails (id, user_id, thread_id, sender, recipient, subject, body_text, date_received)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(gdprEmailId, gdprUser.id, 'th_gdpr', 'gdpr_target@test.com', gdprUser.email, 'GDPR Email', 'Content', new Date().toISOString());

    db.prepare(`
      INSERT INTO email_headers_meta (id, email_id, user_id, from_addr)
      VALUES (?, ?, ?, ?)
    `).run('hdr_gdpr_' + Date.now(), gdprEmailId, gdprUser.id, 'gdpr_target@test.com');

    // Call DELETE /api/auth/me
    const res = await request(app)
      .delete('/api/auth/me')
      .set('Cookie', `mailmind_session=${gdprUser.sessionToken}`);

    assert.equal(res.status, 200);

    // Verify all sender data for this user is gone
    const profiles = db.prepare('SELECT * FROM sender_profiles WHERE user_id = ?').all(gdprUser.id);
    assert.equal(profiles.length, 0);
    const headers = db.prepare('SELECT * FROM email_headers_meta WHERE user_id = ?').all(gdprUser.id);
    assert.equal(headers.length, 0);
  });

  test('13. Feature Flag: When FEATURE_SENDER_TRUST=false, /api/senders is safely disabled', async () => {
    const originalEnv = process.env.FEATURE_SENDER_TRUST;
    try {
      process.env.FEATURE_SENDER_TRUST = 'false';

      const res = await request(app)
        .get('/api/senders')
        .set('Cookie', `mailmind_session=${userA.sessionToken}`);

      assert.equal(res.status, 503);
      assert.equal(res.body.featureDisabled, true);
    } finally {
      process.env.FEATURE_SENDER_TRUST = originalEnv;
    }
  });
});
