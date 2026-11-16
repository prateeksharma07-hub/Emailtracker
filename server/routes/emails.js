import express from 'express';
import { db } from '../db/database.js';
import { syncGmailInbox } from '../services/gmailService.js';
import { getActiveAccount } from '../services/oauthService.js';

const router = express.Router();

/**
 * GET /api/emails
 * Lists emails with category, search, priority, and sensitive filters
 */
router.get('/', (req, res) => {
  try {
    const { category, search, priority, sensitive, limit = 50, page = 1 } = req.query;
    const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);

    let sql = 'SELECT * FROM emails WHERE 1=1';
    const params = [];

    if (category && category !== 'All') {
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

    // Get total matching count
    const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
    const totalCount = db.prepare(countSql).get(...params)?.total || 0;

    sql += ' ORDER BY date_received DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit, 10), offset);

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
      emails: emailsWithMeta,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total: totalCount,
        totalPages: Math.ceil(totalCount / parseInt(limit, 10))
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
    const email = db.prepare('SELECT * FROM emails WHERE id = ?').get(req.params.id);
    if (!email) {
      return res.status(404).json({ success: false, error: 'Email not found' });
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
 * Triggers Gmail API synchronization
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

    const maxResults = parseInt(req.body.maxResults, 10) || 15;
    const result = await syncGmailInbox(activeAccount.id, maxResults);
    res.json(result);
  } catch (err) {
    console.error('[Sync Route Error]', err);
    res.status(500).json({ success: false, error: err.message });
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
