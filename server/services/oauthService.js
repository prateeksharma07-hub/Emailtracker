import { google } from 'googleapis';
import crypto from 'node:crypto';
import { db } from '../db/database.js';

/**
 * MINIMUM PERMISSIONS SCOPES (PHASE 2 COMPLIANT)
 * - Reading Gmail messages: https://www.googleapis.com/auth/gmail.readonly
 * - Creating Gmail drafts: https://www.googleapis.com/auth/gmail.compose
 * - User Profile info: userinfo.email, userinfo.profile
 * 
 * STRICT PRIVACY REQUIREMENT:
 * - NO https://www.googleapis.com/auth/gmail.send
 * - NO automatic deletion, archiving, or forwarding.
 */
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
];

/**
 * Checks whether Google OAuth credentials are provided in .env
 */
export function isOAuthConfigured() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  return Boolean(
    clientId &&
    clientId.trim() !== '' &&
    clientId !== 'your_google_client_id_here' &&
    clientSecret &&
    clientSecret.trim() !== '' &&
    clientSecret !== 'your_google_client_secret_here'
  );
}

/**
 * Creates a raw Google OAuth2 client instance
 */
export function createOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5001/api/auth/callback';

  if (!isOAuthConfigured()) {
    throw new Error('Google OAuth credentials are not configured. Please add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to server/.env');
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/**
 * Generates and stores a cryptographically secure OAuth state parameter
 * to protect against Cross-Site Request Forgery (CSRF).
 */
export function generateOAuthState() {
  // Purge states older than 15 minutes (TTL)
  const fifteenMinutesAgo = Date.now() - 15 * 60 * 1000;
  db.prepare('DELETE FROM oauth_states WHERE created_at < ?').run(fifteenMinutesAgo);

  const state = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO oauth_states (state, created_at) VALUES (?, ?)').run(state, Date.now());
  return state;
}

/**
 * Validates and consumes an OAuth state parameter (single-use)
 */
export function validateOAuthState(state) {
  if (!state || typeof state !== 'string') return false;

  const record = db.prepare('SELECT state, created_at FROM oauth_states WHERE state = ?').get(state);
  if (!record) return false;

  // Single-use: delete immediately
  db.prepare('DELETE FROM oauth_states WHERE state = ?').run(state);

  // Check TTL (15 minutes)
  const isExpired = Date.now() - record.created_at > 15 * 60 * 1000;
  return !isExpired;
}

/**
 * Generates the Google OAuth 2.0 authorization URL with CSRF protection
 */
export function getAuthUrl() {
  const oauth2Client = createOAuth2Client();
  const state = generateOAuthState();

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline', // Requests refresh_token
    prompt: 'consent',       // Forces approval screen to ensure fresh refresh_token
    scope: SCOPES,
    state,
    include_granted_scopes: true
  });

  return { url, state };
}

/**
 * Handles OAuth 2.0 callback, exchanges authorization code for tokens,
 * validates user profile and persists account in SQLite.
 * 
 * TOKENS ARE NEVER LOGGED OR EXPOSED TO THE FRONTEND.
 */
