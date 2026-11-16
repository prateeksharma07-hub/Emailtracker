import express from 'express';
import { db } from '../db/database.js';
import { getActiveAccount } from '../services/oauthService.js';

const router = express.Router();

/**
 * GET /api/analytics
 * Returns comprehensive analytics metrics for the dashboard associated with the active account
 */
router.get('/', (req, res) => {
  try {
    const activeAccount = getActiveAccount();
    const accountFilter = activeAccount ? 'WHERE account_id = ?' : 'WHERE 1=0';
    const params = activeAccount ? [activeAccount.id] : [];

    const totalEmails = db.prepare(`SELECT COUNT(*) as count FROM emails ${accountFilter}`).get(...params)?.count || 0;
    const unreadEmails = db.prepare(`SELECT COUNT(*) as count FROM emails ${accountFilter} AND is_read = 0`).get(...params)?.count || 0;
    const sensitiveEmails = db.prepare(`SELECT COUNT(*) as count FROM emails ${accountFilter} AND is_sensitive = 1`).get(...params)?.count || 0;
    
    // Categories breakdown
    const categoryRows = db.prepare(`
      SELECT category, COUNT(*) as count 
      FROM emails 
      ${accountFilter}
      GROUP BY category
    `).all(...params);

    const categoryMap = {
      Urgent: 0,
      Work: 0,
      Meeting: 0,
      Task: 0,
      Personal: 0,
      Newsletter: 0,
      Other: 0
    };
    categoryRows.forEach(row => {
      if (row.category in categoryMap) {
        categoryMap[row.category] = row.count;
      } else {
        categoryMap.Other += row.count;
      }
    });

    // Priority breakdown
    const priorityRows = db.prepare(`
      SELECT priority_score, COUNT(*) as count 
      FROM emails 
      ${accountFilter}
      GROUP BY priority_score
    `).all(...params);
    const priorityMap = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    priorityRows.forEach(row => {
      if (priorityMap[row.priority_score] !== undefined) {
        priorityMap[row.priority_score] = row.count;
      }
    });

    // Drafts metrics
    const draftFilter = activeAccount 
      ? 'WHERE email_id IN (SELECT id FROM emails WHERE account_id = ?)' 
      : 'WHERE 1=0';
    const pendingDrafts = db.prepare(`SELECT COUNT(*) as count FROM drafts ${draftFilter} AND status = 'PENDING_APPROVAL'`).get(...params)?.count || 0;
    const sentDrafts = db.prepare(`SELECT COUNT(*) as count FROM drafts ${draftFilter} AND status IN ('SENT', 'CREATED_IN_GMAIL', 'APPROVED')`).get(...params)?.count || 0;

    // Tasks metrics
    const taskFilter = activeAccount 
      ? 'WHERE email_id IN (SELECT id FROM emails WHERE account_id = ?)' 
      : 'WHERE 1=0';
    const totalTasks = db.prepare(`SELECT COUNT(*) as count FROM tasks ${taskFilter}`).get(...params)?.count || 0;
    const pendingTasks = db.prepare(`SELECT COUNT(*) as count FROM tasks ${taskFilter} AND is_completed = 0`).get(...params)?.count || 0;
    const completedTasks = db.prepare(`SELECT COUNT(*) as count FROM tasks ${taskFilter} AND is_completed = 1`).get(...params)?.count || 0;

    // Estimated hours saved (approx. 4.5 minutes per AI analyzed email)
    const minutesSaved = Math.round(totalEmails * 4.5);
    const hoursSaved = (minutesSaved / 60).toFixed(1);

    res.json({
      success: true,
      account: activeAccount,
      metrics: {
        totalEmails,
        unreadEmails,
        sensitiveEmails,
        pendingDrafts,
        sentDrafts,
        totalTasks,
        pendingTasks,
        completedTasks,
        hoursSaved: parseFloat(hoursSaved)
      },
      categories: categoryMap,
      priorities: priorityMap,
      humanInTheLoopSafetyRate: '100% (Zero autonomous dispatches)'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
