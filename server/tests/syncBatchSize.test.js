import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';

import { db, initDb } from '../db/database.js';
import { ALLOWED_BATCH_SIZES, DEFAULT_BATCH_SIZE } from '../config/syncConstants.js';
import { getUserSettings, updateUserSettings } from '../services/settingsService.js';
import { 
  syncGmailInbox, 
  setGmailClientFactory, 
  resetGmailClientFactory,
  getSyncStatusForUser 
} from '../services/gmailService.js';
import { setLLMProvider, resetLLMProvider } from '../services/llm/client.js';

import emailsRouter from '../routes/emails.js';
import settingsRouter from '../routes/settings.js';

// Setup express test app
const app = express();
app.use(express.json());
app.use(cookieParser());

app.use('/api/emails', emailsRouter);
app.use('/api/settings', settingsRouter);

describe('🔄 Sync Batch Size & Ingestion Engine Tests', () => {
  const userA = 'usr_sync_test_user_a';
  const userB = 'usr_sync_test_user_b';
  const sessionA = 'sess_sync_test_user_a';
  const sessionB = 'sess_sync_test_user_b';

  // Generate 250 synthetic Gmail messages (msg_001 = newest, msg_250 = oldest)
  const syntheticGmailMessages = Array.from({ length: 250 }, (_, i) => {
    const idx = i + 1;
    const pad = String(idx).padStart(3, '0');
    const msgId = `msg_${pad}`;
    const date = new Date(Date.now() - idx * 3600 * 1000).toUTCString();
    return {
      id: msgId,
      threadId: `th_${pad}`,
      snippet: `Synthetic message content number ${idx}`,
      payload: {
        headers: [
          { name: 'Subject', value: `Project Update Sync #${idx}` },
          { name: 'From', value: `"Colleague ${idx}" <colleague${idx}@work.com>` },
          { name: 'To', value: 'me@work.com' },
          { name: 'Date', value: date }
        ],
        body: {
          data: Buffer.from(`This is the detailed body text for synthetic message ${idx}.`).toString('base64')
        }
      }
    };
  });

  /**
   * Builds a stateful or stateless Mock Gmail client
   */
  function createMockGmailClient({ failOnGetId = null, rateLimitGetTimes = 0 } = {}) {
    let rateLimitsRemaining = rateLimitGetTimes;

    return {
      users: {
        messages: {
          list: async ({ maxResults = 100, pageToken = null } = {}) => {
            const startIndex = pageToken ? parseInt(pageToken.replace('token_', ''), 10) : 0;
            const limit = Math.min(maxResults, 100);
            const slice = syntheticGmailMessages.slice(startIndex, startIndex + limit);
            const nextIdx = startIndex + limit;
            const nextPageToken = nextIdx < syntheticGmailMessages.length ? `token_${nextIdx}` : null;

            return {
              data: {
                messages: slice.map(m => ({ id: m.id, threadId: m.threadId })),
                nextPageToken
              }
            };
          },

          get: async ({ id }) => {
            if (id === failOnGetId) {
              const err = new Error(`Simulated permanent fetch error on ${id}`);
              err.status = 500;
              throw err;
            }

            if (rateLimitsRemaining > 0) {
              rateLimitsRemaining--;
              const err = new Error('Rate limit exceeded: 429 Too Many Requests');
              err.status = 429;
              err.headers = { 'retry-after': '0' };
              throw err;
            }

            const found = syntheticGmailMessages.find(m => m.id === id);
            if (!found) {
              const err = new Error(`Message not found: ${id}`);
              err.status = 404;
              throw err;
            }
            return { data: found };
          }
        }
      }
    };
  }

  before(() => {
    initDb();
    // Clear test tables
    [userA, userB].forEach(uId => {
      db.prepare('DELETE FROM emails WHERE user_id = ?').run(uId);
      db.prepare('DELETE FROM tasks WHERE user_id = ?').run(uId);
      db.prepare('DELETE FROM drafts WHERE user_id = ?').run(uId);
      db.prepare('DELETE FROM shield_scans WHERE user_id = ?').run(uId);
      db.prepare('DELETE FROM user_settings WHERE user_id = ?').run(uId);
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(uId);
      db.prepare('DELETE FROM users WHERE id = ?').run(uId);

      db.prepare(`
        INSERT INTO users (id, google_id, email, name, created_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(uId, `gid_${uId}`, `${uId}@test.com`, `Test User ${uId}`);
    });

    db.prepare('DELETE FROM sessions WHERE id IN (?, ?)').run(sessionA, sessionB);
    db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(sessionA, userA, Date.now() + 3600000);
    db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(sessionB, userB, Date.now() + 3600000);

    // Provide mock LLM provider that avoids external network calls
    setLLMProvider({
      async chatCompletion() {
        return {
          content: JSON.stringify({
            category: 'Work',
            priority_score: 4,
            summary: 'Mocked Groq analysis summary for batch sync test.',
            tasks: [{ task_title: 'Follow up on sync item', deadline_text: 'Tomorrow' }],
            reply_drafts: [{ tone: 'Professional', reply_body: 'Acknowledged.' }]
          })
        };
      },
      async scanPromptGuard() {
        return 0.0;
      }
    });
  });

  after(() => {
    resetGmailClientFactory();
    resetLLMProvider();

    db.prepare('DELETE FROM sessions WHERE id IN (?, ?)').run(sessionA, sessionB);
    [userA, userB].forEach(uId => {
      db.prepare('DELETE FROM emails WHERE user_id = ?').run(uId);
      db.prepare('DELETE FROM tasks WHERE user_id = ?').run(uId);
      db.prepare('DELETE FROM drafts WHERE user_id = ?').run(uId);
      db.prepare('DELETE FROM shield_scans WHERE user_id = ?').run(uId);
      db.prepare('DELETE FROM user_settings WHERE user_id = ?').run(uId);
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(uId);
      db.prepare('DELETE FROM users WHERE id = ?').run(uId);
    });
  });

  test('1. Constants: allowed batch sizes {20, 50, 100, 200} and default 50', () => {
    assert.deepStrictEqual(ALLOWED_BATCH_SIZES, [20, 50, 100, 200]);
    assert.strictEqual(DEFAULT_BATCH_SIZE, 50);
  });

  test('2. Settings Persistence & Multi-User Isolation: GET & PATCH /api/settings', async () => {
    // A. Default settings for User A
    const getRes1 = await request(app)
      .get('/api/settings')
      .set('Cookie', `mailmind_session=${sessionA}`);
    assert.strictEqual(getRes1.status, 200);
    assert.strictEqual(getRes1.body.success, true);
    assert.strictEqual(getRes1.body.settings.syncBatchSize, 50);
    assert.deepStrictEqual(getRes1.body.settings.allowedBatchSizes, [20, 50, 100, 200]);

    // B. Invalid batchSize => 400 Bad Request
    const patchInvalid = await request(app)
      .patch('/api/settings')
      .set('Cookie', `mailmind_session=${sessionA}`)
      .send({ syncBatchSize: 37 });
    assert.strictEqual(patchInvalid.status, 400);
    assert.strictEqual(patchInvalid.body.success, false);
    assert.ok(patchInvalid.body.error.includes('Allowed values'));

    // C. Update User A to 100
    const patchValid = await request(app)
      .patch('/api/settings')
      .set('Cookie', `mailmind_session=${sessionA}`)
      .send({ syncBatchSize: 100 });
    assert.strictEqual(patchValid.status, 200);
    assert.strictEqual(patchValid.body.settings.syncBatchSize, 100);

    // D. Multi-User Isolation: User B still has default 50
    const getResB = await request(app)
      .get('/api/settings')
      .set('Cookie', `mailmind_session=${sessionB}`);
    assert.strictEqual(getResB.status, 200);
    assert.strictEqual(getResB.body.settings.syncBatchSize, 50);

    // E. User A reloads, still has 100
    const getResA2 = await request(app)
      .get('/api/settings')
      .set('Cookie', `mailmind_session=${sessionA}`);
    assert.strictEqual(getResA2.body.settings.syncBatchSize, 100);
  });

  test('3. Sync sequence: 20 -> 50 -> 100 -> 20 -> 100 correctly fetches older emails and skips duplicates', async () => {
    // Wipe emails for clean slate
    db.prepare('DELETE FROM emails WHERE user_id = ?').run(userA);

    const mockGmail = createMockGmailClient();
    setGmailClientFactory(() => mockGmail);

    // Step A: Sync 20
    const res20 = await request(app)
      .post('/api/emails/sync')
      .set('Cookie', `mailmind_session=${sessionA}`)
      .send({ batchSize: 20 });

    assert.strictEqual(res20.status, 200);
    assert.strictEqual(res20.body.success, true);
    assert.strictEqual(res20.body.usedBatchSize, 20);
    assert.strictEqual(res20.body.fetchedNew, 20);
    assert.strictEqual(res20.body.alreadyHad, 0);
    assert.strictEqual(res20.body.failed, 0);
    assert.strictEqual(res20.body.newEmailsCount, 20);
    assert.strictEqual(res20.body.skippedDuplicates, 0);

    const countAfter20 = db.prepare('SELECT COUNT(*) as c FROM emails WHERE user_id = ?').get(userA).c;
    assert.strictEqual(countAfter20, 20);

    // Step B: Switch to 50
    // Should fetch 30 older emails, and skip 20 already present!
    const res50 = await request(app)
      .post('/api/emails/sync')
      .set('Cookie', `mailmind_session=${sessionA}`)
      .send({ batchSize: 50 });

    assert.strictEqual(res50.status, 200);
    assert.strictEqual(res50.body.usedBatchSize, 50);
    assert.strictEqual(res50.body.fetchedNew, 30);
    assert.strictEqual(res50.body.alreadyHad, 20);
    assert.strictEqual(res50.body.failed, 0);
    assert.strictEqual(res50.body.fetchedNew + res50.body.alreadyHad, 50);

    const countAfter50 = db.prepare('SELECT COUNT(*) as c FROM emails WHERE user_id = ?').get(userA).c;
    assert.strictEqual(countAfter50, 50);

    // Step C: Switch to 100
    // Should fetch 50 older emails, and skip 50 already present!
    const res100 = await request(app)
      .post('/api/emails/sync')
      .set('Cookie', `mailmind_session=${sessionA}`)
      .send({ batchSize: 100 });

    assert.strictEqual(res100.status, 200);
    assert.strictEqual(res100.body.usedBatchSize, 100);
    assert.strictEqual(res100.body.fetchedNew, 50);
    assert.strictEqual(res100.body.alreadyHad, 50);
    assert.strictEqual(res100.body.failed, 0);
    assert.strictEqual(res100.body.fetchedNew + res100.body.alreadyHad, 100);

    const countAfter100 = db.prepare('SELECT COUNT(*) as c FROM emails WHERE user_id = ?').get(userA).c;
    assert.strictEqual(countAfter100, 100);

    // Step D: Switch back to 20
    // All 20 are already in DB!
    const res20Again = await request(app)
      .post('/api/emails/sync')
      .set('Cookie', `mailmind_session=${sessionA}`)
      .send({ batchSize: 20 });

    assert.strictEqual(res20Again.status, 200);
    assert.strictEqual(res20Again.body.usedBatchSize, 20);
    assert.strictEqual(res20Again.body.fetchedNew, 0);
    assert.strictEqual(res20Again.body.alreadyHad, 20);
    assert.strictEqual(res20Again.body.failed, 0);
    // Total in DB should still be 100 (no emails deleted or lost)
    const countStill100 = db.prepare('SELECT COUNT(*) as c FROM emails WHERE user_id = ?').get(userA).c;
    assert.strictEqual(countStill100, 100);

    // Step E: Switch back to 100
    // All 100 are already in DB!
    const res100Again = await request(app)
      .post('/api/emails/sync')
      .set('Cookie', `mailmind_session=${sessionA}`)
      .send({ batchSize: 100 });

    assert.strictEqual(res100Again.status, 200);
    assert.strictEqual(res100Again.body.usedBatchSize, 100);
    assert.strictEqual(res100Again.body.fetchedNew, 0);
    assert.strictEqual(res100Again.body.alreadyHad, 100);
    assert.strictEqual(res100Again.body.failed, 0);
  });

  test('4. Pagination test: Sync 200 requests 2 pages of 100 from Gmail API', async () => {
    db.prepare('DELETE FROM emails WHERE user_id = ?').run(userB);

    const mockGmail = createMockGmailClient();
    setGmailClientFactory(() => mockGmail);

    const res200 = await request(app)
      .post('/api/emails/sync')
      .set('Cookie', `mailmind_session=${sessionB}`)
      .send({ batchSize: 200 });

    assert.strictEqual(res200.status, 200);
    assert.strictEqual(res200.body.usedBatchSize, 200);
    assert.strictEqual(res200.body.pages, 2); // 100 + 100
    assert.strictEqual(res200.body.fetchedNew, 200);
    assert.strictEqual(res200.body.alreadyHad, 0);

    const totalCount = db.prepare('SELECT COUNT(*) as c FROM emails WHERE user_id = ?').get(userB).c;
    assert.strictEqual(totalCount, 200);
  });

  test('5. Sync route rejects invalid batchSize with 400', async () => {
    const res = await request(app)
      .post('/api/emails/sync')
      .set('Cookie', `mailmind_session=${sessionA}`)
      .send({ batchSize: 999 });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.ok(res.body.error.includes('Allowed values'));
  });

  test('6. Backwards compatibility: preserves legacy response fields and accepts maxResults', async () => {
    const mockGmail = createMockGmailClient();
    setGmailClientFactory(() => mockGmail);

    const res = await request(app)
      .post('/api/emails/sync')
      .set('Cookie', `mailmind_session=${sessionA}`)
      .send({ maxResults: 20 });

    assert.strictEqual(res.status, 200);
    // Mandatory legacy fields
    assert.strictEqual(typeof res.body.success, 'boolean');
    assert.strictEqual(res.body.mode, 'LIVE');
    assert.strictEqual(typeof res.body.newEmailsCount, 'number');
    assert.strictEqual(typeof res.body.skippedDuplicates, 'number');
    assert.strictEqual(typeof res.body.sensitiveCount, 'number');
    assert.strictEqual(typeof res.body.aiProcessedCount, 'number');
    assert.strictEqual(typeof res.body.totalInbox, 'number');
    assert.strictEqual(typeof res.body.lastSyncedAt, 'string');
    // Additive fields
    assert.strictEqual(res.body.usedBatchSize, 20);
    assert.strictEqual(typeof res.body.fetchedNew, 'number');
    assert.strictEqual(typeof res.body.alreadyHad, 'number');
  });

  test('7. Resilience: Gmail 429 retries with backoff and single fetch failure does not crash sync', async () => {
    db.prepare('DELETE FROM emails WHERE user_id = ?').run(userA);

    // Mock client with 1 permanent error on msg_005 and 2 rate limits on msg_002
    const resilientMock = createMockGmailClient({
      failOnGetId: 'msg_005',
      rateLimitGetTimes: 2
    });
    setGmailClientFactory(() => resilientMock);

    const res = await request(app)
      .post('/api/emails/sync')
      .set('Cookie', `mailmind_session=${sessionA}`)
      .send({ batchSize: 20 });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    // 19 fetched, 1 failed
    assert.strictEqual(res.body.fetchedNew, 19);
    assert.strictEqual(res.body.failed, 1);
    assert.ok(res.body.stageErrors.length > 0);
    assert.ok(res.body.stageErrors[0].includes('msg_005'));
  });

  test('8. Resilience: Groq AI down/429 triggers fastClassifyEmail fallback with unclassified protection', async () => {
    db.prepare('DELETE FROM emails WHERE user_id = ?').run(userA);

    const mockGmail = createMockGmailClient();
    setGmailClientFactory(() => mockGmail);

    // Simulate Groq down or 429
    setLLMProvider({
      async chatCompletion() {
        const err = new Error('Groq 429: Rate limit exceeded');
        err.status = 429;
        throw err;
      },
      async scanPromptGuard() {
        return 0.0;
      }
    });

    const res = await request(app)
      .post('/api/emails/sync')
      .set('Cookie', `mailmind_session=${sessionA}`)
      .send({ batchSize: 20 });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.fetchedNew, 20);

    // Check emails in database: every email must have category, priority_score, summary, and tasks
    const stored = db.prepare('SELECT category, priority_score, summary FROM emails WHERE user_id = ?').all(userA);
    assert.strictEqual(stored.length, 20);
    stored.forEach(em => {
      assert.ok(em.category, 'Category must be assigned by fallback classifier');
      assert.ok(em.priority_score >= 1 && em.priority_score <= 5, 'Priority score must be 1-5');
      assert.ok(em.summary && em.summary.length > 0, 'Summary must not be empty');
    });
  });

  test('9. Sync status reporting: GET /api/emails/sync/status', async () => {
    const res = await request(app)
      .get('/api/emails/sync/status')
      .set('Cookie', `mailmind_session=${sessionA}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.status, 'done');
  });
});
