import { db } from '../db/database.js';
import { getClearCookieOptions } from '../routes/auth.js';

/**
 * Authentication Middleware: Validates session cookie or Bearer token,
 * verifies session validity against the SQLite `sessions` table,
 * and attaches sanitized `req.user` to the request object.
 */
export function requireAuth(req, res, next) {
  try {
    // 1. Extract session token from httpOnly cookie or Authorization header
    const sessionToken = req.cookies?.mailmind_session ||
      (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7).trim() : null);

    if (!sessionToken) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. Please connect your Gmail account.',
        code: 'UNAUTHORIZED'
      });
    }

    // 2. Lookup session in database
    const session = db.prepare('SELECT id, user_id, expires_at FROM sessions WHERE id = ?').get(sessionToken);

    if (!session) {
      res.clearCookie('mailmind_session', getClearCookieOptions());
      return res.status(401).json({
        success: false,
        error: 'Invalid or terminated session. Please sign in again.',
        code: 'INVALID_SESSION'
      });
    }

    // 3. Check expiration (7-day TTL)
    if (session.expires_at < Date.now()) {
      db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionToken);
      res.clearCookie('mailmind_session', getClearCookieOptions());
      return res.status(401).json({
        success: false,
        error: 'Session has expired. Please sign in again.',
        code: 'SESSION_EXPIRED'
      });
    }

    // 4. Retrieve user profile (stripping sensitive tokens from req.user)
    const user = db.prepare(`
      SELECT id, google_id, email, name, picture, token_expiry, created_at, last_sync_at
      FROM users 
      WHERE id = ?
    `).get(session.user_id);

    if (!user) {
      db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionToken);
      res.clearCookie('mailmind_session', getClearCookieOptions());
      return res.status(401).json({
        success: false,
        error: 'User account not found. Please sign in again.',
        code: 'USER_NOT_FOUND'
      });
    }

    // 5. Attach user object to request
    req.user = user;
    req.sessionId = sessionToken;
    next();
  } catch (err) {
    console.error('[Auth Middleware Error]', err);
    return res.status(500).json({
      success: false,
      error: 'Authentication verification failed.',
      code: 'AUTH_ERROR'
    });
  }
}
