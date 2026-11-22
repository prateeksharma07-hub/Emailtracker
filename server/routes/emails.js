import express from 'express';
import rateLimit from 'express-rate-limit';
import { db } from '../db/database.js';
import { syncGmailInbox, getSyncStatusForUser } from '../services/gmailService.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { isValidBatchSize, ALLOWED_BATCH_SIZES } from '../config/syncConstants.js';
import { getUserSettings } from '../services/settingsService.js';

const router = express.Router();

// Rate limiter for inbox sync: max 12 requests per minute per user/IP
const syncLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 12,
  message: { success: false, error: 'Sync limit reached. Please wait a minute before syncing again.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Require authentication for all email operations
router.use(requireAuth);

/**
 * GET /api/emails
 * Lists emails strictly belonging to req.user.id
 */
router.get('/', (req, res) => {
  try {
    const userId = req.user.id;
    const { category, search, priority, sensitive, limit = 20, page = 1 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10)));
    const offset = (pageNum - 1) * limitNum;

    let sql = 'SELECT * FROM emails WHERE user_id = ?';
    const params = [userId];

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

    // Fetch tasks & draft counts for each email (scoped to user)
    const emailsWithMeta = emails.map(email => {
      const tasks = db.prepare('SELECT * FROM tasks WHERE email_id = ? AND user_id = ?').all(email.id, userId);
      const draftsCount = db.prepare('SELECT COUNT(*) as count FROM drafts WHERE email_id = ? AND user_id = ?').get(email.id, userId)?.count || 0;
      
      let senderTrust = null;
      try {
        const profile = db.prepare('SELECT trust_state FROM sender_profiles WHERE user_id = ? AND (sender_email = ? OR sender_email = ?)').get(userId, email.sender, email.sender?.toLowerCase());
        if (profile) {
          senderTrust = profile.trust_state;
        }
      } catch (e) {}

      return {
        ...email,
        tasks,
        drafts_count: draftsCount,
        sender_trust: senderTrust
      };
    });

    res.json({
      success: true,
      user: req.user,
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
 * Returns single email with full body, tasks, and drafts (strictly owned by req.user.id)
 */
router.get('/:id', (req, res) => {
  try {
    const userId = req.user.id;
    const email = db.prepare('SELECT * FROM emails WHERE id = ? AND user_id = ?').get(req.params.id, userId);
    
    if (!email) {
      return res.status(404).json({ success: false, error: 'Email not found or access denied.' });
    }

    const tasks = db.prepare('SELECT * FROM tasks WHERE email_id = ? AND user_id = ? ORDER BY created_at ASC').all(email.id, userId);
    const drafts = db.prepare('SELECT * FROM drafts WHERE email_id = ? AND user_id = ? ORDER BY created_at ASC').all(email.id, userId);

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
 * GET /api/emails/sync/status
 * Returns ongoing sync progress or latest status for the authenticated user
 */
router.get('/sync/status', (req, res) => {
  try {
    const status = getSyncStatusForUser(req.user.id);
    res.json({
      success: true,
      ...status
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/emails/sync
 * Manually triggers Gmail API synchronization for the authenticated user
 * Accepts optional `batchSize` {20, 50, 100, 200}, falls back to user setting, then default.
 */
router.post('/sync', syncLimiter, async (req, res) => {
  try {
    const userId = req.user.id;
    const rawBatchSize = req.body.batchSize !== undefined ? req.body.batchSize : req.body.maxResults;
    let batchSize;

    if (rawBatchSize !== undefined && rawBatchSize !== null && rawBatchSize !== '') {
      if (!isValidBatchSize(rawBatchSize)) {
        return res.status(400).json({
          success: false,
          error: `Invalid batch size. Allowed values: ${ALLOWED_BATCH_SIZES.join(', ')}`
        });
      }
      batchSize = Number(rawBatchSize);
    } else {
      // Fallback to user saved setting, then system default
      const userSettings = getUserSettings(userId);
      batchSize = userSettings.syncBatchSize;
    }

    const pageToken = req.body.pageToken || null;
    const result = await syncGmailInbox(userId, { batchSize, pageToken });
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

    if (err.code === 'USER_NOT_FOUND') {
      return res.status(401).json({
        success: false,
        code: 'USER_NOT_FOUND',
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
 * Marks an email as read/unread strictly owned by req.user.id
 */
router.patch('/:id/read', (req, res) => {
  try {
    const userId = req.user.id;
    const { is_read = 1 } = req.body;

    const email = db.prepare('SELECT id FROM emails WHERE id = ? AND user_id = ?').get(req.params.id, userId);
    if (!email) {
      return res.status(404).json({ success: false, error: 'Email not found or access denied.' });
    }

    db.prepare('UPDATE emails SET is_read = ? WHERE id = ? AND user_id = ?').run(is_read ? 1 : 0, req.params.id, userId);
    res.json({ success: true, emailId: req.params.id, is_read: is_read ? 1 : 0 });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/emails/:id
 * Deletes an email from local database strictly owned by req.user.id
 */
router.delete('/:id', (req, res) => {
  try {
    const userId = req.user.id;
    const email = db.prepare('SELECT id FROM emails WHERE id = ? AND user_id = ?').get(req.params.id, userId);
    if (!email) {
      return res.status(404).json({ success: false, error: 'Email not found or access denied.' });
    }

    db.prepare('DELETE FROM drafts WHERE email_id = ? AND user_id = ?').run(req.params.id, userId);
    db.prepare('DELETE FROM tasks WHERE email_id = ? AND user_id = ?').run(req.params.id, userId);
    db.prepare('DELETE FROM emails WHERE id = ? AND user_id = ?').run(req.params.id, userId);
    res.json({ success: true, message: 'Email deleted from local database' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
