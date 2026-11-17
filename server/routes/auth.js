import express from 'express';
import { 
  getAuthUrl, 
  handleOAuthCallback, 
  getActiveAccount, 
  disconnectAccount, 
  isOAuthConfigured 
} from '../services/oauthService.js';
import { seedDemoEmails, syncGmailInbox } from '../services/gmailService.js';

const router = express.Router();

/**
 * GET /api/auth/status
 * Returns current authenticated state, active account (tokens stripped), and system configuration.
 */
router.get('/status', (req, res) => {
  try {
    const activeAccount = getActiveAccount();
    const isGoogleConfigured = isOAuthConfigured();
    const isAIActive = Boolean(
      (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.startsWith('gsk_')) ||
      (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.startsWith('AIzaSy'))
    );

    res.json({
      success: true,
      authenticated: Boolean(activeAccount),
      isDemo: activeAccount?.is_demo || false,
      account: activeAccount,
      config: {
        oauthConfigured: isGoogleConfigured,
        aiActive: isAIActive,
        geminiActive: isAIActive, // backwards compatibility for client
        aiProvider: process.env.GROQ_API_KEY ? 'Groq LPU (Ultra-Fast)' : 'Heuristic Engine',
        redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5001/api/auth/callback'
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/auth/url
 * Generates Google OAuth 2.0 consent URL with CSRF protection state parameter
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
 * Google OAuth redirect endpoint with strict CSRF state validation
 */
router.get('/callback', async (req, res) => {
  const { code, state, error, error_description } = req.query;
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5174';

  // 1. Check for user-rejected consent or Google authorization error
  if (error) {
    console.warn('[OAuth Callback] Google authorization error:', error, error_description || '');
    const userMessage = error === 'access_denied' 
      ? 'Gmail access authorization was canceled or denied.' 
      : error_description || error;
    return res.redirect(`${clientUrl}?auth_error=${encodeURIComponent(userMessage)}`);
  }

  // 2. Validate code parameter
  if (!code) {
    return res.redirect(`${clientUrl}?auth_error=missing_authorization_code`);
  }

  // 3. Validate state parameter to prevent CSRF attacks
  if (!state) {
    console.warn('[OAuth Callback] Missing CSRF state parameter');
    return res.redirect(`${clientUrl}?auth_error=csrf_validation_failed`);
  }

  try {
    const account = await handleOAuthCallback(code, state);
    
    // Automatically initiate live sync for top 50 emails upon connect
    syncGmailInbox(account.accountId, { maxResults: 50 }).catch(syncErr => {
      console.warn('[Initial Gmail Sync Notice]', syncErr.message);
    });

    res.redirect(`${clientUrl}?auth=success&account=${encodeURIComponent(account.email)}`);
  } catch (err) {
    console.error('[OAuth Token Exchange Error]', err.message);
    res.redirect(`${clientUrl}?auth_error=${encodeURIComponent(err.message)}`);
  }
});

/**
 * POST /api/auth/disconnect
 * Disconnects the active Gmail account and removes credentials
 */
router.post('/disconnect', async (req, res) => {
  try {
    const { accountId } = req.body;
    const result = await disconnectAccount(accountId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/auth/seed-demo
 * Seeds demo emails with realistic AI classifications and safety shields
 */
router.post('/seed-demo', async (req, res) => {
  try {
    const result = await seedDemoEmails();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
