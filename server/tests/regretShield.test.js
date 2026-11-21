import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { app } from '../index.js';
import { db } from '../db/database.js';
import { setLLMProvider, resetLLMProvider } from '../services/llm/client.js';
import { setGmailDraftSender, resetGmailDraftSender } from '../services/gmailService.js';
import { runDeterministicChecks } from '../services/regret/deterministicChecks.js';
import { evaluateDraft, computeDraftHash } from '../services/regret/regretShield.js';

describe('🛡️ Regret Shield Quality, Tone & Approval Gate Tests', () => {
  let userAId = 'usr_regret_a';
  let userBId = 'usr_regret_b';
  let sessionA = 'sess_regret_a';
  let sessionB = 'sess_regret_b';
  let draftAId = 'dft_regret_safe';
  let draftRiskId = 'dft_regret_risk';
  let emailAId = 'msg_regret_parent';

  before(() => {
    // Set mock Gmail draft sender to avoid external calls
    setGmailDraftSender(async () => ({ gmailDraftId: 'mock_gmail_draft_123' }));
    // Clean up test data
    db.prepare('DELETE FROM draft_checks WHERE user_id IN (?, ?)').run(userAId, userBId);
    db.prepare('DELETE FROM drafts WHERE user_id IN (?, ?)').run(userAId, userBId);
    db.prepare('DELETE FROM emails WHERE user_id IN (?, ?)').run(userAId, userBId);
    db.prepare('DELETE FROM sessions WHERE user_id IN (?, ?)').run(userAId, userBId);
    db.prepare('DELETE FROM users WHERE id IN (?, ?)').run(userAId, userBId);

    // Create User A and User B
    const insertUser = db.prepare(`
      INSERT INTO users (id, google_id, email, name, access_token_enc, refresh_token_enc)
      VALUES (?, ?, ?, ?, 'dummy_token', 'dummy_refresh')
    `);
    insertUser.run(userAId, 'gid_regret_a', 'alex.a@example.com', 'Alex A');
    insertUser.run(userBId, 'gid_regret_b', 'bob.b@example.com', 'Bob B');

    // Create Sessions
    const insertSession = db.prepare(`
      INSERT INTO sessions (id, user_id, expires_at)
      VALUES (?, ?, ?)
    `);
    insertSession.run(sessionA, userAId, Date.now() + 86400000);
    insertSession.run(sessionB, userBId, Date.now() + 86400000);

    // Create Parent Email for User A
    db.prepare(`
      INSERT INTO emails (
        id, user_id, thread_id, sender, sender_name, recipient, subject, body_text, snippet, date_received, is_read, is_sensitive, category, priority_score, shield_verdict
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, 'Work', 3, 'CLEARED')
    `).run(
      emailAId,
      userAId,
      'th_regret_parent',
      'sam.manager@example.com',
      'Sam Manager',
      'alex.a@example.com',
      'Project Deliverable Status',
      'Hi Alex, could you send over the final project metrics by tomorrow?',
      'Hi Alex, could you send over...',
      new Date().toISOString()
    );

    // Create Safe Draft for User A
    db.prepare(`
      INSERT INTO drafts (id, user_id, email_id, to_address, subject, reply_body, tone, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING_APPROVAL')
    `).run(
      draftAId,
      userAId,
      emailAId,
      'sam.manager@example.com',
      'Re: Project Deliverable Status',
      'Hi Sam, I have reviewed the requirements and will send the update shortly.',
      'Professional'
    );

    // Create High-Risk Draft for User A (contains placeholder and PAN number)
    db.prepare(`
      INSERT INTO drafts (id, user_id, email_id, to_address, subject, reply_body, tone, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING_APPROVAL')
    `).run(
      draftRiskId,
      userAId,
      emailAId,
      'sam.manager@example.com',
      'Re: Project Deliverable Status',
      'Hi Sam, please find attached the report. My PAN is ABCDE1234F. Signed [Your Name].',
      'Professional'
    );
  });

  after(() => {
    resetLLMProvider();
    resetGmailDraftSender();
    process.env.FEATURE_REGRET_SHIELD = 'true';
    db.prepare('DELETE FROM draft_checks WHERE user_id IN (?, ?)').run(userAId, userBId);
    db.prepare('DELETE FROM drafts WHERE user_id IN (?, ?)').run(userAId, userBId);
    db.prepare('DELETE FROM emails WHERE user_id IN (?, ?)').run(userAId, userBId);
    db.prepare('DELETE FROM sessions WHERE user_id IN (?, ?)').run(userAId, userBId);
    db.prepare('DELETE FROM users WHERE id IN (?, ?)').run(userAId, userBId);
  });

  test('1. Deterministic check flags attachment mentions in draft', () => {
    const text = 'Hi Sam, please find attached the spreadsheet for Q3 review.';
    const items = runDeterministicChecks(text, { toAddresses: ['sam@example.com'] });
    const match = items.find(it => it.type === 'attachment_mention');
    assert.ok(match, 'Should identify attachment mention');
    assert.strictEqual(match.severity, 'MEDIUM');
  });

  test('2. Deterministic check flags unfilled placeholders [Your Name], TODO, {{var}} with HIGH severity', () => {
    const text = 'Dear Sam, best regards, [Your Name]. TODO: finalize discount {{rate}}%.';
    const items = runDeterministicChecks(text, { toAddresses: ['sam@example.com'] });
    const placeholderItems = items.filter(it => it.type === 'unfilled_placeholder');
    assert.ok(placeholderItems.length >= 1, 'Should identify placeholder');
    assert.strictEqual(placeholderItems[0].severity, 'HIGH');
  });

  test('3. Deterministic check flags sensitive Indian credentials (PAN, Aadhaar, Bank A/C) with HIGH severity', () => {
    const panText = 'Please credit the refund to my account. My PAN is ABCDE1234F.';
    const panItems = runDeterministicChecks(panText, { toAddresses: ['support@example.com'] });
    const panFlag = panItems.find(it => it.type === 'outgoing_sensitive_data');
    assert.ok(panFlag, 'Should flag Indian PAN');
    assert.strictEqual(panFlag.severity, 'HIGH');
    assert.ok(!panFlag.excerpt.includes('ABCDE1234F'), 'Raw PAN should be masked in excerpt');

    const aadhaarText = 'My Aadhaar number for KYC is 3456 7890 1234.';
    const aadhaarItems = runDeterministicChecks(aadhaarText, { toAddresses: ['kyc@example.com'] });
    const aadhaarFlag = aadhaarItems.find(it => it.type === 'outgoing_sensitive_data');
    assert.ok(aadhaarFlag, 'Should flag Aadhaar number');
    assert.strictEqual(aadhaarFlag.severity, 'HIGH');
  });

  test('4. Deterministic check flags Reply-To domain mismatch and Reply-All risk', () => {
    const text = 'Understood, replying to all stakeholders.';
    const items = runDeterministicChecks(text, {
      fromAddress: 'billing@trustedbank.com',
      replyToAddress: 'attacker@evil-external.com',
      toAddresses: ['a@ex.com', 'b@ex.com', 'c@ex.com', 'd@ex.com', 'e@ex.com', 'f@ex.com']
    });
    const risks = items.filter(it => it.type === 'recipient_risk');
    assert.ok(risks.length >= 2, 'Should flag domain mismatch and Reply-All count > 5');
  });

  test('5. Mock LLM tone analyzer extracts tone risk, commitments and validates rewrite', async () => {
    // Mock tone provider
    setLLMProvider({
      chatCompletion: async () => JSON.stringify({
        risk_level: 'medium',
        flags: [
          { type: 'passive_aggressive', excerpt: 'As I already stated in my previous email', suggestion: 'Phrase more constructively' }
        ],
        commitments: ['Will deliver full API migration by Thursday 5 PM'],
        softer_rewrite: 'As mentioned earlier, I am on track to deliver the API migration by Thursday 5 PM.'
      }),
      scanPromptGuard: async () => ({ score: 0, is_injection: false })
    });

    const draft = 'As I already stated in my previous email, I will deliver full API migration by Thursday 5 PM.';
    const evalResult = await evaluateDraft({
      draftId: 'dft_test_tone',
      draftText: draft,
      userId: userAId,
      forceRecheck: true
    });

    assert.strictEqual(evalResult.severity, 'review');
    assert.strictEqual(evalResult.commitments.length, 1);
    assert.strictEqual(evalResult.commitments[0], 'Will deliver full API migration by Thursday 5 PM');
    assert.ok(evalResult.softerRewrite.includes('Thursday 5 PM'));
  });

  test('6. Fail-Safe: LLM timeout or error does NOT crash evaluation and deterministic checks still run', async () => {
    // Mock failure provider
    setLLMProvider({
      chatCompletion: async () => {
        throw new Error('Groq 503 Service Unavailable');
      },
      scanPromptGuard: async () => ({ score: 0, is_injection: false })
    });

    const draftWithPlaceholder = 'Hi Sam, please note [Your Name] will follow up.';
    const evalResult = await evaluateDraft({
      draftId: 'dft_fail_safe',
      draftText: draftWithPlaceholder,
      userId: userAId,
      forceRecheck: true
    });

    assert.strictEqual(evalResult.toneCheckAvailable, false);
    assert.strictEqual(evalResult.severity, 'high'); // Placeholder caught deterministically
    assert.ok(evalResult.items.some(it => it.type === 'unfilled_placeholder'));
  });

  test('7. API Gate: Unauthenticated request to /api/drafts/:id/check returns 401', async () => {
    const res = await request(app)
      .post(`/api/drafts/${draftAId}/check`)
      .send({ text: 'Hello' });
    assert.strictEqual(res.status, 401);
  });

  test('8. IDOR Prevention: User B checking User A draft returns 404', async () => {
    const res = await request(app)
      .post(`/api/drafts/${draftAId}/check`)
      .set('Cookie', [`mailmind_session=${sessionB}`])
      .send({ text: 'Testing cross-user check' });
    assert.strictEqual(res.status, 404);
  });

  test('9. Approval Gate: High-risk draft without acknowledged:true returns 409 Conflict', async () => {
    // Reset mock to deterministic pass for tone, but draft text has placeholder
    setLLMProvider({
      chatCompletion: async () => JSON.stringify({ risk_level: 'low', flags: [], commitments: [], softer_rewrite: null }),
      scanPromptGuard: async () => ({ score: 0, is_injection: false })
    });

    const res = await request(app)
      .post(`/api/drafts/${draftRiskId}/approve`)
      .set('Cookie', [`mailmind_session=${sessionA}`])
      .send({
        confirmHumanApproval: true,
        acknowledged: false
      });

    assert.strictEqual(res.status, 409);
    assert.strictEqual(res.body.error, 'REGRET_SHIELD_HIGH_RISK');
    assert.ok(res.body.regretCheck?.items?.length > 0);
  });

  test('10. Approval Gate: High-risk draft with acknowledged:true successfully approves and pushes to Gmail', async () => {
    const res = await request(app)
      .post(`/api/drafts/${draftRiskId}/approve`)
      .set('Cookie', [`mailmind_session=${sessionA}`])
      .send({
        confirmHumanApproval: true,
        acknowledged: true
      });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);

    // Verify draft_checks table recorded acknowledged_at
    const checkRow = db.prepare('SELECT * FROM draft_checks WHERE draft_id = ? AND user_id = ?').get(draftRiskId, userAId);
    assert.ok(checkRow, 'draft_checks row should be recorded');
    assert.ok(checkRow.acknowledged_at !== null, 'acknowledged_at should be populated');
  });

  test('11. Feature Flag: When FEATURE_REGRET_SHIELD=false, approval succeeds without 409 even on high-risk draft', async () => {
    process.env.FEATURE_REGRET_SHIELD = 'false';

    const unacknowledgedDraftId = 'dft_unack_risk';
    db.prepare(`
      INSERT INTO drafts (id, user_id, email_id, to_address, subject, reply_body, status)
      VALUES (?, ?, ?, ?, ?, ?, 'PENDING_APPROVAL')
    `).run(
      unacknowledgedDraftId,
      userAId,
      emailAId,
      'sam@example.com',
      'Re: High Risk',
      'Unchecked placeholder [Your Name] with sensitive PAN ABCDE1234F'
    );

    const res = await request(app)
      .post(`/api/drafts/${unacknowledgedDraftId}/approve`)
      .set('Cookie', [`mailmind_session=${sessionA}`])
      .send({
        confirmHumanApproval: true,
        acknowledged: false
      });

    // Should succeed because feature flag disabled the gate
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);

    // Restore feature flag
    process.env.FEATURE_REGRET_SHIELD = 'true';
  });
});
