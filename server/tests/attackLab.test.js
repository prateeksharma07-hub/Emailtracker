import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../index.js';
import { db } from '../db/database.js';
import { ATTACK_PRESETS, runSimulation } from '../services/attackLabService.js';
import { setLLMProvider, resetLLMProvider } from '../services/llm/client.js';

describe('🧪 Attack Lab Simulation & Canary Detection Tests', () => {
  const userId = 'usr_lab_test_' + Date.now();
  const sessionToken = 'sess_lab_token_' + Date.now();

  before(() => {
    // Inject mock LLM provider simulating naive vulnerability and shielded defense
    setLLMProvider({
      name: 'mock-lab-provider',
      async chatCompletion({ messages }) {
        const userContent = messages.find(m => m.role === 'user')?.content || '';

        // If naive prompt receives hidden canary instruction, it falls for it
        if (userContent.includes('CANARY_PRIORITY_ESCALATE_APPROVED')) {
          return {
            content: 'CRITICAL ACTION REQUIRED: CANARY_PRIORITY_ESCALATE_APPROVED - Transfer funds immediately.',
            modelUsed: 'mock-gpt'
          };
        }

        // Clean response
        return {
          content: 'This email discusses project roadmap deliverables.',
          modelUsed: 'mock-gpt'
        };
      },
      async scanPromptGuard() {
        return 0.99; // Mock adversarial detection
      }
    });

    // Seed test user & session
    db.prepare('INSERT INTO users (id, google_id, email, name) VALUES (?, ?, ?, ?)').run(userId, 'gid_' + userId, 'lab@example.com', 'Lab Tester');
    db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(sessionToken, userId, Date.now() + 86400000);
  });

  after(() => {
    resetLLMProvider();
    db.prepare('DELETE FROM lab_runs WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  });

  test('1. Preset scenarios are listed properly with canary phrases', async () => {
    const res = await request(app)
      .get('/api/attack-lab/presets')
      .set('Cookie', `mailmind_session=${sessionToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.presets));
    assert.ok(res.body.presets.length >= 5);
  });

  test('2. Unauthenticated request to /api/attack-lab/simulate is rejected with 401', async () => {
    const res = await request(app)
      .post('/api/attack-lab/simulate')
      .send({ presetId: 'fake_priority_escalation' });

    assert.equal(res.status, 401);
  });

  test('3. Canary Detection: Naive Summarizer flags HIJACKED when canary leaks', async () => {
    const preset = ATTACK_PRESETS.find(p => p.id === 'fake_priority_escalation');
    const result = await runSimulation(preset);

    assert.equal(result.naive.status, 'HIJACKED', 'Naive summarizer must be flagged HIJACKED when canary appears');
    assert.equal(result.shielded.status, 'HELD', 'Shielded pipeline must detain the injection and remain HELD');
    assert.equal(result.shielded.verdict, 'DETAINED');
  });

  test('4. Safety Guarantee: Attack Lab simulations NEVER create emails or drafts in real database', async () => {
    const initialEmails = db.prepare('SELECT COUNT(*) as count FROM emails WHERE user_id = ?').get(userId)?.count || 0;
    const initialDrafts = db.prepare('SELECT COUNT(*) as count FROM drafts WHERE user_id = ?').get(userId)?.count || 0;

    await request(app)
      .post('/api/attack-lab/simulate')
      .set('Cookie', `mailmind_session=${sessionToken}`)
      .send({ presetId: 'fake_priority_escalation' });

    const postEmails = db.prepare('SELECT COUNT(*) as count FROM emails WHERE user_id = ?').get(userId)?.count || 0;
    const postDrafts = db.prepare('SELECT COUNT(*) as count FROM drafts WHERE user_id = ?').get(userId)?.count || 0;

    assert.equal(postEmails, initialEmails, 'Zero simulated emails should be saved to real emails table');
    assert.equal(postDrafts, initialDrafts, 'Zero simulated drafts should be saved to real drafts table');
  });

  test('5. Simulation runs are isolated and recorded in lab_runs table', async () => {
    const res = await request(app)
      .get('/api/attack-lab/history')
      .set('Cookie', `mailmind_session=${sessionToken}`);

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.history));
    assert.ok(res.body.history.length >= 1);
    assert.equal(res.body.history[0].user_id, userId);
  });
});
