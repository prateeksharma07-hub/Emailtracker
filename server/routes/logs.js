import express from 'express';
import { db } from '../db/database.js';

const router = express.Router();

/**
 * GET /api/logs
 * Returns audit and security activity logs
 */
router.get('/', (req, res) => {
  try {
    const { severity, event_type, limit = 50 } = req.query;
    let sql = 'SELECT * FROM activity_logs WHERE 1=1';
    const params = [];

    if (severity) {
      sql += ' AND severity = ?';
      params.push(severity);
    }

    if (event_type) {
      sql += ' AND event_type = ?';
      params.push(event_type);
    }

    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(parseInt(limit, 10));

    const logs = db.prepare(sql).all(...params);

    const parsedLogs = logs.map(l => ({
      ...l,
      metadata: l.metadata ? JSON.parse(l.metadata) : null
    }));

    res.json({ success: true, logs: parsedLogs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
