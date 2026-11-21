import express from 'express';
import { db } from '../db/database.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { isCampusModeEnabled } from '../services/campus/campusService.js';
import { buildIcsCalendar } from '../services/calendar/icsBuilder.js';
import { getUserReminderPrefs } from '../services/deadlines/deadlineService.js';

const router = express.Router();

router.use(requireAuth);

/**
 * Feature flag protection for campus mode routes
 */
router.use((req, res, next) => {
  if (!isCampusModeEnabled()) {
    return res.status(403).json({
      success: false,
      error: 'Campus Mode feature is currently disabled via FEATURE_CAMPUS_MODE.'
    });
  }
  next();
});

/**
 * GET /api/campus/items
 * Lists all college timeline items for the authenticated user, optionally filtered by kind or course
 */
router.get('/items', (req, res) => {
  try {
    const userId = req.user.id;
    const { kind, course } = req.query;

    let sql = `
      SELECT c.*, e.subject as email_subject, e.sender as email_sender
      FROM campus_items c
      INNER JOIN emails e ON c.email_id = e.id
      WHERE c.user_id = ?
    `;
    const params = [userId];

    if (kind) {
      sql += ' AND c.kind = ?';
      params.push(kind);
    }

    if (course) {
      sql += ' AND c.course LIKE ?';
      params.push(`%${course}%`);
    }

    sql += ' ORDER BY CASE WHEN c.due_at IS NULL THEN 1 ELSE 0 END, c.due_at ASC, c.created_at DESC';

    const items = db.prepare(sql).all(...params);
    res.json({ success: true, items });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/campus/export.ics
 * Batch exports campus items with deadlines as an RFC 5545 .ics calendar
 */
router.get('/export.ics', (req, res) => {
  try {
    const userId = req.user.id;

    const items = db.prepare(`
      SELECT c.*, c.title as task_title, c.kind as deadline_kind, 
             e.subject as email_subject, e.sender as email_sender
      FROM campus_items c
      INNER JOIN emails e ON c.email_id = e.id
      WHERE c.user_id = ? AND c.due_at IS NOT NULL
      ORDER BY c.due_at ASC
    `).all(userId);

    const reminderPrefs = getUserReminderPrefs(userId);
    const icsContent = buildIcsCalendar(items, { userReminderPrefs: reminderPrefs });

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="campus-deadlines.ics"');
    res.send(icsContent);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/campus/items/:id
 * Removes a campus item (strictly owned by req.user.id)
 */
router.delete('/items/:id', (req, res) => {
  try {
    const userId = req.user.id;
    const item = db.prepare('SELECT id FROM campus_items WHERE id = ? AND user_id = ?').get(req.params.id, userId);

    if (!item) {
      return res.status(404).json({ success: false, error: 'Campus item not found or access denied.' });
    }

    db.prepare('DELETE FROM campus_items WHERE id = ? AND user_id = ?').run(req.params.id, userId);
    res.json({ success: true, message: 'Campus item removed.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
