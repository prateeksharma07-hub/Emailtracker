import express from 'express';
import crypto from 'node:crypto';
import { db } from '../db/database.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { parseSenderAddress } from '../services/senderMemory/headerParser.js';

const router = express.Router();

// Strict user authentication on all sender routes
router.use(requireAuth);

/**
 * Feature flag middleware: FEATURE_SENDER_TRUST (default: true)
 */
router.use((req, res, next) => {
  if (process.env.FEATURE_SENDER_TRUST === 'false') {
    return res.status(503).json({
      success: false,
      error: 'Sender Trust Memory feature is currently disabled by administrator configuration.',
      featureDisabled: true
    });
  }
  next();
});

/**
 * GET /api/senders
 * Paginated list of sender profiles for authenticated user.
 * Query params:
 *   - state: 'all' | 'trusted' | 'blocked' | 'unknown' (default: 'all')
 *   - q: search keyword in sender_email or display_names_json
 *   - page: integer (default: 1)
 *   - limit: integer (default: 20, max: 100)
 *   - sortBy: 'last_seen_at' | 'received_count' | 'sent_to_count' | 'sender_email' (default: 'last_seen_at')
 *   - order: 'DESC' | 'ASC' (default: 'DESC')
 */
router.get('/', (req, res) => {
  try {
    const userId = req.user.id;
    const { state = 'all', q = '', page = 1, limit = 20, sortBy = 'last_seen_at', order = 'DESC' } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    const allowedSortFields = ['last_seen_at', 'received_count', 'sent_to_count', 'sender_email', 'first_seen_at'];
    const sortColumn = allowedSortFields.includes(sortBy) ? sortBy : 'last_seen_at';
    const sortDirection = String(order).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    let countQuery = 'SELECT COUNT(*) as count FROM sender_profiles WHERE user_id = ?';
    let dataQuery = `SELECT * FROM sender_profiles WHERE user_id = ?`;
    const params = [userId];

    if (state && state !== 'all') {
      const allowedStates = ['trusted', 'blocked', 'unknown'];
      if (allowedStates.includes(state)) {
        countQuery += ' AND trust_state = ?';
        dataQuery += ' AND trust_state = ?';
        params.push(state);
      }
    }

    if (q && typeof q === 'string' && q.trim()) {
      const searchPattern = `%${q.trim()}%`;
      countQuery += ' AND (sender_email LIKE ? OR display_names_json LIKE ?)';
      dataQuery += ' AND (sender_email LIKE ? OR display_names_json LIKE ?)';
      params.push(searchPattern, searchPattern);
    }

    const totalRow = db.prepare(countQuery).get(...params);
    const total = totalRow?.count || 0;

    dataQuery += ` ORDER BY ${sortColumn} ${sortDirection} LIMIT ? OFFSET ?`;
    const rawSenders = db.prepare(dataQuery).all(...params, limitNum, offset);

    // Format display names for frontend presentation
    const senders = rawSenders.map(s => {
      let displayNames = [];
      try {
        displayNames = JSON.parse(s.display_names_json || '[]');
      } catch (e) {}
      return {
        ...s,
        display_name: displayNames[0] || s.sender_email.split('@')[0],
        displayNames
      };
    });

    // Compute aggregate summary counts
    const countsByState = db.prepare(`
      SELECT trust_state, COUNT(*) as count 
      FROM sender_profiles 
      WHERE user_id = ? 
      GROUP BY trust_state
    `).all(userId);

    const stats = {
      total,
      trusted: 0,
      blocked: 0,
      unknown: 0
    };
    countsByState.forEach(c => {
      if (stats[c.trust_state] !== undefined) {
        stats[c.trust_state] = c.count;
      }
    });

    res.json({
      success: true,
      senders,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1
      },
      stats
    });
  } catch (err) {
    console.error('[Senders API GET / Error]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/senders/:id
 * Retrieve details of a specific sender profile strictly owned by req.user.id
 */
router.get('/:id', (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const sender = db.prepare('SELECT * FROM sender_profiles WHERE id = ? AND user_id = ?').get(id, userId);
    if (!sender) {
      return res.status(404).json({ success: false, error: 'Sender profile not found or access denied.' });
    }

    let displayNames = [];
    try {
      displayNames = JSON.parse(sender.display_names_json || '[]');
    } catch (e) {}

    // Fetch recent header authentication records for this sender
    const recentHeaders = db.prepare(`
      SELECT id, email_id, from_addr, from_name, reply_to, spf, dkim, dmarc, created_at
      FROM email_headers_meta
      WHERE user_id = ? AND from_addr = ?
      ORDER BY created_at DESC
      LIMIT 10
    `).all(userId, sender.sender_email);

    res.json({
      success: true,
      sender: {
        ...sender,
        display_name: displayNames[0] || sender.sender_email.split('@')[0],
        displayNames
      },
      recentHeaders
    });
  } catch (err) {
    console.error('[Senders API GET /:id Error]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PATCH /api/senders/:id
 * Update trust state ('trusted' | 'blocked' | 'unknown')
 * Explicit user interaction sets user_set = 1
 */
router.patch('/:id', (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { trust_state } = req.body;

    const allowedStates = ['trusted', 'blocked', 'unknown'];
    if (!trust_state || !allowedStates.includes(trust_state)) {
      return res.status(400).json({
        success: false,
        error: `Invalid trust_state. Must be one of: ${allowedStates.join(', ')}`
      });
    }

    const result = db.prepare(`
      UPDATE sender_profiles
      SET trust_state = ?,
          user_set = 1
      WHERE id = ? AND user_id = ?
    `).run(trust_state, id, userId);

    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Sender profile not found or access denied.' });
    }

    const updatedProfile = db.prepare('SELECT * FROM sender_profiles WHERE id = ? AND user_id = ?').get(id, userId);

    res.json({
      success: true,
      message: `Sender trust state successfully set to '${trust_state}'.`,
      sender: updatedProfile
    });
  } catch (err) {
    console.error('[Senders API PATCH /:id Error]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/senders/:id
 * Delete a specific sender profile owned by req.user.id
 */
router.delete('/:id', (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const result = db.prepare('DELETE FROM sender_profiles WHERE id = ? AND user_id = ?').run(id, userId);
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Sender profile not found or access denied.' });
    }

    res.json({
      success: true,
      message: 'Sender profile deleted successfully.'
    });
  } catch (err) {
    console.error('[Senders API DELETE /:id Error]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/senders
 * Bulk forget all sender memory for authenticated user
 * Requires confirmation parameter: confirm=true
 */
router.delete('/', (req, res) => {
  try {
    const userId = req.user.id;
    const confirm = req.query.confirm === 'true' || req.body?.confirm === true;

    if (!confirm) {
      return res.status(400).json({
        success: false,
        error: "Confirmation required to erase all sender memory. Please provide confirm=true parameter."
      });
    }

    const senderResult = db.prepare('DELETE FROM sender_profiles WHERE user_id = ?').run(userId);
    const headerResult = db.prepare('DELETE FROM email_headers_meta WHERE user_id = ?').run(userId);

    res.json({
      success: true,
      message: 'All sender memory profiles and header telemetry successfully forgotten.',
      profilesDeleted: senderResult.changes,
      headersDeleted: headerResult.changes
    });
  } catch (err) {
    console.error('[Senders API DELETE / Error]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/senders/rebuild
 * Rebuilds / recalibrates sender memory profiles from existing stored emails for user.
 */
router.post('/rebuild', (req, res) => {
  try {
    const userId = req.user.id;

    // Fetch existing distinct senders from emails table
    const emails = db.prepare(`
      SELECT sender, sender_name, date_received 
      FROM emails 
      WHERE user_id = ? AND sender IS NOT NULL
      ORDER BY date_received ASC
    `).all(userId);

    let rebuiltCount = 0;
    const upsertStmt = db.prepare(`
      INSERT INTO sender_profiles (
        id, user_id, sender_email, sender_domain, display_names_json,
        first_seen_at, last_seen_at, received_count, sent_to_count, trust_state, user_set
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, 'unknown', 0)
      ON CONFLICT(user_id, sender_email) DO UPDATE SET
        received_count = sender_profiles.received_count + 1,
        last_seen_at = excluded.last_seen_at
    `);

    for (const em of emails) {
      const parsed = parseSenderAddress(em.sender);
      if (!parsed.email) continue;

      const profileId = `snd_${userId.slice(0, 8)}_${Buffer.from(parsed.email).toString('hex').slice(0, 16)}`;
      const seenDate = em.date_received || new Date().toISOString();
      const displayName = parsed.name || em.sender_name || null;
      const displayNames = displayName ? [displayName] : [];

      upsertStmt.run(
        profileId,
        userId,
        parsed.email,
        parsed.domain,
        JSON.stringify(displayNames),
        seenDate,
        seenDate
      );
      rebuiltCount++;
    }

    const currentTotal = db.prepare('SELECT COUNT(*) as count FROM sender_profiles WHERE user_id = ?').get(userId)?.count || 0;

    res.json({
      success: true,
      message: `Sender memory successfully rebuilt from ${rebuiltCount} stored email messages.`,
      profilesCount: currentTotal
    });
  } catch (err) {
    console.error('[Senders API POST /rebuild Error]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
