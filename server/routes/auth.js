import express from 'express';
import { getAuthUrl, handleOAuthCallback, getActiveAccount, disconnectAccount, isOAuthConfigured } from '../services/oauthService.js';
import { seedDemoEmails } from '../services/gmailService.js';

const router = express.Router();

/**
 * GET /api/auth/status
 * Returns connection state and configuration diagnostics
 */
router.get('/status', (req, res) => {
  try {
    const activeAccount = getActiveAccount();
    const isGoogleConfigured = isOAuthConfigured();
    const isGeminiActive = Boolean(
      process.env.GEMINI_API_KEY && 
      process.env.GEMINI_API_KEY.trim() !== '' && 
      process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here'
    );

    res.json({
      success: true,
      authenticated: Boolean(activeAccount),
      account: activeAccount,
      config: {
        oauthConfigured: isGoogleConfigured,
        geminiActive: isGeminiActive
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/auth/url
 * Returns Google OAuth 2.0 authorization URL
 */
router.get('/url', (req, res) => {
  try {
    const url = getAuthUrl();
    res.json({ success: true, url });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/auth/callback
 * Google OAuth redirect endpoint
 */
router.get('/callback', async (req, res) => {
  const { code, error } = req.query;
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5174';

  if (error) {
    console.error('[OAuth Callback Error]', error);
    return res.redirect(`${clientUrl}?auth_error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return res.redirect(`${clientUrl}?auth_error=missing_code`);
  }

  try {
    await handleOAuthCallback(code);
    res.redirect(`${clientUrl}?auth=success`);
  } catch (err) {
    console.error('[OAuth Token Exchange Error]', err);
    res.redirect(`${clientUrl}?auth_error=${encodeURIComponent(err.message)}`);
  }
});

/**
 * POST /api/auth/disconnect
 * Disconnects the active account
 */
router.post('/disconnect', (req, res) => {
  try {
    const { accountId } = req.body;
    const result = disconnectAccount(accountId);
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
