import express from 'express';
import { db } from '../db/database.js';

const router = express.Router();

/**
 * GET /api/tasks
 * Lists extracted tasks from emails
 */
router.get('/', (req, res) => {
  try {
    const { completed } = req.query;
    let sql = `
      SELECT t.*, e.subject as email_subject, e.sender as email_sender, 
             e.sender_name as email_sender_name, e.category, e.priority_score
      FROM tasks t
      LEFT JOIN emails e ON t.email_id = e.id
      WHERE 1=1
    `;
    const params = [];

    if (completed !== undefined) {
      sql += ' AND t.is_completed = ?';
      params.push(completed === 'true' || completed === '1' ? 1 : 0);
    }

    sql += ' ORDER BY t.created_at DESC';

    const tasks = db.prepare(sql).all(...params);
    res.json({ success: true, tasks });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PATCH /api/tasks/:id
 * Toggles task status or edits title/deadline
 */
router.patch('/:id', (req, res) => {
  try {
    const { is_completed, task_title, deadline_date, deadline_text } = req.body;
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);

    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    db.prepare(`
      UPDATE tasks 
      SET is_completed = COALESCE(?, is_completed),
          task_title = COALESCE(?, task_title),
          deadline_date = COALESCE(?, deadline_date),
          deadline_text = COALESCE(?, deadline_text)
      WHERE id = ?
    `).run(
      is_completed !== undefined ? (is_completed ? 1 : 0) : null,
      task_title || null,
      deadline_date || null,
      deadline_text || null,
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    res.json({ success: true, task: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/tasks/:id
 * Removes a task
 */
router.delete('/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'Task deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
