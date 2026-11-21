import { google } from 'googleapis';
import crypto from 'node:crypto';
import { db } from '../db/database.js';
import { encryptToken, decryptToken } from './cryptoService.js';

/**
 * MINIMUM PERMISSIONS SCOPES (MULTI-USER PRIVACY COMPLIANT)
 * - Reading Gmail messages: https://www.googleapis.com/auth/gmail.readonly
 * - Creating Gmail drafts: https://www.googleapis.com/auth/gmail.compose
 * - User Profile info: userinfo.email, userinfo.profile
 */
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
];

/**
 * Checks whether Google OAuth credentials are provided in environment
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
    prompt: 'consent',       // Forces approval screen to guarantee fresh refresh_token
    scope: SCOPES,
    state,
    include_granted_scopes: true
  });

  return { url, state };
}

/**
 * Creates a 7-day session for a user in the `sessions` table
 */
export function createUserSession(userId) {
  const sessionId = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days

  db.prepare(`
    INSERT INTO sessions (id, user_id, expires_at)
    VALUES (?, ?, ?)
  `).run(sessionId, userId, expiresAt);

  return { sessionId, expiresAt };
}

/**
 * Destroys a session from database
 */
export function destroySession(sessionId) {
  if (!sessionId) return;
  db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
}

/**
 * Handles OAuth 2.0 callback:
 * 1. Validates CSRF state
 * 2. Exchanges code for Google tokens
 * 3. Fetches userinfo
 * 4. Encrypts tokens with AES-256-GCM
 * 5. Upserts user in SQLite `users` table
 * 6. Creates a 7-day session
 * 
 * TOKENS ARE NEVER LOGGED, NEVER SENT TO FRONTEND, AND NEVER STORED IN PLAINTEXT.
 */
export async function handleOAuthCallback(code, state) {
  // 1. CSRF validation
  const isValidState = validateOAuthState(state);
  if (!isValidState) {
    const err = new Error('CSRF validation failed: Invalid or expired OAuth state parameter.');
    err.code = 'CSRF_INVALID';
    throw err;
  }

  // 2. Token exchange
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

  // 3. Userinfo retrieval
  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const profileRes = await oauth2.userinfo.get();
  const profile = profileRes.data;

  const googleId = profile.id;
  const email = profile.email;
  const name = profile.name || email.split('@')[0];
  const picture = profile.picture || null;
  const tokenExpiry = tokens.expiry_date || (Date.now() + 3600 * 1000);

  // 4. AES-256-GCM token encryption
  const accessTokenEnc = encryptToken(tokens.access_token);
  const refreshTokenEnc = tokens.refresh_token ? encryptToken(tokens.refresh_token) : null;

  // 5. Upsert user in `users` table
  let existingUser = db.prepare('SELECT id, refresh_token_enc FROM users WHERE google_id = ? OR email = ?').get(googleId, email);
  let userId;

  if (existingUser) {
    userId = existingUser.id;
    // Keep existing refresh_token if Google did not return a new one this time
    const updatedRefreshEnc = refreshTokenEnc || existingUser.refresh_token_enc;

    db.prepare(`
      UPDATE users 
      SET google_id = ?,
          email = ?,
          name = ?,
          picture = ?,
          access_token_enc = ?,
          refresh_token_enc = ?,
          token_expiry = ?
      WHERE id = ?
    `).run(googleId, email, name, picture, accessTokenEnc, updatedRefreshEnc, tokenExpiry, userId);
  } else {
    userId = 'usr_' + crypto.randomBytes(8).toString('hex');
    db.prepare(`
      INSERT INTO users (id, google_id, email, name, picture, access_token_enc, refresh_token_enc, token_expiry)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(userId, googleId, email, name, picture, accessTokenEnc, refreshTokenEnc, tokenExpiry);
  }

  // 6. Issue 7-day session
  const { sessionId, expiresAt } = createUserSession(userId);

  // 7. Safe audit log
  db.prepare(`
    INSERT INTO activity_logs (id, user_id, event_type, severity, message, metadata)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    'log_' + Date.now(),
    userId,
    'OAUTH_CONNECTED',
    'INFO',
    `Authenticated user via Google OAuth: ${email}`,
    JSON.stringify({ userId, email, name })
  );

  return {
    user: {
      id: userId,
      google_id: googleId,
      email,
      name,
      picture
    },
    sessionId,
    expiresAt
  };
}

/**
 * Returns an authenticated OAuth2 client with auto-refresh configured for a specific user.
 * Decrypts tokens in-memory and re-encrypts updated tokens upon automatic refresh.
 */
export async function getAuthenticatedClientForUser(userId) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) {
    const err = new Error('User not found.');
    err.code = 'USER_NOT_FOUND';
    throw err;
  }

  const plainAccessToken = decryptToken(user.access_token_enc);
  const plainRefreshToken = decryptToken(user.refresh_token_enc);

  if (!plainAccessToken && !plainRefreshToken) {
    const err = new Error('User has no valid Google authentication tokens. Please reconnect your Gmail account.');
    err.code = 'TOKEN_EXPIRED';
    throw err;
  }

  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    access_token: plainAccessToken,
    refresh_token: plainRefreshToken,
    expiry_date: user.token_expiry
  });

  // Listen for auto-refresh events: persist re-encrypted tokens
  oauth2Client.on('tokens', (newTokens) => {
    try {
      const newAccessEnc = newTokens.access_token ? encryptToken(newTokens.access_token) : null;
      const newRefreshEnc = newTokens.refresh_token ? encryptToken(newTokens.refresh_token) : null;
      const newExpiry = newTokens.expiry_date || (Date.now() + 3600 * 1000);

      if (newAccessEnc && newRefreshEnc) {
        db.prepare(`
          UPDATE users 
          SET access_token_enc = ?, 
              refresh_token_enc = ?, 
              token_expiry = ? 
          WHERE id = ?
        `).run(newAccessEnc, newRefreshEnc, newExpiry, userId);
      } else if (newAccessEnc) {
        db.prepare(`
          UPDATE users 
          SET access_token_enc = ?, 
              token_expiry = ? 
          WHERE id = ?
        `).run(newAccessEnc, newExpiry, userId);
      }
    } catch (persistErr) {
      console.error('[OAuth Refresh Persist Error]', persistErr.message);
    }
  });

  return { oauth2Client, user };
}

/**
 * Permanently deletes all data and revokes Google OAuth token for a user.
 */
export async function deleteUserAndData(userId) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) {
    return { success: false, message: 'User not found.' };
  }

  // Attempt Google token revocation
  const plainAccessToken = decryptToken(user.access_token_enc);
  if (plainAccessToken && isOAuthConfigured()) {
    try {
      const oauth2Client = createOAuth2Client();
      oauth2Client.setCredentials({ access_token: plainAccessToken });
      await oauth2Client.revokeToken(plainAccessToken);
    } catch (revokeErr) {
      console.warn('[OAuth Service] Google token revocation notice:', revokeErr.message);
    }
  }

  // Strictly wipe all user-associated records
  db.prepare('DELETE FROM shield_scans WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM lab_runs WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM drafts WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM tasks WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM emails WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM activity_logs WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);

  return {
    success: true,
    message: `Account and all associated email intelligence data for ${user.email} have been permanently deleted.`
  };
}
