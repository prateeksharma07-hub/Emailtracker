import express from 'express';
import rateLimit from 'express-rate-limit';
import { 
  getAuthUrl, 
  handleOAuthCallback, 
  destroySession, 
  deleteUserAndData,
  isOAuthConfigured 
} from '../services/oauthService.js';
import { syncGmailInbox } from '../services/gmailService.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { db } from '../db/database.js';

const router = express.Router();

// Rate limiting for auth routes: max 30 requests per 15 minutes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { success: false, error: 'Too many authentication attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

router.use(authLimiter);

/**
 * Cookie configuration for 7-day session
 */
export const getCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/'
});

export const getClearCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/'
});

/**
 * GET /api/auth/google
 * Initiates Google OAuth flow: redirects to Google consent screen
 */
router.get('/google', (req, res) => {
  try {
    const { url } = getAuthUrl();
    res.redirect(url);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/auth/url
 * API endpoint to get Google OAuth URL for frontend popups/redirects
 */
router.get('/url', (req, res) => {
  try {
    const { url, state } = getAuthUrl();
    res.json({ success: true, url, state });
  } catch (err) {
    res.status(400).json({ 
      success: false, 
      error: err.message,
      configured: isOAuthConfigured()
    });
  }
});

/**
 * GET /api/auth/callback
 * OAuth callback handler: exchanges authorization code, upserts user,
 * sets httpOnly 7-day session cookie, pre-fetches initial emails, and redirects to client.
 */
router.get('/callback', async (req, res) => {
  const { code, state, error, error_description } = req.query;
  const clientUrl = process.env.APP_URL || process.env.CLIENT_URL || 'http://localhost:5174';

  if (error) {
    console.warn('[OAuth Callback] Google authorization error:', error, error_description || '');
    const userMessage = error === 'access_denied' 
      ? 'Gmail authorization was canceled or denied.' 
      : error_description || error;
    return res.redirect(`${clientUrl}?auth_error=${encodeURIComponent(userMessage)}`);
  }

  if (!code) {
    return res.redirect(`${clientUrl}?auth_error=missing_authorization_code`);
  }

  if (!state) {
    return res.redirect(`${clientUrl}?auth_error=csrf_validation_failed`);
  }

  try {
    const authResult = await handleOAuthCallback(code, state);
    const { user, sessionId } = authResult;

    // Set 7-day httpOnly session cookie
    res.cookie('mailmind_session', sessionId, getCookieOptions());

    // Pre-populate inbox with initial 30 emails to avoid empty inbox race
    try {
      await syncGmailInbox(user.id, { maxResults: 30 });
    } catch (syncErr) {
      console.warn('[Initial Sync Notice]', syncErr.message);
    }

    res.redirect(`${clientUrl}?auth=success&account=${encodeURIComponent(user.email)}`);
  } catch (err) {
    console.error('[OAuth Callback Error]', err.message);
    res.redirect(`${clientUrl}?auth_error=${encodeURIComponent(err.message)}`);
  }
});

/**
 * GET /api/auth/me
 * Returns the currently authenticated user profile from active session.
 * NO sensitive tokens are ever returned.
 */
router.get('/me', (req, res) => {
  try {
    const sessionToken = req.cookies?.mailmind_session || 
      (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7).trim() : null);

    if (!sessionToken) {
      return res.status(401).json({ success: false, authenticated: false, user: null });
    }

    const session = db.prepare('SELECT user_id, expires_at FROM sessions WHERE id = ?').get(sessionToken);
    if (!session || session.expires_at < Date.now()) {
      if (session) db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionToken);
      res.clearCookie('mailmind_session', { path: '/' });
      return res.status(401).json({ success: false, authenticated: false, user: null });
    }

    const user = db.prepare(`
      SELECT id, google_id, email, name, picture, token_expiry, created_at, last_sync_at
      FROM users WHERE id = ?
    `).get(session.user_id);

    if (!user) {
      db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionToken);
      res.clearCookie('mailmind_session', getClearCookieOptions());
      return res.status(401).json({ success: false, authenticated: false, user: null });
    }

    res.json({
      success: true,
      authenticated: true,
      user
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/auth/status
 * Backwards compatibility for status inspection & AI config
 */
router.get('/status', (req, res) => {
  try {
    const sessionToken = req.cookies?.mailmind_session || 
      (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7).trim() : null);

    let user = null;
    if (sessionToken) {
      const session = db.prepare('SELECT user_id, expires_at FROM sessions WHERE id = ?').get(sessionToken);
      if (session && session.expires_at >= Date.now()) {
        user = db.prepare(`
          SELECT id, google_id, email, name, picture, token_expiry, created_at, last_sync_at
          FROM users WHERE id = ?
        `).get(session.user_id);
      }
    }

    const isGoogleConfigured = isOAuthConfigured();
    const isAIActive = Boolean(process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.startsWith('gsk_'));

    res.json({
      success: true,
      authenticated: Boolean(user),
      user: user || null,
      account: user ? {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        created_at: user.created_at,
        last_synced_at: user.last_sync_at,
        is_demo: false
      } : null,
      config: {
        oauthConfigured: isGoogleConfigured,
        aiActive: isAIActive,
        geminiActive: isAIActive,
        aiProvider: 'Groq LPU (Ultra-Fast)',
        redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5001/api/auth/callback'
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/auth/logout
 * Logs out user: removes session from database and clears session cookie.
 */
router.post('/logout', (req, res) => {
  try {
    const sessionToken = req.cookies?.mailmind_session || 
      (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7).trim() : null);

    if (sessionToken) {
      destroySession(sessionToken);
    }
    res.clearCookie('mailmind_session', getClearCookieOptions());
    res.json({ success: true, message: 'Logged out successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/auth/me
 * Disconnect & delete my data:
 * Revokes Google token, deletes all user emails, tasks, drafts, logs, and user row.
 */
router.delete('/me', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await deleteUserAndData(userId);
    res.clearCookie('mailmind_session', getClearCookieOptions());
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/auth/disconnect (Backwards compatibility for frontend)
 */
router.post('/disconnect', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await deleteUserAndData(userId);
    res.clearCookie('mailmind_session', getClearCookieOptions());
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
