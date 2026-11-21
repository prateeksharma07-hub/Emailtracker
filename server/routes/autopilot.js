import express from 'express';
import rateLimit from 'express-rate-limit';
import { db } from '../db/database.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { 
  analyzeNeedsReply, 
  generateThreeToneDrafts, 
  regenerateDraftWithUserInstruction, 
  findFollowUpCandidates, 
  prepareFollowUpDraft, 
  approveAutopilotDraft 
} from '../services/autopilotService.js';

const router = express.Router();

// Rate limiter for autopilot actions
const autopilotLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { success: false, error: 'Autopilot rate limit reached. Please wait a minute.' },
  standardHeaders: true,
  legacyHeaders: false
});

router.use(requireAuth);

/**
 * GET /api/autopilot/queue
 * Returns the current Autopilot work queue:
 * - Emails requiring reply with their 3-tone drafts
 * - Follow-up candidates
 * - Detained security items count
 */
router.get('/queue', async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Get emails marked as needs_reply = 1
    let replyCandidates = db.prepare(`
      SELECT * FROM emails 
      WHERE user_id = ? AND (needs_reply = 1 OR category IN ('Meeting', 'Urgent', 'Work'))
      ORDER BY priority_score DESC, date_received DESC
      LIMIT 25
    `).all(userId);

    // If an email has not been analyzed for needs_reply yet, do so on-demand
    const enrichedReplies = [];
    for (const email of replyCandidates) {
      if (email.needs_reply === null || email.needs_reply === undefined) {
        const triage = await analyzeNeedsReply(email);
        db.prepare(`
          UPDATE emails 
          SET needs_reply = ?, needs_reply_reason = ?, needs_reply_urgency = ?, suggested_action = ?, detected_language = ?
          WHERE id = ? AND user_id = ?
        `).run(
          triage.needs_reply ? 1 : 0,
          triage.reason,
          triage.urgency,
          triage.suggested_action,
          triage.detected_language,
          email.id,
          userId
        );
        email.needs_reply = triage.needs_reply ? 1 : 0;
        email.needs_reply_reason = triage.reason;
        email.needs_reply_urgency = triage.urgency;
        email.suggested_action = triage.suggested_action;
        email.detected_language = triage.detected_language;
      }

      if (email.needs_reply === 1) {
        // Fetch or create 3-tone drafts
        let drafts = db.prepare(`
          SELECT * FROM drafts 
          WHERE email_id = ? AND user_id = ? AND status = 'PENDING_APPROVAL'
          ORDER BY created_at ASC
        `).all(email.id, userId);

        if (drafts.length === 0) {
          const generated = await generateThreeToneDrafts(email, email.detected_language || 'English');
          const insertStmt = db.prepare(`
            INSERT INTO drafts (id, user_id, email_id, to_address, subject, reply_body, tone, language, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_APPROVAL')
          `);
          for (const d of generated) {
            const draftId = 'dft_' + Math.random().toString(36).slice(2, 10);
            insertStmt.run(
              draftId,
              userId,
              email.id,
              email.sender,
              `Re: ${email.subject}`,
              d.reply_body,
              d.tone,
              d.language || 'English'
            );
          }
          drafts = db.prepare(`
            SELECT * FROM drafts 
            WHERE email_id = ? AND user_id = ? AND status = 'PENDING_APPROVAL'
          `).all(email.id, userId);
        }

        enrichedReplies.push({
          ...email,
          drafts
        });
      }
    }

    // 2. Find follow-up candidates
    const followUps = findFollowUpCandidates(userId, 3);
    const enrichedFollowUps = [];
    for (const fu of followUps.slice(0, 5)) {
      const draft = await prepareFollowUpDraft(fu, userId);
      enrichedFollowUps.push({
        ...fu,
        draft
      });
    }

    // 3. Count detained emails
    const detainedCount = db.prepare(`
      SELECT COUNT(*) as count FROM emails 
      WHERE user_id = ? AND shield_verdict = 'DETAINED'
    `).get(userId)?.count || 0;

    res.json({
      success: true,
      summary: {
        repliesReady: enrichedReplies.length,
        followUpsReady: enrichedFollowUps.length,
        detainedCount
      },
      queue: enrichedReplies,
      followUps: enrichedFollowUps
    });
  } catch (err) {
    console.error('[Autopilot Queue Error]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/autopilot/generate-draft
 * Regenerates an AI response draft based on user custom instruction
 */
router.post('/generate-draft', autopilotLimiter, async (req, res) => {
  try {
    const userId = req.user.id;
    const { emailId, instruction, tone = 'Professional', language = 'English' } = req.body;

    if (!emailId || !instruction) {
      return res.status(400).json({ success: false, error: 'Email ID and instruction are required.' });
    }

    const email = db.prepare('SELECT * FROM emails WHERE id = ? AND user_id = ?').get(emailId, userId);
    if (!email) {
      return res.status(404).json({ success: false, error: 'Email not found or access denied.' });
    }

    if (email.shield_verdict === 'DETAINED') {
      return res.status(403).json({
        success: false,
        error: 'Cannot generate AI response for a DETAINED email (quarantined prompt injection).'
      });
    }

    const draftData = await regenerateDraftWithUserInstruction(email, instruction, tone, language);

    // Save as draft in local database
    const draftId = 'dft_custom_' + Math.random().toString(36).slice(2, 10);
    db.prepare(`
      INSERT INTO drafts (id, user_id, email_id, to_address, subject, reply_body, tone, language, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_APPROVAL')
    `).run(
      draftId,
      userId,
      email.id,
      email.sender,
      `Re: ${email.subject}`,
      draftData.reply_body,
      tone,
      language
    );

    const savedDraft = db.prepare('SELECT * FROM drafts WHERE id = ?').get(draftId);
    res.json({
      success: true,
      draft: savedDraft
    });
  } catch (err) {
    console.error('[Autopilot Generate Draft Error]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/autopilot/approve/:draftId
 * Strictly human-gated approval to push draft to Gmail Drafts
 */
router.post('/approve/:draftId', autopilotLimiter, async (req, res) => {
  try {
    const userId = req.user.id;
    const draftId = req.params.draftId;
    const { confirmHumanApproval, editedBody, csrfToken } = req.body;

    const result = await approveAutopilotDraft(draftId, userId, {
      confirmHumanApproval,
      editedBody,
      csrfToken
    });

    res.json(result);
  } catch (err) {
    console.error('[Autopilot Approve Error]', err.message);
    const status = err.statusCode || 500;
    res.status(status).json({ success: false, error: err.message });
  }
});

export default router;
