import { google } from 'googleapis';
import { db } from '../db/database.js';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
];

/**
 * Checks whether Google OAuth credentials are fully provided in .env
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

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/**
 * Generates the Google OAuth 2.0 authorization URL
 */
export function getAuthUrl() {
  if (!isOAuthConfigured()) {
    throw new Error('Google OAuth credentials are not configured. Please add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to server/.env');
  }

  const oauth2Client = createOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline', // Requests refresh_token
    prompt: 'consent',       // Forces approval screen to ensure refresh_token is returned
    scope: SCOPES,
    include_granted_scopes: true
  });
}

/**
 * Exchanges auth code for tokens and saves connected account to SQLite
 */
export async function handleOAuthCallback(code) {
  const oauth2Client = createOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  // Retrieve user's profile info
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

  // Upsert account in SQLite
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

  // Record activity log
  const logStmt = db.prepare(`
    INSERT INTO activity_logs (id, event_type, severity, message, metadata)
    VALUES (?, ?, ?, ?, ?)
  `);
  logStmt.run(
    'log_' + Date.now(),
    'OAUTH_CONNECTED',
    'INFO',
    `Successfully authenticated Gmail account: ${email}`,
    JSON.stringify({ accountId, email, name })
  );

  return { accountId, email, name, picture };
}

/**
 * Returns an authenticated OAuth2 client with auto token refresh for a given account
 */
export async function getAuthenticatedClient(accountId) {
  let account;
  if (accountId) {
    account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId);
  } else {
    // Get default first connected account
    account = db.prepare('SELECT * FROM accounts ORDER BY created_at DESC LIMIT 1').get();
  }

  if (!account) {
    throw new Error('No connected Google account found in database. Please connect your Gmail account.');
  }

  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    access_token: account.access_token,
    refresh_token: account.refresh_token,
    expiry_date: account.token_expiry
  });

  // Listen to token refresh events to persist fresh tokens
  oauth2Client.on('tokens', (newTokens) => {
    if (newTokens.access_token) {
      const updateStmt = db.prepare(`
        UPDATE accounts 
        SET access_token = ?, 
            token_expiry = ?,
            refresh_token = COALESCE(?, refresh_token)
        WHERE id = ?
      `);
      updateStmt.run(
        newTokens.access_token,
        newTokens.expiry_date || (Date.now() + 3600 * 1000),
        newTokens.refresh_token || null,
        account.id
      );
      console.log(`[OAuth Service] Refreshed access token persisted for ${account.email}`);
    }
  });

  return { oauth2Client, account };
}

/**
 * Retrieves the currently active connected Gmail account
 */
export function getActiveAccount() {
  return db.prepare(`
    SELECT id, email, name, picture, created_at, last_synced_at 
    FROM accounts 
    ORDER BY created_at DESC 
    LIMIT 1
  `).get() || null;
}

/**
 * Disconnects an account and removes from database
 */
export function disconnectAccount(accountId) {
  let target = null;
  if (accountId) {
    target = db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId);
  } else {
    target = db.prepare('SELECT * FROM accounts ORDER BY created_at DESC LIMIT 1').get();
  }

  if (!target) {
    return { success: false, message: 'Account not found' };
  }

  // Delete account (cascades emails if foreign key enabled, or deletes directly)
  db.prepare('DELETE FROM accounts WHERE id = ?').run(target.id);
  db.prepare('DELETE FROM emails WHERE account_id = ?').run(target.id);

  // Record activity log
  db.prepare(`
    INSERT INTO activity_logs (id, event_type, severity, message, metadata)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    'log_' + Date.now(),
    'OAUTH_DISCONNECTED',
    'WARNING',
    `Disconnected Gmail account: ${target.email}`,
    JSON.stringify({ accountId: target.id, email: target.email })
  );

  return { success: true, message: `Disconnected ${target.email}` };
}
