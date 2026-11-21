import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { db } from '../db/database.js';
import { splitAddressList, parseAddressList, syncSentMailMetadata } from '../services/senderMemory/sentSync.js';

describe('📤 Sender Memory: Sent Mail Metadata Sync Tests', () => {
  const userId = 'usr_sent_sync_test';

  before(() => {
    db.prepare('DELETE FROM sender_profiles WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM settings WHERE key LIKE ?').run(`last_sent_sync_${userId}%`);
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);

    db.prepare(`
      INSERT INTO users (id, google_id, email, name)
      VALUES (?, 'gid_sent_test', 'test.user@example.com', 'Test User')
    `).run(userId);
  });

  after(() => {
    process.env.FEATURE_SENDER_TRUST = 'true';
    db.prepare('DELETE FROM sender_profiles WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM settings WHERE key LIKE ?').run(`last_sent_sync_${userId}%`);
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  });

  test('1. splitAddressList correctly preserves commas inside quoted names', () => {
    const raw = '"Doe, John" <john@corp.com>, Jane Smith <jane@corp.com>, "Smith, Bob Jr." <bob@corp.com>';
    const tokens = splitAddressList(raw);
    assert.strictEqual(tokens.length, 3);
    assert.ok(tokens[0].includes('Doe, John'));
    assert.ok(tokens[1].includes('Jane Smith'));
    assert.ok(tokens[2].includes('Smith, Bob Jr.'));

    const parsed = parseAddressList(raw);
    assert.strictEqual(parsed.length, 3);
    assert.strictEqual(parsed[0].name, 'Doe, John');
    assert.strictEqual(parsed[0].email, 'john@corp.com');
    assert.strictEqual(parsed[1].name, 'Jane Smith');
    assert.strictEqual(parsed[1].email, 'jane@corp.com');
    assert.strictEqual(parsed[2].name, 'Smith, Bob Jr.');
    assert.strictEqual(parsed[2].email, 'bob@corp.com');
  });

  test('2. syncSentMailMetadata: fetches only metadata headers and updates sent_to_count', async () => {
    let requestedFormat = null;
    let requestedHeaders = null;

    const mockGmail = {
      users: {
        messages: {
          list: async () => ({
            data: {
              messages: [{ id: 'sent_msg_1' }, { id: 'sent_msg_2' }]
            }
          }),
          get: async ({ id, format, metadataHeaders }) => {
            requestedFormat = format;
            requestedHeaders = metadataHeaders;

            if (id === 'sent_msg_1') {
              return {
                data: {
                  id: 'sent_msg_1',
                  payload: {
                    headers: [
                      { name: 'To', value: 'Vendor Corp <vendor@external.com>' },
                      { name: 'Cc', value: 'Auditor <auditor@audit.org>' },
                      { name: 'Date', value: 'Thu, 20 Nov 2026 14:00:00 GMT' }
                    ]
                  }
                }
              };
            }
            return {
              data: {
                id: 'sent_msg_2',
                payload: {
                  headers: [
                    { name: 'To', value: 'Vendor Corp <vendor@external.com>' },
                    { name: 'Date', value: 'Fri, 21 Nov 2026 09:00:00 GMT' }
                  ]
                }
              }
            };
          }
        }
      }
    };

    const res = await syncSentMailMetadata(userId, mockGmail, 10);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.processedCount, 2);

    // Verify format is strictly metadata (body is never requested)
    assert.strictEqual(requestedFormat, 'metadata');
    assert.deepStrictEqual(requestedHeaders, ['To', 'Cc', 'Date']);

    // Check vendor profile: 2 emails sent
    const vendorProfile = db.prepare('SELECT * FROM sender_profiles WHERE user_id = ? AND sender_email = ?').get(userId, 'vendor@external.com');
    assert.ok(vendorProfile);
    assert.strictEqual(vendorProfile.sent_to_count, 2);
    assert.strictEqual(vendorProfile.received_count, 0);

    // Check auditor profile: 1 email sent
    const auditorProfile = db.prepare('SELECT * FROM sender_profiles WHERE user_id = ? AND sender_email = ?').get(userId, 'auditor@audit.org');
    assert.ok(auditorProfile);
    assert.strictEqual(auditorProfile.sent_to_count, 1);
  });

  test('3. Rate Limit Resilience: retries with backoff on 429 response', async () => {
    let callCount = 0;
    const mockGmail = {
      users: {
        messages: {
          list: async () => ({
            data: {
              messages: [{ id: 'msg_rate_limited' }]
            }
          }),
          get: async () => {
            callCount++;
            if (callCount === 1) {
              const err = new Error('Rate limit exceeded');
              err.status = 429;
              throw err;
            }
            return {
              data: {
                id: 'msg_rate_limited',
                payload: {
                  headers: [
                    { name: 'To', value: 'Client <client@resilient.com>' },
                    { name: 'Date', value: 'Fri, 21 Nov 2026 12:00:00 GMT' }
                  ]
                }
              }
            };
          }
        }
      }
    };

    const res = await syncSentMailMetadata(userId, mockGmail, 5);
    assert.strictEqual(res.success, true);
    assert.strictEqual(callCount, 2, 'Should retry on 429 and succeed on 2nd attempt');

    const clientProf = db.prepare('SELECT * FROM sender_profiles WHERE user_id = ? AND sender_email = ?').get(userId, 'client@resilient.com');
    assert.ok(clientProf);
    assert.strictEqual(clientProf.sent_to_count, 1);
  });

  test('4. Feature Flag: When FEATURE_SENDER_TRUST=false, sent sync is bypassed', async () => {
    process.env.FEATURE_SENDER_TRUST = 'false';

    let listCalled = false;
    const mockGmail = {
      users: {
        messages: {
          list: async () => {
            listCalled = true;
            return { data: { messages: [] } };
          }
        }
      }
    };

    const res = await syncSentMailMetadata(userId, mockGmail, 5);
    assert.strictEqual(res.disabledByFlag, true);
    assert.strictEqual(listCalled, false, 'Gmail API should not be contacted when feature is disabled');

    process.env.FEATURE_SENDER_TRUST = 'true';
  });
});
