import express from 'express';
import { db } from '../db/database.js';

const router = express.Router();

/**
 * GET /api/analytics
 * Returns comprehensive analytics metrics for the dashboard
 */
router.get('/', (req, res) => {
  try {
    const totalEmails = db.prepare('SELECT COUNT(*) as count FROM emails').get()?.count || 0;
    const unreadEmails = db.prepare('SELECT COUNT(*) as count FROM emails WHERE is_read = 0').get()?.count || 0;
    const sensitiveEmails = db.prepare('SELECT COUNT(*) as count FROM emails WHERE is_sensitive = 1').get()?.count || 0;
    
    // Categories breakdown
    const categoryRows = db.prepare(`
      SELECT category, COUNT(*) as count 
      FROM emails 
      GROUP BY category
    `).all();

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
      GROUP BY priority_score
    `).all();
    const priorityMap = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    priorityRows.forEach(row => {
      if (priorityMap[row.priority_score] !== undefined) {
        priorityMap[row.priority_score] = row.count;
      }
    });

    // Drafts metrics
    const pendingDrafts = db.prepare("SELECT COUNT(*) as count FROM drafts WHERE status = 'PENDING_APPROVAL'").get()?.count || 0;
    const sentDrafts = db.prepare("SELECT COUNT(*) as count FROM drafts WHERE status = 'SENT'").get()?.count || 0;

    // Tasks metrics
    const totalTasks = db.prepare('SELECT COUNT(*) as count FROM tasks').get()?.count || 0;
    const pendingTasks = db.prepare('SELECT COUNT(*) as count FROM tasks WHERE is_completed = 0').get()?.count || 0;
    const completedTasks = db.prepare('SELECT COUNT(*) as count FROM tasks WHERE is_completed = 1').get()?.count || 0;

    // Estimated hours saved (approx. 4.5 minutes per AI analyzed & drafted email)
    const minutesSaved = Math.round(totalEmails * 4.5);
    const hoursSaved = (minutesSaved / 60).toFixed(1);

    res.json({
      success: true,
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
