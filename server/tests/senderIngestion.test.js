import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { db } from '../db/database.js';
import { parseAuthenticationResults, parseSenderAddress, parseEmailHeaders } from '../services/senderMemory/headerParser.js';
import { ingestIncomingEmailHeaders } from '../services/senderMemory/senderIngestion.js';

describe('📨 Sender Memory: Header Parsing & Ingestion Tests', () => {
  const userAId = 'usr_ingest_a';
  const userBId = 'usr_ingest_b';

  before(() => {
    // Clean up test data
    db.prepare('DELETE FROM email_headers_meta WHERE user_id IN (?, ?)').run(userAId, userBId);
    db.prepare('DELETE FROM sender_profiles WHERE user_id IN (?, ?)').run(userAId, userBId);
    db.prepare('DELETE FROM emails WHERE user_id IN (?, ?)').run(userAId, userBId);
    db.prepare('DELETE FROM users WHERE id IN (?, ?)').run(userAId, userBId);

    // Create test users
    const insertUser = db.prepare(`
      INSERT INTO users (id, google_id, email, name)
      VALUES (?, ?, ?, ?)
    `);
    insertUser.run(userAId, 'gid_ingest_a', 'alex.a@example.com', 'Alex A');
    insertUser.run(userBId, 'gid_ingest_b', 'bob.b@example.com', 'Bob B');

    // Create test email parent records
    db.prepare(`
      INSERT INTO emails (id, user_id, thread_id, sender, recipient, subject, date_received)
      VALUES (?, ?, 'th_ingest_1', 'alice@partner.com', 'alex.a@example.com', 'Contract', CURRENT_TIMESTAMP)
    `).run('msg_ingest_1', userAId);

    db.prepare(`
      INSERT INTO emails (id, user_id, thread_id, sender, recipient, subject, date_received)
      VALUES (?, ?, 'th_ingest_2', 'alice@partner.com', 'alex.a@example.com', 'Contract Update', CURRENT_TIMESTAMP)
    `).run('msg_ingest_2', userAId);

    db.prepare(`
      INSERT INTO emails (id, user_id, thread_id, sender, recipient, subject, date_received)
      VALUES (?, ?, 'th_ingest_b', 'alice@partner.com', 'bob.b@example.com', 'Contract User B', CURRENT_TIMESTAMP)
    `).run('msg_ingest_user_b', userBId);
  });

  after(() => {
    process.env.FEATURE_SENDER_TRUST = 'true';
    db.prepare('DELETE FROM email_headers_meta WHERE user_id IN (?, ?)').run(userAId, userBId);
    db.prepare('DELETE FROM sender_profiles WHERE user_id IN (?, ?)').run(userAId, userBId);
    db.prepare('DELETE FROM emails WHERE user_id IN (?, ?)').run(userAId, userBId);
    db.prepare('DELETE FROM users WHERE id IN (?, ?)').run(userAId, userBId);
  });

  test('1. Authentication-Results: strictly accepts mx.google.com and rejects forged headers', () => {
    // Valid Google header
    const validGoogle = 'mx.google.com; dkim=pass header.i=@github.com; spf=pass smtp.mailfrom=support@github.com; dmarc=pass';
    const auth1 = parseAuthenticationResults(validGoogle);
    assert.strictEqual(auth1.spf, 'pass');
    assert.strictEqual(auth1.dkim, 'pass');
    assert.strictEqual(auth1.dmarc, 'pass');

    // Attacker forged header with different authserv-id
    const forgedHeader = 'attacker-mta.net; dkim=pass; spf=pass; dmarc=pass';
    const auth2 = parseAuthenticationResults(forgedHeader);
    assert.strictEqual(auth2.spf, 'unknown');
    assert.strictEqual(auth2.dkim, 'unknown');
    assert.strictEqual(auth2.dmarc, 'unknown');

    // Multiple headers: fake first, Google second
    const multiHeaders = [
      'evil.com; dkim=pass; spf=pass; dmarc=pass',
      'mx.google.com; dkim=fail header.i=@corp.com; spf=softfail; dmarc=fail'
    ];
    const auth3 = parseAuthenticationResults(multiHeaders);
    assert.strictEqual(auth3.dkim, 'fail');
    assert.strictEqual(auth3.spf, 'fail');
    assert.strictEqual(auth3.dmarc, 'fail');

    // Missing or invalid headers
    assert.deepStrictEqual(parseAuthenticationResults(null), { spf: 'unknown', dkim: 'unknown', dmarc: 'unknown' });
    assert.deepStrictEqual(parseAuthenticationResults(''), { spf: 'unknown', dkim: 'unknown', dmarc: 'unknown' });
  });

  test('2. Sender Address: robust RFC 2822 parser handles quotes, commas, bare emails, and names', () => {
    const r1 = parseSenderAddress('"Doe, John" <john.doe@enterprise.com>');
    assert.strictEqual(r1.name, 'Doe, John');
    assert.strictEqual(r1.email, 'john.doe@enterprise.com');
    assert.strictEqual(r1.domain, 'enterprise.com');

    const r2 = parseSenderAddress('Sarah Connor <sarah@resistance.org>');
    assert.strictEqual(r2.name, 'Sarah Connor');
    assert.strictEqual(r2.email, 'sarah@resistance.org');
    assert.strictEqual(r2.domain, 'resistance.org');

    const r3 = parseSenderAddress('alerts@banking-service.co.uk');
    assert.strictEqual(r3.name, 'alerts');
    assert.strictEqual(r3.email, 'alerts@banking-service.co.uk');
    assert.strictEqual(r3.domain, 'banking-service.co.uk');

    const r4 = parseSenderAddress('<no-reply@domain.com>');
    assert.strictEqual(r4.name, 'no-reply');
    assert.strictEqual(r4.email, 'no-reply@domain.com');
    assert.strictEqual(r4.domain, 'domain.com');
  });

  test('3. Ingestion: upserts sender_profiles and email_headers_meta on incoming email', () => {
    const rawHeaders = [
      { name: 'From', value: 'Alice Partner <alice@partner.com>' },
      { name: 'Reply-To', value: 'Alice <alice-replies@partner.com>' },
      { name: 'Authentication-Results', value: 'mx.google.com; dkim=pass; spf=pass; dmarc=pass' },
      { name: 'Date', value: 'Sat, 21 Nov 2026 10:00:00 GMT' }
    ];

    // First ingestion for msg_ingest_1
    const result1 = ingestIncomingEmailHeaders('msg_ingest_1', userAId, rawHeaders);
    assert.ok(result1);
    assert.strictEqual(result1.from.email, 'alice@partner.com');
    assert.strictEqual(result1.auth.spf, 'pass');

    // Verify database profile
    const profile = db.prepare('SELECT * FROM sender_profiles WHERE user_id = ? AND sender_email = ?').get(userAId, 'alice@partner.com');
    assert.ok(profile);
    assert.strictEqual(profile.received_count, 1);
    assert.strictEqual(profile.sent_to_count, 0);
    assert.strictEqual(profile.trust_state, 'unknown');
    assert.ok(profile.display_names_json.includes('Alice Partner'));

    // Verify email_headers_meta
    const meta = db.prepare('SELECT * FROM email_headers_meta WHERE user_id = ? AND email_id = ?').get(userAId, 'msg_ingest_1');
    assert.ok(meta);
    assert.strictEqual(meta.from_addr, 'alice@partner.com');
    assert.strictEqual(meta.from_name, 'Alice Partner');
    assert.strictEqual(meta.reply_to, 'alice-replies@partner.com');
    assert.strictEqual(meta.spf, 'pass');
    assert.strictEqual(meta.dkim, 'pass');
    assert.strictEqual(meta.dmarc, 'pass');

    // Second ingestion from same sender increments received_count
    ingestIncomingEmailHeaders('msg_ingest_2', userAId, rawHeaders);
    const updatedProfile = db.prepare('SELECT * FROM sender_profiles WHERE user_id = ? AND sender_email = ?').get(userAId, 'alice@partner.com');
    assert.strictEqual(updatedProfile.received_count, 2);
  });

  test('4. Multi-User Isolation: User B receives distinct profile for identical sender email', () => {
    const rawHeaders = [
      { name: 'From', value: 'Alice Partner <alice@partner.com>' },
      { name: 'Authentication-Results', value: 'mx.google.com; dkim=pass; spf=pass; dmarc=pass' }
    ];

    // User B receives from alice@partner.com
    ingestIncomingEmailHeaders('msg_ingest_user_b', userBId, rawHeaders);

    const profileB = db.prepare('SELECT * FROM sender_profiles WHERE user_id = ? AND sender_email = ?').get(userBId, 'alice@partner.com');
    assert.ok(profileB);
    assert.strictEqual(profileB.received_count, 1);

    // User A count should still be 2 (isolated)
    const profileA = db.prepare('SELECT * FROM sender_profiles WHERE user_id = ? AND sender_email = ?').get(userAId, 'alice@partner.com');
    assert.strictEqual(profileA.received_count, 2);
  });

  test('5. Feature Flag: When FEATURE_SENDER_TRUST=false, ingestion is skipped', () => {
    process.env.FEATURE_SENDER_TRUST = 'false';

    const rawHeaders = [
      { name: 'From', value: 'Flagged Sender <flagged@skip.com>' }
    ];

    const res = ingestIncomingEmailHeaders('msg_skip_flag', userAId, rawHeaders);
    assert.strictEqual(res, null);

    const profile = db.prepare('SELECT * FROM sender_profiles WHERE user_id = ? AND sender_email = ?').get(userAId, 'flagged@skip.com');
    assert.strictEqual(profile, undefined);

    process.env.FEATURE_SENDER_TRUST = 'true';
  });
});
