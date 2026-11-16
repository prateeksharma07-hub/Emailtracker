import express from 'express';
import { db } from '../db/database.js';
import { createGmailDraft } from '../services/gmailService.js';
import { getActiveAccount } from '../services/oauthService.js';

const router = express.Router();

/**
 * GET /api/drafts
 * Lists all drafts with associated email information for the active account
 */
router.get('/', (req, res) => {
  try {
    const activeAccount = getActiveAccount();
    if (!activeAccount) {
      return res.json({ success: true, drafts: [] });
    }

    const { status } = req.query;
    let sql = `
      SELECT d.*, e.sender as original_sender, e.sender_name as original_sender_name, 
             e.subject as original_subject, e.category, e.priority_score
      FROM drafts d
      INNER JOIN emails e ON d.email_id = e.id
      WHERE e.account_id = ?
    `;
    const params = [activeAccount.id];

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
 * POST /api/drafts/:id/approve
 * STRICT HUMAN-IN-THE-LOOP APPROVAL ENDPOINT
 * Saves approved draft in Gmail Drafts (using minimum permissions `gmail.compose`).
 * Does NOT send or auto-forward emails.
 */
router.post('/:id/approve', async (req, res) => {
  const { confirmHumanApproval, overrides } = req.body;

  if (!confirmHumanApproval) {
    return res.status(400).json({
      success: false,
      error: 'SAFETY POLICY VIOLATION: Explicit human approval (confirmHumanApproval: true) is required before saving or exporting any draft.'
    });
  }

  try {
    const result = await createGmailDraft(req.params.id, overrides || {});
    res.json({
      success: true,
      ...result,
      draft: db.prepare('SELECT * FROM drafts WHERE id = ?').get(req.params.id)
    });
  } catch (err) {
    console.error('[Draft Approval Error]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/drafts/:id/send
 * Alias for approve with backward compatibility, enforcing NO SEND rule
 */
router.post('/:id/send', async (req, res) => {
  const { confirmHumanApproval, overrides } = req.body;

  if (!confirmHumanApproval) {
    return res.status(400).json({
      success: false,
      error: 'SAFETY POLICY VIOLATION: Explicit human approval (confirmHumanApproval: true) is strictly required.'
    });
  }

  try {
    const result = await createGmailDraft(req.params.id, overrides || {});
    res.json({
      success: true,
      dispatched: 'SAVED_AS_GMAIL_DRAFT',
      message: 'Draft authorized by user and successfully created in Gmail Drafts. (Zero auto-send policy enforced).',
      ...result,
      draft: db.prepare('SELECT * FROM drafts WHERE id = ?').get(req.params.id)
    });
  } catch (err) {
    console.error('[Draft Send/Approve Error]', err.message);
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
