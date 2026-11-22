import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { db, initDb, runRepairMigration } from '../db/database.js';
import { 
  syncGmailInbox, 
  setGmailClientFactory, 
  resetGmailClientFactory 
} from '../services/gmailService.js';
import { deleteUserAndData } from '../services/oauthService.js';
import { setLLMProvider, resetLLMProvider } from '../services/llm/client.js';

describe('🛡️ SQLite Foreign Key Integrity & Sync Resiliency Tests', () => {
  const testUserA = 'usr_fk_suite_user_a';
  const testUserB = 'usr_fk_suite_user_b';
  const testEmailA = 'fk_tester_a@example.com';
  const testEmailB = 'fk_tester_b@example.com';

  // Ensure Foreign Keys are strictly enabled
  db.exec('PRAGMA foreign_keys = ON;');

  // Generate 25 synthetic messages for FK tests
  const syntheticMessages = Array.from({ length: 25 }, (_, i) => {
    const idx = i + 1;
    const pad = String(idx).padStart(4, '0');
    const msgId = `msg_fk_test_${pad}`;
    return {
      id: msgId,
      threadId: `th_fk_${pad}`,
      snippet: `FK test action item #${idx}`,
      payload: {
        headers: [
          { name: 'Subject', value: `Contract Review #${idx}` },
          { name: 'From', value: `"Partner ${idx}" <partner${idx}@enterprise.com>` },
          { name: 'To', value: testEmailA },
          { name: 'Date', value: new Date(Date.now() - idx * 60000).toUTCString() },
          { name: 'Authentication-Results', value: 'mx.google.com; spf=pass; dkim=pass' }
        ],
        body: {
          data: Buffer.from(`Please review the attached contract for project item ${idx}.`).toString('base64url')
        }
      }
    };
  });

  function createMockGmail(messagesList, failOnId = null) {
    return {
      users: {
        messages: {
          list: async ({ maxResults, pageToken }) => {
            const limit = maxResults || 50;
            return {
              data: {
                messages: messagesList.slice(0, limit).map(m => ({ id: m.id, threadId: m.threadId })),
                nextPageToken: null
              }
            };
          },
          get: async ({ id }) => {
            if (failOnId && id === failOnId) {
              const err = new Error(`Simulated permanent fetch error on ${id}`);
              err.code = 500;
              throw err;
            }
            const found = messagesList.find(m => m.id === id);
            if (!found) throw new Error(`Not found ${id}`);
            return { data: found };
          }
        }
      }
    };
  }

  before(() => {
    initDb();
    db.exec('PRAGMA foreign_keys = ON;');

    // Mock LLM provider with zero network calls
    setLLMProvider({
      async chatCompletion() {
        return {
          content: JSON.stringify({
            category: 'Work',
            priority_score: 4,
            summary: 'Mocked contract review summary.',
            tasks: [{ task_title: 'Sign contract and send confirmation', deadline_text: 'Friday' }],
            reply_drafts: [{ tone: 'Professional', reply_body: 'I will review the contract today.' }]
          })
        };
      },
      async scanPromptGuard() {
        return 0.0;
      }
    });

    // Clean test users
    [testUserA, testUserB].forEach(uId => {
      try {
        deleteUserAndData(uId);
      } catch (_) {}

      db.prepare(`
        INSERT INTO users (id, google_id, email, name, created_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(uId, `gid_${uId}`, `${uId}@example.com`, `Test User ${uId}`);
    });
  });

  after(() => {
    resetLLMProvider();
    resetGmailClientFactory();
    [testUserA, testUserB].forEach(uId => {
      try {
        deleteUserAndData(uId);
      } catch (_) {}
    });
  });

  test('1. Fresh sync (20 emails) completes with 0 foreign key constraint errors', async () => {
    setGmailClientFactory(() => createMockGmail(syntheticMessages.slice(0, 20)));

    const result = await syncGmailInbox(testUserA, { batchSize: 20 });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.newEmailsCount, 20);
    assert.strictEqual(result.failed, 0);

    // Verify foreign key integrity on created rows
    const emailCount = db.prepare('SELECT count(*) as c FROM emails WHERE user_id = ?').get(testUserA).c;
    const scanCount = db.prepare('SELECT count(*) as c FROM shield_scans WHERE user_id = ?').get(testUserA).c;
    const taskCount = db.prepare('SELECT count(*) as c FROM tasks WHERE user_id = ?').get(testUserA).c;
    const draftCount = db.prepare('SELECT count(*) as c FROM drafts WHERE user_id = ?').get(testUserA).c;
    const metaCount = db.prepare('SELECT count(*) as c FROM email_headers_meta WHERE user_id = ?').get(testUserA).c;

    assert.strictEqual(emailCount, 20);
    assert.strictEqual(scanCount, 20);
    assert.ok(taskCount > 0, 'Tasks should be extracted');
    assert.ok(draftCount > 0, 'Drafts should be generated');
    assert.strictEqual(metaCount, 20);

    // Verify PRAGMA foreign_key_check is completely clean
    const violations = db.prepare('PRAGMA foreign_key_check').all();
    assert.strictEqual(violations.length, 0, 'No foreign key violations allowed');
  });

  test('2. Idempotent re-sync preserves pre-existing children without duplicates or FK errors', async () => {
    setGmailClientFactory(() => createMockGmail(syntheticMessages.slice(0, 20)));

    const result = await syncGmailInbox(testUserA, { batchSize: 20 });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.skippedDuplicates, 20);
    assert.strictEqual(result.newEmailsCount, 0);
    assert.strictEqual(result.failed, 0);

    // Counts must not multiply
    const emailCount = db.prepare('SELECT count(*) as c FROM emails WHERE user_id = ?').get(testUserA).c;
    const taskCount = db.prepare('SELECT count(*) as c FROM tasks WHERE user_id = ?').get(testUserA).c;
    const draftCount = db.prepare('SELECT count(*) as c FROM drafts WHERE user_id = ?').get(testUserA).c;
    assert.strictEqual(emailCount, 20);
    assert.strictEqual(taskCount, 5);
    assert.strictEqual(draftCount, 50);

    const violations = db.prepare('PRAGMA foreign_key_check').all();
    assert.strictEqual(violations.length, 0);
  });

  test('3. Mid-sync failure on 1 email rolls back atomically while other emails commit', async () => {
    // Fail specifically on msg_fk_test_0023
    const failId = 'msg_fk_test_0023';
    const fiveNewMessages = syntheticMessages.slice(20, 25);
    setGmailClientFactory(() => createMockGmail(fiveNewMessages, failId));

    const result = await syncGmailInbox(testUserA, { batchSize: 20 });
    assert.strictEqual(result.success, true);
    // 4 should succeed, 1 failed
    assert.strictEqual(result.newEmailsCount, 4);
    assert.strictEqual(result.failed, 1);

    // The failed email must not have orphaned records in emails or any child tables
    const failedEmail = db.prepare('SELECT * FROM emails WHERE id = ?').get(failId);
    assert.strictEqual(failedEmail, undefined);

    const failedScans = db.prepare('SELECT * FROM shield_scans WHERE email_id = ?').all(failId);
    assert.strictEqual(failedScans.length, 0);

    const violations = db.prepare('PRAGMA foreign_key_check').all();
    assert.strictEqual(violations.length, 0);
  });

  test('4. Sync start with missing or invalid user_id throws clean 401/USER_NOT_FOUND', async () => {
    const invalidUserId = 'usr_invalid_user_999999';

    await assert.rejects(
      async () => {
        await syncGmailInbox(invalidUserId, { batchSize: 20 });
      },
      (err) => {
        assert.strictEqual(err.code, 'USER_NOT_FOUND');
        assert.strictEqual(err.statusCode, 401);
        return true;
      }
    );

    // Ensure zero records inserted for invalid user
    const emailCount = db.prepare('SELECT count(*) as c FROM emails WHERE user_id = ?').get(invalidUserId).c;
    assert.strictEqual(emailCount, 0);

    const violations = db.prepare('PRAGMA foreign_key_check').all();
    assert.strictEqual(violations.length, 0);
  });

  test('5. deleteUserAndData deletes user and all children in leaf-first order with 0 FK violations', async () => {
    // Populate some data for testUserB first
    setGmailClientFactory(() => createMockGmail(syntheticMessages.slice(0, 5)));
    await syncGmailInbox(testUserB, { batchSize: 10 });

    const beforeEmails = db.prepare('SELECT count(*) as c FROM emails WHERE user_id = ?').get(testUserB).c;
    assert.strictEqual(beforeEmails, 5);

    // Perform permanent deletion
    const delResult = await deleteUserAndData(testUserB);
    assert.strictEqual(delResult.success, true);

    // Verify all records for testUserB are gone
    const afterUser = db.prepare('SELECT * FROM users WHERE id = ?').get(testUserB);
    const afterEmails = db.prepare('SELECT count(*) as c FROM emails WHERE user_id = ?').get(testUserB).c;
    const afterScans = db.prepare('SELECT count(*) as c FROM shield_scans WHERE user_id = ?').get(testUserB).c;
    const afterTasks = db.prepare('SELECT count(*) as c FROM tasks WHERE user_id = ?').get(testUserB).c;
    const afterDrafts = db.prepare('SELECT count(*) as c FROM drafts WHERE user_id = ?').get(testUserB).c;
    const afterMeta = db.prepare('SELECT count(*) as c FROM email_headers_meta WHERE user_id = ?').get(testUserB).c;

    assert.strictEqual(afterUser, undefined);
    assert.strictEqual(afterEmails, 0);
    assert.strictEqual(afterScans, 0);
    assert.strictEqual(afterTasks, 0);
    assert.strictEqual(afterDrafts, 0);
    assert.strictEqual(afterMeta, 0);

    // Database must remain 100% consistent
    const violations = db.prepare('PRAGMA foreign_key_check').all();
    assert.strictEqual(violations.length, 0);
  });

  test('6. Repair migration runs idempotently and maintains 0 foreign key violations', () => {
    // Run repair migration
    runRepairMigration();

    const violations = db.prepare('PRAGMA foreign_key_check').all();
    assert.strictEqual(violations.length, 0);
  });
});
