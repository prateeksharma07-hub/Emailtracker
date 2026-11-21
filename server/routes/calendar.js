import express from 'express';
import { DateTime } from 'luxon';
import { db } from '../db/database.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import {
  buildIcsCalendar,
  generateGoogleCalendarUrl
} from '../services/calendar/icsBuilder.js';
import {
  isCalendarExportEnabled,
  getUserReminderPrefs
} from '../services/deadlines/deadlineService.js';

const router = express.Router();

router.use(requireAuth);

/**
 * Middleware: Verify calendar export feature flag
 */
function checkCalendarFeature(req, res, next) {
  if (!isCalendarExportEnabled()) {
    return res.status(403).json({
      success: false,
      error: 'Calendar Export feature is currently disabled via FEATURE_CALENDAR_EXPORT.'
    });
  }
  next();
}

router.use(checkCalendarFeature);

/**
 * GET /api/calendar/task/:id.ics
 * Exports a single task as an RFC 5545 .ics file (strictly owned by req.user.id)
 */
router.get('/task/:id.ics', (req, res) => {
  try {
    const userId = req.user.id;
    const taskId = req.params.id;

    const task = db.prepare(`
      SELECT t.*, e.subject as email_subject, e.sender as email_sender
      FROM tasks t
      INNER JOIN emails e ON t.email_id = e.id
      WHERE t.id = ? AND t.user_id = ?
    `).get(taskId, userId);

    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found or access denied.' });
    }

    if (!task.due_at) {
      return res.status(400).json({
        success: false,
        error: 'Task does not have a scheduled due date to export to calendar.'
      });
    }

    const reminderPrefs = getUserReminderPrefs(userId);
    const icsContent = buildIcsCalendar([task], { userReminderPrefs: reminderPrefs });

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="task-${taskId}.ics"`);
    res.send(icsContent);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/calendar/task/:id/google-url
 * Returns a zero-scope Google Calendar web template URL for this task
 */
router.get('/task/:id/google-url', (req, res) => {
  try {
    const userId = req.user.id;
    const taskId = req.params.id;

    const task = db.prepare(`
      SELECT t.*, e.subject as email_subject, e.sender as email_sender
      FROM tasks t
      INNER JOIN emails e ON t.email_id = e.id
      WHERE t.id = ? AND t.user_id = ?
    `).get(taskId, userId);

    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found or access denied.' });
    }

    if (!task.due_at) {
      return res.status(400).json({
        success: false,
        error: 'Task does not have a scheduled due date.'
      });
    }

    const details = [
      task.deadline_kind ? `Kind: ${task.deadline_kind.toUpperCase()}` : '',
      task.email_subject ? `Email: ${task.email_subject}` : '',
      task.email_sender ? `From: ${task.email_sender}` : '',
      task.due_source_flagged ? 'SECURITY NOTE: Source email was flagged as SUSPICIOUS.' : ''
    ].filter(Boolean).join('\n');

    const url = generateGoogleCalendarUrl({
      title: task.task_title,
      dueAt: task.due_at,
      allDay: Boolean(task.due_all_day),
      dueTz: task.due_tz || 'Asia/Kolkata',
      details
    });

    res.json({ success: true, url });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/calendar/export.ics
 * Batch exports user tasks as an RFC 5545 .ics calendar (strictly owned by req.user.id)
 * Query parameters:
 * - scope: 'upcoming' (default) | 'all'
 * - includeFlagged: 'true' | 'false' (default 'false')
 */
router.get('/export.ics', (req, res) => {
  try {
    const userId = req.user.id;
    const scope = req.query.scope || 'upcoming';
    const includeFlagged = req.query.includeFlagged === 'true';

    let sql = `
      SELECT t.*, e.subject as email_subject, e.sender as email_sender
      FROM tasks t
      INNER JOIN emails e ON t.email_id = e.id
      WHERE t.user_id = ? AND t.due_at IS NOT NULL
    `;
    const params = [userId];

    if (scope === 'upcoming') {
      const yesterdayUtc = DateTime.now().minus({ days: 1 }).toUTC().toISO();
      sql += ' AND t.due_at >= ? AND t.is_completed = 0';
      params.push(yesterdayUtc);
    }

    if (!includeFlagged) {
      sql += ' AND (t.due_source_flagged = 0 OR t.due_source_flagged IS NULL)';
    }

    sql += ' ORDER BY t.due_at ASC';

    const tasks = db.prepare(sql).all(...params);
    const reminderPrefs = getUserReminderPrefs(userId);
    const icsContent = buildIcsCalendar(tasks, { userReminderPrefs: reminderPrefs });

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="mailmind-deadlines.ics"');
    res.send(icsContent);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
