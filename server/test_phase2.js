import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

import { initDb, db } from './db/database.js';
import { 
  isOAuthConfigured, 
  generateOAuthState, 
  validateOAuthState, 
  getAuthUrl, 
  getActiveAccount, 
  disconnectAccount, 
  getAuthenticatedClient 
} from './services/oauthService.js';
import { syncGmailInbox, seedDemoEmails } from './services/gmailService.js';
import { analyzeSensitivity } from './services/sanitizationService.js';

initDb();

async function runPhase2Tests() {
  console.log('========================================================');
  console.log('🧪 MAILMIND AI — PHASE 2 VERIFICATION TEST SUITE');
  console.log('========================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${message}`);
    }
  }

  // TEST 1: OAuth Configuration Check
  console.log('--- TEST 1: Google OAuth Configuration Diagnostics ---');
  const configured = isOAuthConfigured();
  console.log(`OAuth configured status: ${configured}`);
  console.log(`GOOGLE_CLIENT_ID configured: ${Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID !== 'your_google_client_id_here')}`);
  console.log(`GOOGLE_CLIENT_SECRET configured: ${Boolean(process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_CLIENT_SECRET !== 'your_google_client_secret_here')}`);
  assert(typeof configured === 'boolean', 'isOAuthConfigured returns valid boolean state');

  // TEST 2: CSRF State Parameter Generation & Single-Use Burning
  console.log('\n--- TEST 2: CSRF State Parameter Validation ---');
  const state1 = generateOAuthState();
  assert(typeof state1 === 'string' && state1.length === 64, 'Generated cryptographically secure 64-char hex state');
  
  const inDb = db.prepare('SELECT state FROM oauth_states WHERE state = ?').get(state1);
  assert(inDb && inDb.state === state1, 'OAuth state persisted in SQLite oauth_states table');

  const isValidFirstTime = validateOAuthState(state1);
  assert(isValidFirstTime === true, 'OAuth state verified successfully on first check');

  const isReused = validateOAuthState(state1);
  assert(isReused === false, 'OAuth state consumed and rejected on second check (Replay/CSRF protection)');

  const fakeState = validateOAuthState('forged_fake_state_123456');
  assert(fakeState === false, 'Forged/unknown OAuth state correctly rejected');

  // TEST 3: Minimum Permissions Scope Verification
  console.log('\n--- TEST 3: Minimum Permissions & Scope Policy ---');
  // Temporarily mock credentials to test getAuthUrl if not configured
  const origId = process.env.GOOGLE_CLIENT_ID;
  const origSecret = process.env.GOOGLE_CLIENT_SECRET;
  process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
  process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';

  try {
    const { url, state } = getAuthUrl();
    assert(Boolean(url && state), 'getAuthUrl generates valid authorization URL');
    assert(url.includes('gmail.readonly'), 'Contains gmail.readonly scope');
    assert(url.includes('gmail.compose'), 'Contains gmail.compose scope (for drafts)');
    assert(!url.includes('gmail.send'), 'Strict Minimum Scope: DOES NOT request gmail.send');
    assert(url.includes('access_type=offline'), 'Requests offline access for refresh_token');
    assert(url.includes('prompt=consent'), 'Prompts for consent to guarantee refresh_token');
    assert(url.includes(`state=${state}`), 'Authorization URL includes CSRF state parameter');
  } finally {
    process.env.GOOGLE_CLIENT_ID = origId;
    process.env.GOOGLE_CLIENT_SECRET = origSecret;
  }

  // TEST 4: Zero Token Leakage in Active Account
  console.log('\n--- TEST 4: Zero Token Exposure Security Check ---');
  // Seed demo account
  await seedDemoEmails();
  const activeAcc = getActiveAccount();
  assert(activeAcc !== null, 'Active account loaded');
  assert(activeAcc.email !== undefined, 'Account email present');
  assert(activeAcc.access_token === undefined, 'SECURITY: access_token is NOT exposed in getActiveAccount()');
  assert(activeAcc.refresh_token === undefined, 'SECURITY: refresh_token is NOT exposed in getActiveAccount()');
  assert(activeAcc.is_demo === true, 'Demo mode account flagged correctly');

  // TEST 5: Duplicate Prevention
  console.log('\n--- TEST 5: Duplicate Message Prevention ---');
  const countBefore = db.prepare('SELECT COUNT(*) as c FROM emails WHERE account_id = ?').get(activeAcc.id)?.c || 0;
  // Re-seed should not create duplicates
  const seedRes2 = await seedDemoEmails();
  const countAfter = db.prepare('SELECT COUNT(*) as c FROM emails WHERE account_id = ?').get(activeAcc.id)?.c || 0;
  assert(countBefore === countAfter, `Duplicate emails prevented (Count before: ${countBefore}, Count after: ${countAfter})`);

  // TEST 6: Sensitive Email Sanitization (Zero-Leak)
  console.log('\n--- TEST 6: Sensitive Email Sanitization ---');
  const otpCheck = analyzeSensitivity('Security Alert', 'Your one-time passcode is 492019 to verify login.');
  assert(otpCheck.isSensitive === true && otpCheck.sensitiveType === 'OTP', 'OTP detected and flagged for local shielding');

  const cardCheck = analyzeSensitivity('Invoice', 'Card charged: 4532 8920 1920 4821 Exp 08/28');
  assert(cardCheck.isSensitive === true && cardCheck.sensitiveType === 'CREDIT_CARD', 'Credit card detected and flagged for local shielding');

  const normalCheck = analyzeSensitivity('Team Standup', 'Hey Alex, our weekly sprint sync is tomorrow at 10 AM.');
  assert(normalCheck.isSensitive === false, 'Normal business email allowed through for AI intelligence');

  // TEST 7: Expired / Revoked Token Handling
  console.log('\n--- TEST 7: Expired & Revoked Token Resilience ---');
  // Insert a test account with an expired mock token
  db.prepare(`
    INSERT OR REPLACE INTO accounts (id, email, name, access_token, refresh_token, token_expiry)
    VALUES ('expired_test_acc', 'expired@example.com', 'Expired User', 'revoked_token', 'bad_refresh', 1000)
  `).run();

  try {
    // When sync is attempted with an invalid/revoked token:
    process.env.GOOGLE_CLIENT_ID = 'test-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
    await syncGmailInbox('expired_test_acc');
    assert(false, 'Should have thrown TOKEN_EXPIRED error');
  } catch (err) {
    assert(err.code === 'TOKEN_EXPIRED' || err.message?.includes('invalid') || err.message?.includes('Token') || err.message?.includes('No connected'), `Handled expired/revoked token gracefully (${err.message})`);
  } finally {
    process.env.GOOGLE_CLIENT_ID = origId;
    process.env.GOOGLE_CLIENT_SECRET = origSecret;
    db.prepare('DELETE FROM accounts WHERE id = ?').run('expired_test_acc');
  }

  // TEST 8: Disconnect Account
  console.log('\n--- TEST 8: Disconnect Account & Cascade Cleanup ---');
  const disconnectRes = await disconnectAccount(activeAcc.id);
  assert(disconnectRes.success === true, 'Account successfully disconnected');
  const accAfter = db.prepare('SELECT id FROM accounts WHERE id = ?').get(activeAcc.id);
  assert(!accAfter, 'Account deleted from accounts table');
  const emailsAfter = db.prepare('SELECT COUNT(*) as c FROM emails WHERE account_id = ?').get(activeAcc.id)?.c || 0;
  assert(emailsAfter === 0, 'Associated emails cascade deleted on disconnect');

  // Restore demo emails so workspace has test data ready
  await seedDemoEmails();

  console.log('\n========================================================');
  console.log(`🎯 TEST SUMMARY: ${passed} / ${total} tests passed (${Math.round((passed / total) * 100)}%)`);
  console.log('========================================================\n');
}

runPhase2Tests().catch(console.error);
