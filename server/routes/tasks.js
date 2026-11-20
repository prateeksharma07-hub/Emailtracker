import express from 'express';
import { db } from '../db/database.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(requireAuth);

/**
 * GET /api/tasks
 * Lists extracted tasks strictly for the authenticated user
 */
router.get('/', (req, res) => {
  try {
    const userId = req.user.id;
    const { completed } = req.query;

    let sql = `
      SELECT t.*, e.subject as email_subject, e.sender as email_sender, 
             e.sender_name as email_sender_name, e.category, e.priority_score
      FROM tasks t
      INNER JOIN emails e ON t.email_id = e.id
      WHERE t.user_id = ?
    `;
    const params = [userId];

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
 * Toggles task status or edits title/deadline (strictly owned by req.user.id)
 */
router.patch('/:id', (req, res) => {
  try {
    const userId = req.user.id;
    const { is_completed, task_title, deadline_date, deadline_text } = req.body;

    const task = db.prepare('SELECT id FROM tasks WHERE id = ? AND user_id = ?').get(req.params.id, userId);

    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found or access denied.' });
    }

    db.prepare(`
      UPDATE tasks 
      SET is_completed = COALESCE(?, is_completed),
          task_title = COALESCE(?, task_title),
          deadline_date = COALESCE(?, deadline_date),
          deadline_text = COALESCE(?, deadline_text)
      WHERE id = ? AND user_id = ?
    `).run(
      is_completed !== undefined ? (is_completed ? 1 : 0) : null,
      task_title || null,
      deadline_date || null,
      deadline_text || null,
      req.params.id,
      userId
    );

    const updated = db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(req.params.id, userId);
    res.json({ success: true, task: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/tasks/:id
 * Removes a task (strictly owned by req.user.id)
 */
router.delete('/:id', (req, res) => {
  try {
    const userId = req.user.id;
    const task = db.prepare('SELECT id FROM tasks WHERE id = ? AND user_id = ?').get(req.params.id, userId);

    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found or access denied.' });
    }

    db.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ?').run(req.params.id, userId);
    res.json({ success: true, message: 'Task deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
