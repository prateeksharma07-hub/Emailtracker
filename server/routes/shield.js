import express from 'express';
import { db } from '../db/database.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { scanAndSaveShieldResult } from '../services/gmailService.js';
import { SYNTHETIC_EMAILS } from '../tests/shield/fixtures/syntheticEmails.js';

const router = express.Router();

router.use(requireAuth);

/**
 * GET /api/shield/emails/:id
 * Returns X-Ray forensic data for a specific email strictly owned by req.user.id
 */
router.get('/emails/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const emailId = req.params.id;

    // Verify email ownership
    const email = db.prepare('SELECT id, subject, sender, sender_name, date_received, shield_verdict FROM emails WHERE id = ? AND user_id = ?').get(emailId, userId);
    if (!email) {
      return res.status(404).json({ success: false, error: 'Email not found or access denied.' });
    }

    // Check if scan already exists in database
    let scan = db.prepare('SELECT * FROM shield_scans WHERE email_id = ? AND user_id = ?').get(emailId, userId);

    // If not scanned yet, trigger scan on demand
    if (!scan) {
      scan = await scanAndSaveShieldResult(emailId, userId);
    }

    let layers = [];
    try {
      layers = typeof scan.layers_json === 'string' ? JSON.parse(scan.layers_json) : (scan.layers || []);
    } catch (_) {
      layers = [];
    }

    let hiddenSegments = [];
    try {
      hiddenSegments = typeof scan.hidden_segments_json === 'string' ? JSON.parse(scan.hidden_segments_json) : (scan.hiddenSegments || []);
    } catch (_) {
      hiddenSegments = [];
    }

    // Additive sender profile & header meta
    let headersMeta = null;
    let senderProfile = null;
    try {
      headersMeta = db.prepare('SELECT * FROM email_headers_meta WHERE email_id = ? AND user_id = ?').get(emailId, userId) || null;
      const senderEmail = headersMeta?.from_addr || email.sender;
      if (senderEmail) {
        senderProfile = db.prepare('SELECT * FROM sender_profiles WHERE user_id = ? AND sender_email = ?').get(userId, senderEmail) || null;
      }
    } catch (ignoreErr) {}

    res.json({
      success: true,
      scan: {
        id: scan.id || scan.scanId,
        emailId,
        subject: email.subject,
        sender: email.sender_name || email.sender,
        verdict: scan.verdict,
        threatScore: scan.threat_score !== undefined ? scan.threat_score : scan.threatScore,
        visibleText: scan.visible_text !== undefined ? scan.visible_text : scan.visibleText,
        aiText: scan.ai_text !== undefined ? scan.ai_text : scan.aiText,
        layers,
        hiddenSegments,
        senderProfile,
        headersMeta,
        createdAt: scan.created_at || new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('[Shield API Error]', err.message);
    const status = err.statusCode || 500;
    res.status(status).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/shield/rescan/:id
 * Re-evaluates an email through the latest Shield pipeline
 */
router.post('/rescan/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const emailId = req.params.id;

    const email = db.prepare('SELECT id, subject, sender, sender_name FROM emails WHERE id = ? AND user_id = ?').get(emailId, userId);
    if (!email) {
      return res.status(404).json({ success: false, error: 'Email not found or access denied.' });
    }

    const result = await scanAndSaveShieldResult(emailId, userId);

    let headersMeta = null;
    let senderProfile = null;
    try {
      headersMeta = db.prepare('SELECT * FROM email_headers_meta WHERE email_id = ? AND user_id = ?').get(emailId, userId) || null;
      const senderEmail = headersMeta?.from_addr || email.sender;
      if (senderEmail) {
        senderProfile = db.prepare('SELECT * FROM sender_profiles WHERE user_id = ? AND sender_email = ?').get(userId, senderEmail) || null;
      }
    } catch (ignoreErr) {}

    res.json({
      success: true,
      message: 'Email successfully rescanned through Shield firewall.',
      scan: {
        id: result.scanId || result.id,
        emailId,
        subject: email.subject,
        sender: email.sender_name || email.sender,
        verdict: result.verdict,
        threatScore: result.threatScore,
        visibleText: result.visibleText,
        aiText: result.aiText,
        layers: result.layers || [],
        hiddenSegments: result.hiddenSegments || [],
        senderProfile,
        headersMeta,
        createdAt: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('[Shield Rescan Error]', err.message);
    const status = err.statusCode || 500;
    res.status(status).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/shield/stats
 * Returns verdict counts (CLEARED, SUSPICIOUS, DETAINED) strictly for authenticated user
 */
router.get('/stats', (req, res) => {
  try {
    const userId = req.user.id;

    const rows = db.prepare(`
      SELECT COALESCE(shield_verdict, 'CLEARED') as verdict, COUNT(*) as count 
      FROM emails 
      WHERE user_id = ? 
      GROUP BY COALESCE(shield_verdict, 'CLEARED')
    `).all(userId);

    const stats = {
      CLEARED: 0,
      SUSPICIOUS: 0,
      DETAINED: 0,
      cleared: 0,
      suspicious: 0,
      detained: 0,
      total: 0,
      totalScanned: 0
    };

    rows.forEach(r => {
      const v = r.verdict;
      if (stats[v] !== undefined) {
        stats[v] = r.count;
      }
      const vLower = (v || '').toLowerCase();
      if (stats[vLower] !== undefined) {
        stats[vLower] = r.count;
      }
      stats.total += r.count;
      stats.totalScanned += r.count;
    });

    res.json({
      success: true,
      stats
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/shield/seed-samples
 * Dev / Evaluation utility: Populates sample prompt-injection and benign benchmark emails
 * directly into the authenticated user's inbox so X-Ray can be tested without real Gmail.
 */
router.post('/seed-samples', async (req, res) => {
  try {
    const userId = req.user.id;
    let addedCount = 0;

    for (const sample of SYNTHETIC_EMAILS.slice(0, 10)) {
      const emailId = 'sample_' + sample.id + '_' + userId.slice(0, 6);

      // Upsert email
      db.prepare(`
        INSERT INTO emails (
          id, user_id, thread_id, account_id, sender, sender_name, recipient, subject,
          body_text, body_html, snippet, date_received, is_read, category, priority_score,
          summary, shield_verdict, ai_processed
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        ON CONFLICT(id) DO UPDATE SET
          body_text = excluded.body_text,
          body_html = excluded.body_html,
          subject = excluded.subject
      `).run(
        emailId,
        userId,
        'th_' + sample.id,
        userId,
        sample.sender,
        sample.senderName || 'Benchmark Source',
        req.user.email,
        sample.subject,
        sample.bodyText || '',
        sample.bodyHtml || `<p>${sample.bodyText || ''}</p>`,
        sample.bodyText?.slice(0, 120) || '',
        new Date().toISOString(),
        0,
        sample.expectedVerdict === 'DETAINED' ? 'Urgent' : 'Work',
        sample.expectedVerdict === 'DETAINED' ? 5 : 3,
        `[Sample Diagnostic Email] Expected verdict: ${sample.expectedVerdict}`,
        sample.expectedVerdict
      );

      // Trigger automatic scan and persist
      await scanAndSaveShieldResult(emailId, userId);
      addedCount++;
    }

    res.json({
      success: true,
      message: `Loaded ${addedCount} sample benchmark emails for X-Ray inspection.`,
      addedCount
    });
  } catch (err) {
    console.error('[Seed Samples Error]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
