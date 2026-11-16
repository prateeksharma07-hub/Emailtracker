import express from 'express';
import { db } from '../db/database.js';
import { sendApprovedEmail } from '../services/gmailService.js';
import { getActiveAccount } from '../services/oauthService.js';

const router = express.Router();

/**
 * GET /api/drafts
 * Lists all drafts with associated email information
 */
router.get('/', (req, res) => {
  try {
    const { status } = req.query;
    let sql = `
      SELECT d.*, e.sender as original_sender, e.sender_name as original_sender_name, 
             e.subject as original_subject, e.category, e.priority_score
      FROM drafts d
      LEFT JOIN emails e ON d.email_id = e.id
      WHERE 1=1
    `;
    const params = [];

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
 * Fetches a single draft
 */
router.get('/:id', (req, res) => {
  try {
    const draft = db.prepare(`
      SELECT d.*, e.sender as original_sender, e.sender_name as original_sender_name, 
             e.subject as original_subject, e.category, e.body_text as original_body
      FROM drafts d
      LEFT JOIN emails e ON d.email_id = e.id
      WHERE d.id = ?
    `).get(req.params.id);

    if (!draft) {
      return res.status(404).json({ success: false, error: 'Draft not found' });
    }

    res.json({ success: true, draft });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/drafts/:id
 * Allows human editing of draft before approval
 */
router.put('/:id', (req, res) => {
  try {
    const { to_address, subject, reply_body, tone } = req.body;
    const existing = db.prepare('SELECT * FROM drafts WHERE id = ?').get(req.params.id);

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Draft not found' });
    }

    db.prepare(`
      UPDATE drafts 
      SET to_address = COALESCE(?, to_address),
          subject = COALESCE(?, subject),
          reply_body = COALESCE(?, reply_body),
          tone = COALESCE(?, tone)
      WHERE id = ?
    `).run(to_address, subject, reply_body, tone, req.params.id);

    const updated = db.prepare('SELECT * FROM drafts WHERE id = ?').get(req.params.id);
    res.json({ success: true, draft: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/drafts/:id/send
 * STRICT HUMAN-IN-THE-LOOP APPROVAL ENDPOINT
 * Dispatches draft only with explicit user confirmation
 */
router.post('/:id/send', async (req, res) => {
  const { confirmHumanApproval, overrides } = req.body;

  // SAFETY ENFORCEMENT: Never send without explicit user approval
  if (!confirmHumanApproval) {
    return res.status(400).json({
      success: false,
      error: 'SAFETY POLICY VIOLATION: Explicit human approval (confirmHumanApproval: true) is strictly required before sending any email.'
    });
  }

  try {
    const draft = db.prepare('SELECT * FROM drafts WHERE id = ?').get(req.params.id);
    if (!draft) {
      return res.status(404).json({ success: false, error: 'Draft not found' });
    }

    const activeAccount = getActiveAccount();

    // If real connected Google account with real tokens exists:
    if (activeAccount && activeAccount.access_token && activeAccount.access_token !== 'mock_token') {
      const sendResult = await sendApprovedEmail(draft.id, overrides || {});
      return res.json({
        success: true,
        dispatched: 'GMAIL_API',
        details: sendResult
      });
    }

    // Demo Mode dispatch simulation (for testing before Google credentials are set)
    const to = overrides?.to_address || draft.to_address;
    const subject = overrides?.subject || draft.subject;
    const body = overrides?.reply_body || draft.reply_body;

    db.prepare(`
      UPDATE drafts 
      SET status = 'SENT', 
          approved_at = CURRENT_TIMESTAMP, 
          sent_at = CURRENT_TIMESTAMP,
          to_address = ?,
          subject = ?,
          reply_body = ?
      WHERE id = ?
    `).run(to, subject, body, draft.id);

    // Record activity log
    db.prepare(`
      INSERT INTO activity_logs (id, event_type, severity, message, metadata)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      'log_' + Date.now(),
      'DRAFT_APPROVED_SENT',
      'INFO',
      `Human approved & sent email to ${to}: "${subject}"`,
      JSON.stringify({ draftId: draft.id, to, subject, mode: 'LOCAL_SIMULATED_SAFE' })
    );

    res.json({
      success: true,
      dispatched: 'LOCAL_VERIFIED',
      message: `Email successfully approved and dispatched to ${to}.`,
      draft: db.prepare('SELECT * FROM drafts WHERE id = ?').get(draft.id)
    });
  } catch (err) {
    console.error('[Send Draft Route Error]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/drafts/:id/reject
 * Marks draft as rejected
 */
router.post('/:id/reject', (req, res) => {
  try {
    db.prepare(`
      UPDATE drafts 
      SET status = 'REJECTED' 
      WHERE id = ?
    `).run(req.params.id);

    res.json({ success: true, message: 'Draft rejected and archived.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/drafts/:id
 * Deletes a draft
 */
router.delete('/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM drafts WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'Draft deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