export async function handleOAuthCallback(code, state) {
  // 1. CSRF Protection Check
  const isValidState = validateOAuthState(state);
  if (!isValidState) {
    const err = new Error('CSRF validation failed: Invalid or expired OAuth state parameter.');
    err.code = 'CSRF_INVALID';
    throw err;
  }

  // 2. Token Exchange
  const oauth2Client = createOAuth2Client();
  let tokens;
  try {
    const tokenRes = await oauth2Client.getToken(code);
    tokens = tokenRes.tokens;
  } catch (exchangeErr) {
    console.error('[OAuth Error] Failed to exchange code for tokens:', exchangeErr.message);
    const err = new Error('Failed to exchange authorization code for tokens with Google.');
    err.code = exchangeErr.code || 'TOKEN_EXCHANGE_FAILED';
    throw err;
  }

  oauth2Client.setCredentials(tokens);

  // 3. Retrieve user profile info
  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const profileRes = await oauth2.userinfo.get();
  const profile = profileRes.data;

  const accountId = profile.id || 'acc_' + Date.now();
  const email = profile.email;
  const name = profile.name || email.split('@')[0];
  const picture = profile.picture || null;
  const accessToken = tokens.access_token;
  const refreshToken = tokens.refresh_token || null;
  const tokenExpiry = tokens.expiry_date || (Date.now() + 3600 * 1000);
  const scope = tokens.scope || SCOPES.join(' ');

  // 4. Upsert account in local SQLite
  const stmt = db.prepare(`
    INSERT INTO accounts (id, email, name, picture, access_token, refresh_token, token_expiry, scope, last_synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(email) DO UPDATE SET
      name = excluded.name,
      picture = excluded.picture,
      access_token = excluded.access_token,
      refresh_token = COALESCE(excluded.refresh_token, accounts.refresh_token),
      token_expiry = excluded.token_expiry,
      scope = excluded.scope
  `);

  stmt.run(accountId, email, name, picture, accessToken, refreshToken, tokenExpiry, scope);

  // 5. Clean up demo account so live user sees ONLY their real inbox
  try {
    db.prepare("DELETE FROM accounts WHERE id = 'demo_account'").run();
    db.prepare("DELETE FROM emails WHERE account_id = 'demo_account'").run();
    db.prepare("DELETE FROM tasks WHERE email_id NOT IN (SELECT id FROM emails)").run();
    db.prepare("DELETE FROM drafts WHERE email_id NOT IN (SELECT id FROM emails)").run();
  } catch (cleanErr) {
    console.warn('[OAuth] Demo cleanup notice:', cleanErr.message);
  }

  // 6. Record activity log without exposing sensitive tokens
  db.prepare(`
    INSERT INTO activity_logs (id, event_type, severity, message, metadata)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    'log_' + Date.now(),
    'OAUTH_CONNECTED',
    'INFO',
    `Successfully authenticated live Gmail account: ${email}`,
    JSON.stringify({ accountId, email, name })
  );

  return {
    accountId,
    email,
    name,
    picture,
    is_demo: false
  };
}

/**
 * Returns an authenticated OAuth2 client with auto token refresh for a given account.
 * Handles expired and revoked tokens safely.
 */
export async function getAuthenticatedClient(accountId) {
  let account;
  if (accountId) {
    account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId);
  } else {
    account = db.prepare('SELECT * FROM accounts ORDER BY created_at DESC LIMIT 1').get();
  }

  if (!account) {
    const err = new Error('No connected Google account found in database. Please connect your Gmail account.');
    err.code = 'NO_ACCOUNT';
    throw err;
  }

  // Handle Demo Account
  if (account.id === 'demo_account' || account.access_token === 'mock_token') {
    return { oauth2Client: null, account, isDemo: true };
  }

  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    access_token: account.access_token,
    refresh_token: account.refresh_token,
    expiry_date: account.token_expiry
  });

  // Persist auto-refreshed access tokens
  oauth2Client.on('tokens', (newTokens) => {
    if (newTokens.access_token) {
      db.prepare(`
        UPDATE accounts 
        SET access_token = ?, 
            token_expiry = ?,
            refresh_token = COALESCE(?, refresh_token)
        WHERE id = ?
      `).run(
        newTokens.access_token,
        newTokens.expiry_date || (Date.now() + 3600 * 1000),
        newTokens.refresh_token || null,
        account.id
      );
    }
  });

  return { oauth2Client, account, isDemo: false };
}

/**
 * Retrieves the currently active connected Gmail account.
 * NEVER returns access_token or refresh_token to callers or the frontend.
 */
export function getActiveAccount() {
  // Prioritize real connected Gmail accounts over demo_account
  const row = db.prepare(`
    SELECT id, email, name, picture, created_at, last_synced_at, access_token 
    FROM accounts 
    ORDER BY CASE WHEN id = 'demo_account' THEN 1 ELSE 0 END, created_at DESC 
    LIMIT 1
  `).get();

  if (!row) return null;

  const isDemo = row.id === 'demo_account' || row.access_token === 'mock_token';

  // Sanitize: strip tokens
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    picture: row.picture,
    created_at: row.created_at,
    last_synced_at: row.last_synced_at,
    is_demo: isDemo
  };
}

/**
 * Disconnects an account, attempts token revocation with Google,
 * and removes credentials and records from local SQLite.
 */
export async function disconnectAccount(accountId) {
  let target = null;
  if (accountId) {
    target = db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId);
  } else {
    target = db.prepare('SELECT * FROM accounts ORDER BY created_at DESC LIMIT 1').get();
  }

  if (!target) {
    return { success: false, message: 'No connected account to disconnect.' };
  }

  // Attempt Google token revocation if real credentials exist
  if (target.access_token && target.access_token !== 'mock_token' && isOAuthConfigured()) {
    try {
      const oauth2Client = createOAuth2Client();
      oauth2Client.setCredentials({ access_token: target.access_token });
      await oauth2Client.revokeToken(target.access_token);
    } catch (revokeErr) {
      console.warn('[OAuth Service] Token revocation with Google completed with note:', revokeErr.message);
    }
  }

  // Delete associated records first, then emails and accounts to preserve integrity
  db.prepare('DELETE FROM drafts WHERE email_id IN (SELECT id FROM emails WHERE account_id = ?)').run(target.id);
  db.prepare('DELETE FROM tasks WHERE email_id IN (SELECT id FROM emails WHERE account_id = ?)').run(target.id);
  db.prepare('DELETE FROM emails WHERE account_id = ?').run(target.id);
  db.prepare('DELETE FROM accounts WHERE id = ?').run(target.id);

  // Log disconnect
  db.prepare(`
    INSERT INTO activity_logs (id, event_type, severity, message, metadata)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    'log_' + Date.now(),
    'OAUTH_DISCONNECTED',
    'INFO',
    `Disconnected account: ${target.email}`,
    JSON.stringify({ accountId: target.id, email: target.email })
  );

  return { success: true, message: `Successfully disconnected ${target.email}.` };
}
