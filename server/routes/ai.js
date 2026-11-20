import express from 'express';
import { db } from '../db/database.js';
import { analyzeEmail, generateCustomReply } from '../services/groqService.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(requireAuth);

/**
 * POST /api/ai/analyze/:emailId
 * Runs AI intelligence pipeline on a specific email strictly belonging to req.user.id
 */
router.post('/analyze/:emailId', async (req, res) => {
  try {
    const userId = req.user.id;
    const email = db.prepare('SELECT * FROM emails WHERE id = ? AND user_id = ?').get(req.params.emailId, userId);
    if (!email) {
      return res.status(404).json({ success: false, error: 'Email not found or access denied.' });
    }

    const analysis = await analyzeEmail(email);

    // Update email record
    db.prepare(`
      UPDATE emails 
      SET category = ?,
          priority_score = ?,
          summary = ?,
          is_sensitive = ?,
          sensitive_type = ?,
          ai_processed = 1
      WHERE id = ? AND user_id = ?
    `).run(
      analysis.category,
      analysis.priority_score,
      analysis.summary,
      analysis.is_sensitive ? 1 : 0,
      analysis.sensitive_type || null,
      email.id,
      userId
    );

    // Update tasks under user_id
    db.prepare('DELETE FROM tasks WHERE email_id = ? AND user_id = ?').run(email.id, userId);
    if (analysis.tasks && analysis.tasks.length > 0) {
      const taskStmt = db.prepare(`
        INSERT INTO tasks (id, user_id, email_id, task_title, deadline_date, deadline_text)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const t of analysis.tasks) {
        taskStmt.run(
          'task_' + Math.random().toString(36).slice(2, 10),
          userId,
          email.id,
          t.task_title,
          t.deadline_date || null,
          t.deadline_text || null
        );
      }
    }

    // Refresh reply drafts under user_id
    if (analysis.reply_drafts && analysis.reply_drafts.length > 0) {
      const draftStmt = db.prepare(`
        INSERT INTO drafts (id, user_id, email_id, to_address, subject, reply_body, tone, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING_APPROVAL')
      `);
      for (const d of analysis.reply_drafts) {
        draftStmt.run(
          'draft_' + Math.random().toString(36).slice(2, 10),
          userId,
          email.id,
          email.sender,
          d.subject || `Re: ${email.subject}`,
          d.reply_body,
          d.tone || 'Professional'
        );
      }
    }

    // Log event under user_id
    db.prepare(`
      INSERT INTO activity_logs (id, user_id, event_type, severity, message, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      'log_' + Date.now(),
      userId,
      'AI_CLASSIFIED',
      analysis.is_sensitive ? 'SECURITY' : 'INFO',
      `Email "${email.subject.slice(0, 40)}" analyzed: Category: ${analysis.category}, Priority: ${analysis.priority_score}/5`,
      JSON.stringify({ emailId: email.id, isSensitive: analysis.is_sensitive })
    );

    res.json({
      success: true,
      analysis,
      tasks: db.prepare('SELECT * FROM tasks WHERE email_id = ? AND user_id = ?').all(email.id, userId),
      drafts: db.prepare('SELECT * FROM drafts WHERE email_id = ? AND user_id = ?').all(email.id, userId)
    });
  } catch (err) {
    console.error('[AI Analyze Route Error]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/ai/generate-custom-reply
 * Generates an AI reply draft tailored by user instructions
 */
router.post('/generate-custom-reply', async (req, res) => {
  const userId = req.user.id;
  const { emailId, userInstruction, tone = 'Professional' } = req.body;

  try {
    const email = db.prepare('SELECT * FROM emails WHERE id = ? AND user_id = ?').get(emailId, userId);
    if (!email) {
      return res.status(404).json({ success: false, error: 'Email not found or access denied.' });
    }

    // Security check
    if (email.is_sensitive) {
      return res.status(403).json({
        success: false,
        error: 'Privacy Guard Block: This email contains sensitive credentials or financial data. Sending to external AI is blocked.'
      });
    }

    const replyBody = await generateCustomReply({
      email,
      userInstruction,
      tone
    });

    const draftId = 'draft_' + Math.random().toString(36).slice(2, 10);
    const subject = email.subject.startsWith('Re:') ? email.subject : `Re: ${email.subject}`;

    db.prepare(`
      INSERT INTO drafts (id, user_id, email_id, to_address, subject, reply_body, tone, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING_APPROVAL')
    `).run(
      draftId,
      userId,
      email.id,
      email.sender,
      subject,
      replyBody,
      tone
    );

    const createdDraft = db.prepare('SELECT * FROM drafts WHERE id = ? AND user_id = ?').get(draftId, userId);
    res.json({ success: true, draft: createdDraft });
  } catch (err) {
    console.error('[AI Custom Reply Error]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
