import express from 'express';
import { db } from '../db/database.js';
import { syncGmailInbox } from '../services/gmailService.js';
import { getActiveAccount } from '../services/oauthService.js';

const router = express.Router();

/**
 * GET /api/emails
 * Lists emails with category, search, priority, sensitive filters, and pagination.
 * ISOLATION: Associates all queries with the active account_id.
 */
router.get('/', (req, res) => {
  try {
    const activeAccount = getActiveAccount();
    if (!activeAccount) {
      return res.json({
        success: true,
        emails: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 }
      });
    }

    const { category, search, priority, sensitive, limit = 20, page = 1 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10)));
    const offset = (pageNum - 1) * limitNum;

    let sql = 'SELECT * FROM emails WHERE account_id = ?';
    const params = [activeAccount.id];

    if (category && category !== 'All' && category !== 'all') {
      sql += ' AND category = ?';
      params.push(category);
    }

    if (priority) {
      sql += ' AND priority_score >= ?';
      params.push(parseInt(priority, 10));
    }

    if (sensitive === 'true' || sensitive === '1') {
      sql += ' AND is_sensitive = 1';
    }

    if (search && search.trim() !== '') {
      sql += ' AND (subject LIKE ? OR sender LIKE ? OR sender_name LIKE ? OR snippet LIKE ? OR body_text LIKE ?)';
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term, term);
    }

    // Total matching count
    const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
    const totalCount = db.prepare(countSql).get(...params)?.total || 0;

    sql += ' ORDER BY date_received DESC LIMIT ? OFFSET ?';
    params.push(limitNum, offset);

    const emails = db.prepare(sql).all(...params);

    // Fetch tasks & draft counts for each email
    const emailsWithMeta = emails.map(email => {
      const tasks = db.prepare('SELECT * FROM tasks WHERE email_id = ?').all(email.id);
      const draftsCount = db.prepare('SELECT COUNT(*) as count FROM drafts WHERE email_id = ?').get(email.id)?.count || 0;
      return {
        ...email,
        tasks,
        drafts_count: draftsCount
      };
    });

    res.json({
      success: true,
      account: activeAccount,
      emails: emailsWithMeta,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limitNum)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/emails/:id
 * Returns single email with full body, tasks, and drafts
 */
router.get('/:id', (req, res) => {
  try {
    const activeAccount = getActiveAccount();
    const email = db.prepare('SELECT * FROM emails WHERE id = ?').get(req.params.id);
    
    if (!email) {
      return res.status(404).json({ success: false, error: 'Email not found' });
    }

    // Verify user owns the email record
    if (activeAccount && email.account_id && email.account_id !== activeAccount.id) {
      return res.status(403).json({ success: false, error: 'Access denied to this email record.' });
    }

    const tasks = db.prepare('SELECT * FROM tasks WHERE email_id = ? ORDER BY created_at ASC').all(email.id);
    const drafts = db.prepare('SELECT * FROM drafts WHERE email_id = ? ORDER BY created_at ASC').all(email.id);

    res.json({
      success: true,
      email: {
        ...email,
        tasks,
        drafts
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/emails/sync
 * Manually triggers Gmail API synchronization (latest 20 emails)
 */
router.post('/sync', async (req, res) => {
  try {
    const activeAccount = getActiveAccount();
    if (!activeAccount) {
      return res.status(400).json({
        success: false,
        error: 'No connected Gmail account. Please connect your Google account or load demo data.'
      });
    }

    const maxResults = parseInt(req.body.maxResults, 10) || 20;
    const pageToken = req.body.pageToken || null;

    const result = await syncGmailInbox(activeAccount.id, { maxResults, pageToken });
    res.json(result);
  } catch (err) {
    console.error('[Sync Route Error]', err.message);

    if (err.code === 'TOKEN_EXPIRED') {
      return res.status(401).json({
        success: false,
        code: 'TOKEN_EXPIRED',
        error: err.message
      });
    }

    res.status(500).json({
      success: false,
      error: err.message || 'Synchronization failed.'
    });
  }
});

/**
 * PATCH /api/emails/:id/read
 * Marks an email as read or unread
 */
router.patch('/:id/read', (req, res) => {
  try {
    const { is_read = 1 } = req.body;
    db.prepare('UPDATE emails SET is_read = ? WHERE id = ?').run(is_read ? 1 : 0, req.params.id);
    res.json({ success: true, emailId: req.params.id, is_read: is_read ? 1 : 0 });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/emails/:id
 * Deletes an email from local database
 */
router.delete('/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM emails WHERE id = ?').run(req.params.id);
    db.prepare('DELETE FROM tasks WHERE email_id = ?').run(req.params.id);
    db.prepare('DELETE FROM drafts WHERE email_id = ?').run(req.params.id);
    res.json({ success: true, message: 'Email deleted from local database' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
