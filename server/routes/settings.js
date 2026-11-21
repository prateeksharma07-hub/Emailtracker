import express from 'express';
import { DateTime } from 'luxon';
import { db } from '../db/database.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(requireAuth);

/**
 * GET /api/settings
 * Retrieves user preferences (Timezone, Campus Mode, Domains, Reminder Preferences)
 */
router.get('/', (req, res) => {
  try {
    const userId = req.user.id;
    let row = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(userId);

    if (!row) {
      // Initialize default settings for user
      db.prepare(`
        INSERT OR IGNORE INTO user_settings (user_id, timezone, campus_mode, campus_domains_json, reminder_prefs_json)
        VALUES (?, 'Asia/Kolkata', 0, '[]', '{"days_before":1,"hours_before":1}')
      `).run(userId);
      row = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(userId);
    }

    let campusDomains = [];
    let reminderPrefs = { days_before: 1, hours_before: 1 };

    try {
      campusDomains = JSON.parse(row.campus_domains_json || '[]');
    } catch (e) {}

    try {
      reminderPrefs = JSON.parse(row.reminder_prefs_json || '{"days_before":1,"hours_before":1}');
    } catch (e) {}

    res.json({
      success: true,
      settings: {
        user_id: userId,
        timezone: row.timezone || 'Asia/Kolkata',
        campus_mode: Boolean(row.campus_mode),
        campus_domains: campusDomains,
        reminder_prefs: reminderPrefs
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PATCH /api/settings
 * Updates user preferences with strict type validation
 */
router.patch('/', (req, res) => {
  try {
    const userId = req.user.id;
    const { timezone, campus_mode, campus_domains, reminder_prefs } = req.body;

    // Validate timezone if provided
    if (timezone !== undefined) {
      const testDt = DateTime.now().setZone(timezone);
      if (!testDt.isValid) {
        return res.status(400).json({
          success: false,
          error: `Invalid IANA timezone identifier: "${timezone}"`
        });
      }
    }

    // Prepare current settings
    let current = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(userId);
    if (!current) {
      db.prepare(`
        INSERT INTO user_settings (user_id, timezone, campus_mode, campus_domains_json, reminder_prefs_json)
        VALUES (?, 'Asia/Kolkata', 0, '[]', '{"days_before":1,"hours_before":1}')
      `).run(userId);
      current = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(userId);
    }

    const newTimezone = timezone !== undefined ? timezone : current.timezone;
    const newCampusMode = campus_mode !== undefined ? (campus_mode ? 1 : 0) : current.campus_mode;

    let newDomainsJson = current.campus_domains_json;
    if (campus_domains !== undefined) {
      if (!Array.isArray(campus_domains)) {
        return res.status(400).json({ success: false, error: 'campus_domains must be an array of domain strings.' });
      }
      // Sanitize domain list
      const cleanDomains = campus_domains
        .filter(d => typeof d === 'string')
        .map(d => d.trim().toLowerCase().replace(/^@/, ''))
        .filter(Boolean);
      newDomainsJson = JSON.stringify(cleanDomains);
    }

    let newReminderJson = current.reminder_prefs_json;
    if (reminder_prefs !== undefined) {
      if (typeof reminder_prefs !== 'object' || reminder_prefs === null) {
        return res.status(400).json({ success: false, error: 'reminder_prefs must be an object.' });
      }
      newReminderJson = JSON.stringify({
        days_before: Number(reminder_prefs.days_before) || 0,
        hours_before: Number(reminder_prefs.hours_before) || 0
      });
    }

    db.prepare(`
      UPDATE user_settings
      SET timezone = ?,
          campus_mode = ?,
          campus_domains_json = ?,
          reminder_prefs_json = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).run(newTimezone, newCampusMode, newDomainsJson, newReminderJson, userId);

    const updated = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(userId);

    res.json({
      success: true,
      settings: {
        user_id: userId,
        timezone: updated.timezone,
        campus_mode: Boolean(updated.campus_mode),
        campus_domains: JSON.parse(updated.campus_domains_json || '[]'),
        reminder_prefs: JSON.parse(updated.reminder_prefs_json || '{}')
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
