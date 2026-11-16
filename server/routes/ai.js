import express from 'express';
import { db } from '../db/database.js';
import { analyzeEmail, generateCustomReply } from '../services/groqService.js';

const router = express.Router();

/**
 * POST /api/ai/analyze/:emailId
 * Runs AI intelligence pipeline on a specific email
 */
router.post('/analyze/:emailId', async (req, res) => {
  try {
    const email = db.prepare('SELECT * FROM emails WHERE id = ?').get(req.params.emailId);
    if (!email) {
      return res.status(404).json({ success: false, error: 'Email not found' });
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
      WHERE id = ?
    `).run(
      analysis.category,
      analysis.priority_score,
      analysis.summary,
      analysis.is_sensitive ? 1 : 0,
      analysis.sensitive_type || null,
      email.id
    );

    // Update tasks
    db.prepare('DELETE FROM tasks WHERE email_id = ?').run(email.id);
    if (analysis.tasks && analysis.tasks.length > 0) {
      const taskStmt = db.prepare(`
        INSERT INTO tasks (id, email_id, task_title, deadline_date, deadline_text)
        VALUES (?, ?, ?, ?, ?)
      `);
      for (const t of analysis.tasks) {
        taskStmt.run(
          'task_' + Math.random().toString(36).slice(2, 10),
          email.id,
          t.task_title,
          t.deadline_date || null,
          t.deadline_text || null
        );
      }
    }

    // Refresh reply drafts if clean
    if (analysis.reply_drafts && analysis.reply_drafts.length > 0) {
      const draftStmt = db.prepare(`
        INSERT INTO drafts (id, email_id, to_address, subject, reply_body, tone, status)
        VALUES (?, ?, ?, ?, ?, ?, 'PENDING_APPROVAL')
      `);
      for (const d of analysis.reply_drafts) {
        draftStmt.run(
          'draft_' + Math.random().toString(36).slice(2, 10),
          email.id,
          email.sender,
          d.subject || `Re: ${email.subject}`,
          d.reply_body,
          d.tone || 'Professional'
        );
      }
    }

    // Log event
    db.prepare(`
      INSERT INTO activity_logs (id, event_type, severity, message, metadata)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      'log_' + Date.now(),
      'AI_CLASSIFIED',
      analysis.is_sensitive ? 'SECURITY' : 'INFO',
      `Email "${email.subject.slice(0, 40)}" analyzed: Category: ${analysis.category}, Priority: ${analysis.priority_score}/5`,
      JSON.stringify({ emailId: email.id, isSensitive: analysis.is_sensitive })
    );

    res.json({
      success: true,
      analysis,
      tasks: db.prepare('SELECT * FROM tasks WHERE email_id = ?').all(email.id),
      drafts: db.prepare('SELECT * FROM drafts WHERE email_id = ?').all(email.id)
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
  const { emailId, userInstruction, tone = 'Professional' } = req.body;

  try {
    const email = db.prepare('SELECT * FROM emails WHERE id = ?').get(emailId);
    if (!email) {
      return res.status(404).json({ success: false, error: 'Email not found' });
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
      INSERT INTO drafts (id, email_id, to_address, subject, reply_body, tone, status)
      VALUES (?, ?, ?, ?, ?, ?, 'PENDING_APPROVAL')
    `).run(
      draftId,
      email.id,
      email.sender,
      subject,
      replyBody,
      tone
    );

    const createdDraft = db.prepare('SELECT * FROM drafts WHERE id = ?').get(draftId);
    res.json({ success: true, draft: createdDraft });
  } catch (err) {
    console.error('[AI Custom Reply Error]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
