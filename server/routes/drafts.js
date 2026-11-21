import express from 'express';
import rateLimit from 'express-rate-limit';
import { db } from '../db/database.js';
import { createGmailDraft } from '../services/gmailService.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { evaluateDraft, acknowledgeDraftCheck, isRegretShieldEnabled } from '../services/regret/regretShield.js';

const router = express.Router();

// Rate limiter for regret check endpoint (protects Groq LLM inference cost)
const regretCheckLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { success: false, error: 'Regret check rate limit reached. Please wait a moment.' },
  standardHeaders: true,
  legacyHeaders: false
});

router.use(requireAuth);

/**
 * GET /api/drafts
 * Lists all drafts strictly for the authenticated user
 */
router.get('/', (req, res) => {
  try {
    const userId = req.user.id;
    const { status } = req.query;

    let sql = `
      SELECT d.*, e.sender as original_sender, e.sender_name as original_sender_name, 
             e.subject as original_subject, e.category, e.priority_score
      FROM drafts d
      INNER JOIN emails e ON d.email_id = e.id
      WHERE d.user_id = ?
    `;
    const params = [userId];

    if (status) {
      sql += ' AND d.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY d.created_at DESC';

    const drafts = db.prepare(sql).all(...params);
    res.json({ success: true, drafts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/drafts/:id
 * Fetches a single draft strictly owned by req.user.id
 */
router.get('/:id', (req, res) => {
  try {
    const userId = req.user.id;
    const draft = db.prepare(`
      SELECT d.*, e.sender as original_sender, e.sender_name as original_sender_name, 
             e.subject as original_subject, e.category, e.body_text as original_body
      FROM drafts d
      LEFT JOIN emails e ON d.email_id = e.id
      WHERE d.id = ? AND d.user_id = ?
    `).get(req.params.id, userId);

    if (!draft) {
      return res.status(404).json({ success: false, error: 'Draft not found or access denied.' });
    }

    res.json({ success: true, draft });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/drafts/:id
 * Allows human editing of draft strictly owned by req.user.id
 */
router.put('/:id', (req, res) => {
  try {
    const userId = req.user.id;
    const { to_address, subject, reply_body, tone } = req.body;

    const existing = db.prepare('SELECT id FROM drafts WHERE id = ? AND user_id = ?').get(req.params.id, userId);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Draft not found or access denied.' });
    }

    db.prepare(`
      UPDATE drafts 
      SET to_address = COALESCE(?, to_address),
          subject = COALESCE(?, subject),
          reply_body = COALESCE(?, reply_body),
          tone = COALESCE(?, tone)
      WHERE id = ? AND user_id = ?
    `).run(to_address, subject, reply_body, tone, req.params.id, userId);

    const updated = db.prepare('SELECT * FROM drafts WHERE id = ? AND user_id = ?').get(req.params.id, userId);
    res.json({ success: true, draft: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/drafts/:id/check
 * Runs Regret Shield checks on draft (or prospective draft text)
 */
router.post('/:id/check', regretCheckLimiter, async (req, res) => {
  try {
    const userId = req.user.id;
    const draft = db.prepare('SELECT * FROM drafts WHERE id = ? AND user_id = ?').get(req.params.id, userId);
    if (!draft) {
      return res.status(404).json({ success: false, error: 'Draft not found or access denied.' });
    }

    const email = db.prepare('SELECT * FROM emails WHERE id = ? AND user_id = ?').get(draft.email_id, userId);

    const draftText = req.body.text !== undefined ? req.body.text : draft.reply_body;
    const recipientContext = {
      toAddresses: [draft.to_address],
      fromAddress: email?.sender || '',
      senderName: email?.sender_name || ''
    };

    const evaluation = await evaluateDraft({
      draftId: draft.id,
      draftText,
      userId,
      recipientContext,
      visibleContext: email?.body_text || email?.snippet || '',
      forceRecheck: Boolean(req.body.forceRecheck)
    });

    res.json({
      success: true,
      draftId: draft.id,
      check: evaluation
    });
  } catch (err) {
    console.error('[Regret Shield Check Error]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/drafts/:id/approve
 * STRICT HUMAN-IN-THE-LOOP APPROVAL ENDPOINT
 * Saves approved draft in user's Gmail Drafts using their own decrypted tokens.
 */
router.post('/:id/approve', async (req, res) => {
  const userId = req.user.id;
  const { confirmHumanApproval, overrides, acknowledged } = req.body;

  if (!confirmHumanApproval) {
    return res.status(400).json({
      success: false,
      error: 'SAFETY POLICY VIOLATION: Explicit human approval (confirmHumanApproval: true) is required before saving or exporting any draft.'
    });
  }

  try {
    const draft = db.prepare('SELECT * FROM drafts WHERE id = ? AND user_id = ?').get(req.params.id, userId);
    if (!draft) {
      return res.status(404).json({ success: false, error: 'Draft not found or access denied.' });
    }
    const email = db.prepare('SELECT * FROM emails WHERE id = ? AND user_id = ?').get(draft.email_id, userId);

    // SECURITY GATE: Drafts linked to DETAINED emails can never be approved
    if (email && email.shield_verdict === 'DETAINED') {
      return res.status(403).json({
        success: false,
        error: 'SECURITY GATE VIOLATION: Drafts associated with DETAINED emails cannot be approved. Quarantined to prevent adversarial prompt injection.'
      });
    }

    // Regret Shield Guard (if feature is enabled)
    if (isRegretShieldEnabled()) {
      const finalBody = overrides?.reply_body || draft.reply_body;
      const recipientContext = {
        toAddresses: [overrides?.to_address || draft.to_address],
        fromAddress: email?.sender || '',
        senderName: email?.sender_name || ''
      };

      const evaluation = await evaluateDraft({
        draftId: draft.id,
        draftText: finalBody,
        userId,
        recipientContext,
        visibleContext: email?.body_text || email?.snippet || ''
      });

      if (evaluation.severity === 'high' && !acknowledged) {
        return res.status(409).json({
          success: false,
          error: 'REGRET_SHIELD_HIGH_RISK',
          message: 'Draft contains high-risk elements (e.g. unfilled placeholders, sensitive data, harsh tone). Explicit acknowledgment is required to authorize.',
          regretCheck: evaluation
        });
      }

      if (acknowledged) {
        acknowledgeDraftCheck(draft.id, evaluation.draftHash, userId);
      }
    }

    const result = await createGmailDraft(req.params.id, userId, overrides || {});
    res.json({
      success: true,
      ...result,
      draft: db.prepare('SELECT * FROM drafts WHERE id = ? AND user_id = ?').get(req.params.id, userId)
    });
  } catch (err) {
    console.error('[Draft Approval Error]', err.message);
    const status = err.statusCode || 500;
    res.status(status).json({ success: false, error: err.message, regretCheck: err.regretCheck });
  }
});

/**
 * POST /api/drafts/:id/send
 * Alias for approve with backward compatibility
 */
router.post('/:id/send', async (req, res) => {
  const userId = req.user.id;
  const { confirmHumanApproval, overrides, acknowledged } = req.body;

  if (!confirmHumanApproval) {
    return res.status(400).json({
      success: false,
      error: 'SAFETY POLICY VIOLATION: Explicit human approval (confirmHumanApproval: true) is strictly required.'
    });
  }

  try {
    const draft = db.prepare('SELECT * FROM drafts WHERE id = ? AND user_id = ?').get(req.params.id, userId);
    if (!draft) {
      return res.status(404).json({ success: false, error: 'Draft not found or access denied.' });
    }
    const email = db.prepare('SELECT * FROM emails WHERE id = ? AND user_id = ?').get(draft.email_id, userId);

    // SECURITY GATE: Drafts linked to DETAINED emails can never be approved
    if (email && email.shield_verdict === 'DETAINED') {
      return res.status(403).json({
        success: false,
        error: 'SECURITY GATE VIOLATION: Drafts associated with DETAINED emails cannot be approved. Quarantined to prevent adversarial prompt injection.'
      });
    }

    // Regret Shield Guard (if feature is enabled)
    if (isRegretShieldEnabled()) {
      const finalBody = overrides?.reply_body || draft.reply_body;
      const recipientContext = {
        toAddresses: [overrides?.to_address || draft.to_address],
        fromAddress: email?.sender || '',
        senderName: email?.sender_name || ''
      };

      const evaluation = await evaluateDraft({
        draftId: draft.id,
        draftText: finalBody,
        userId,
        recipientContext,
        visibleContext: email?.body_text || email?.snippet || ''
      });

      if (evaluation.severity === 'high' && !acknowledged) {
        return res.status(409).json({
          success: false,
          error: 'REGRET_SHIELD_HIGH_RISK',
          message: 'Draft contains high-risk elements (e.g. unfilled placeholders, sensitive data, harsh tone). Explicit acknowledgment is required to authorize.',
          regretCheck: evaluation
        });
      }

      if (acknowledged) {
        acknowledgeDraftCheck(draft.id, evaluation.draftHash, userId);
      }
    }

    const result = await createGmailDraft(req.params.id, userId, overrides || {});
    res.json({
      success: true,
      dispatched: 'SAVED_AS_GMAIL_DRAFT',
      message: 'Draft authorized by user and successfully created in Gmail Drafts. (Zero auto-send policy enforced).',
      ...result,
      draft: db.prepare('SELECT * FROM drafts WHERE id = ? AND user_id = ?').get(req.params.id, userId)
    });
  } catch (err) {
    console.error('[Draft Send/Approve Error]', err.message);
    const status = err.statusCode || 500;
    res.status(status).json({ success: false, error: err.message, regretCheck: err.regretCheck });
  }
});

/**
 * POST /api/drafts/:id/reject
 * Marks draft as rejected strictly owned by req.user.id
 */
router.post('/:id/reject', (req, res) => {
  try {
    const userId = req.user.id;
    const existing = db.prepare('SELECT id FROM drafts WHERE id = ? AND user_id = ?').get(req.params.id, userId);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Draft not found or access denied.' });
    }

    db.prepare(`
      UPDATE drafts 
      SET status = 'REJECTED' 
      WHERE id = ? AND user_id = ?
    `).run(req.params.id, userId);

    res.json({ success: true, message: 'Draft rejected and archived.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/drafts/:id
 * Deletes a draft strictly owned by req.user.id
 */
router.delete('/:id', (req, res) => {
  try {
    const userId = req.user.id;
    const existing = db.prepare('SELECT id FROM drafts WHERE id = ? AND user_id = ?').get(req.params.id, userId);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Draft not found or access denied.' });
    }

    db.prepare('DELETE FROM drafts WHERE id = ? AND user_id = ?').run(req.params.id, userId);
    res.json({ success: true, message: 'Draft deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
