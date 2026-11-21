import { google } from 'googleapis';
import { db } from '../db/database.js';
import { getAuthenticatedClientForUser } from './oauthService.js';
import { analyzeEmail, fastClassifyEmail } from './groqService.js';
import { analyzeSensitivity, generateLocalSensitiveMetadata, stripHtml } from './sanitizationService.js';
import { runShieldPipeline } from './shield/shieldPipeline.js';
import { validateAiOutput } from './shield/outputValidator.js';

// Simple concurrency limiter to prevent Groq API 429 rate limit spikes during concurrent user syncs
class ConcurrencyLimiter {
  constructor(maxConcurrency = 2) {
    this.maxConcurrency = maxConcurrency;
    this.current = 0;
    this.queue = [];
  }

  async run(fn) {
    if (this.current >= this.maxConcurrency) {
      await new Promise(resolve => this.queue.push(resolve));
    }
    this.current++;
    try {
      return await fn();
    } finally {
      this.current--;
      if (this.queue.length > 0) {
        const next = this.queue.shift();
        next();
      }
    }
  }
}

const aiLimiter = new ConcurrencyLimiter(2);

/**
 * Base64url decoder for Gmail message payloads
 */
function decodeBase64(data) {
  if (!data) return '';
  const sanitized = data.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(sanitized, 'base64').toString('utf8');
}

/**
 * Extracts plain text and HTML bodies from a Gmail MIME message tree
 */
function extractBodiesFromPayload(payload) {
  let bodyText = '';
  let bodyHtml = '';

  if (!payload) return { bodyText, bodyHtml };

  // If payload itself has data
  if (payload.body && payload.body.data) {
    if (payload.mimeType === 'text/html') {
      bodyHtml = decodeBase64(payload.body.data);
    } else {
      bodyText = decodeBase64(payload.body.data);
    }
  }

  // If payload has subparts
  if (Array.isArray(payload.parts)) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body && part.body.data && !bodyText) {
        bodyText = decodeBase64(part.body.data);
      } else if (part.mimeType === 'text/html' && part.body && part.body.data && !bodyHtml) {
        bodyHtml = decodeBase64(part.body.data);
      } else if (part.parts) {
        const nested = extractBodiesFromPayload(part);
        if (!bodyText && nested.bodyText) bodyText = nested.bodyText;
        if (!bodyHtml && nested.bodyHtml) bodyHtml = nested.bodyHtml;
      }
    }
  }

  return { bodyText, bodyHtml };
}

/**
 * Parses header fields from Gmail message payload
 */
function getHeader(headers = [], name) {
  const match = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
  return match ? match.value : '';
}

/**
 * Parses "Name <email@example.com>" or "email@example.com"
 */
function parseEmailSender(fromString) {
  if (!fromString) return { sender: 'unknown@example.com', sender_name: 'Unknown Sender' };
  const match = fromString.match(/^(?:"?([^"]*)"?\s)?(?:<?(.+@[^>]+)>?)$/);
  if (match) {
    const sender_name = match[1] ? match[1].trim() : match[2].split('@')[0];
    const sender = match[2].trim();
    return { sender, sender_name };
  }
  return { sender: fromString.trim(), sender_name: fromString.split('@')[0] };
}

/**
 * Normalizes a raw Gmail message object into MailMind database format
 */
export function normalizeGmailMessage(rawMessage, userId) {
  const payload = rawMessage.payload || {};
  const headers = payload.headers || [];

  const subject = getHeader(headers, 'Subject') || '(No Subject)';
  const fromHeader = getHeader(headers, 'From');
  const recipient = getHeader(headers, 'To') || 'me';
  const dateHeader = getHeader(headers, 'Date');

  const { sender, sender_name } = parseEmailSender(fromHeader);
  const { bodyText, bodyHtml } = extractBodiesFromPayload(payload);
  const snippet = rawMessage.snippet || bodyText.slice(0, 150) || '';

  let dateReceived;
  try {
    dateReceived = dateHeader ? new Date(dateHeader).toISOString() : new Date().toISOString();
  } catch (e) {
    dateReceived = new Date().toISOString();
  }

  return {
    id: rawMessage.id,
    user_id: userId,
    thread_id: rawMessage.threadId || rawMessage.id,
    account_id: userId,
    sender,
    sender_name,
    recipient,
    subject,
    body_text: bodyText || stripHtml(bodyHtml),
    body_html: bodyHtml || `<p>${bodyText}</p>`,
    snippet,
    date_received: dateReceived,
    is_read: rawMessage.labelIds?.includes('UNREAD') ? 0 : 1
  };
}

// Track active syncs per user to prevent concurrent double-sync for the same user
const activeUserSyncs = new Set();

/**
 * Synchronizes emails from live Gmail API into local SQLite database for a specific user.
 * 
 * STRICT MULTI-USER ISOLATION:
 * - Operates strictly with user's decrypted OAuth tokens.
 * - Enforces WHERE user_id = ? on all queries and inserts.
 * - Protects Groq rate limits with concurrency queue.
 * - BATCH_SIZE = 20 for parallel fetching.
 * 
 * @param {string} userId 
 * @param {object} options - { maxResults: 30, pageToken: null }
 * @returns {Promise<object>} Sync summary
 */
export async function syncGmailInbox(userId, options = {}) {
  const maxResults = options.maxResults || 30;
  const pageToken = options.pageToken || undefined;

  // Prevent double-sync for the same user
  if (activeUserSyncs.has(userId)) {
    console.log(`[Gmail Sync] Synchronization already running for user ${userId}. Returning ongoing status.`);
    return {
      success: true,
      mode: 'LIVE',
      newEmailsCount: 0,
      isOngoing: true,
      totalInbox: db.prepare('SELECT COUNT(*) as c FROM emails WHERE user_id = ?').get(userId)?.c || 0,
      lastSyncedAt: new Date().toISOString()
    };
  }

  activeUserSyncs.add(userId);

  try {
    const authData = await getAuthenticatedClientForUser(userId);
    const { oauth2Client, user } = authData;

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    console.log(`[Gmail Sync] Fetching recent ${maxResults} messages from Gmail API for: ${user.email} (userId: ${userId})`);

    let listRes;
    try {
      listRes = await gmail.users.messages.list({
        userId: 'me',
        maxResults,
        pageToken,
        q: 'in:inbox'
      });
    } catch (apiErr) {
      console.error('[Gmail API Error] List messages failed:', apiErr.message);

      if (apiErr.code === 401 || apiErr.message?.includes('invalid_grant') || apiErr.message?.includes('Token has been expired or revoked')) {
        const tokenErr = new Error('Your Google session has expired or been revoked. Please reconnect your Gmail account.');
        tokenErr.code = 'TOKEN_EXPIRED';
        throw tokenErr;
      }
      throw apiErr;
    }

    const messageSummaries = listRes.data.messages || [];
    let newEmailsCount = 0;
    let skippedDuplicates = 0;
    let sensitiveCount = 0;
    let aiProcessedCount = 0;

    // 1. User-isolated duplicate detection using SQLite index
    const existingIds = new Set(
      db.prepare('SELECT id FROM emails WHERE user_id = ?').all(userId).map(r => r.id)
    );

    const pendingSummaries = [];
    for (const item of messageSummaries) {
      if (existingIds.has(item.id)) {
        skippedDuplicates++;
      } else {
        pendingSummaries.push(item);
      }
    }

    console.log(`[Gmail Sync] User ${user.email}: ${skippedDuplicates} duplicate emails skipped. Fetching ${pendingSummaries.length} new messages in parallel...`);

    // 2. Fetch full message payloads in parallel batches of 20
    const BATCH_SIZE = 20;
    const parsedEmails = [];

    for (let i = 0; i < pendingSummaries.length; i += BATCH_SIZE) {
      const chunk = pendingSummaries.slice(i, i + BATCH_SIZE);
      const chunkResults = await Promise.allSettled(
        chunk.map(item => gmail.users.messages.get({ userId: 'me', id: item.id, format: 'full' }))
      );

      for (const res of chunkResults) {
        if (res.status === 'fulfilled' && res.value?.data) {
          parsedEmails.push(normalizeGmailMessage(res.value.data, userId));
        }
      }
    }

    // 3. AI Triage & Shield Firewall
    for (let i = 0; i < parsedEmails.length; i++) {
      const parsedEmail = parsedEmails[i];
      let analysis;

      // A. Run Shield + X-Ray Pipeline
      const shieldResult = await runShieldPipeline(parsedEmail);

      // Persist Shield scan result
      const scanId = 'scan_' + Math.random().toString(36).slice(2, 10);
      try {
        db.prepare(`
          INSERT INTO shield_scans (
            id, user_id, email_id, verdict, threat_score, layers_json,
            hidden_segments_json, visible_text, ai_text
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          scanId,
          userId,
          parsedEmail.id,
          shieldResult.verdict,
          shieldResult.threatScore,
          JSON.stringify(shieldResult.layers),
          JSON.stringify(shieldResult.hiddenSegments),
          shieldResult.visibleText,
          shieldResult.aiText
        );
      } catch (scanErr) {
        console.warn('[Shield Save Notice]', scanErr.message);
      }

      // B. Security-gated LLM processing
      if (shieldResult.verdict === 'DETAINED') {
        // Halt AI reply generation and apply containment template
        analysis = {
          category: 'Urgent',
          priority_score: 5,
          summary: `[FIREWALL DETAINED] Suspicious prompt-injection instructions detected in email payload. Autonomous AI summary halted to prevent prompt execution. Threat Score: ${shieldResult.threatScore}/100.`,
          is_sensitive: 0,
          tasks: [
            {
              task_title: `Verify authenticity of flagged email via phone or in-person channel`,
              deadline_text: 'Immediate Security Review'
            }
          ],
          reply_drafts: [
            {
              tone: 'Professional',
              subject: `Re: ${parsedEmail.subject}`,
              reply_body: 'Is mail ko kisi dusre channel (call/in-person) se verify karo. (Security Firewall Flagged: Hidden adversarial instructions detected).'
            }
          ]
        };
      } else {
        // For SUSPICIOUS emails, feed ONLY visibleText (hidden text stripped) to AI
        const emailToAnalyze = shieldResult.verdict === 'SUSPICIOUS'
          ? { ...parsedEmail, body_text: shieldResult.visibleText }
          : parsedEmail;

        // Deep Groq LPU analysis on top 5 newest emails via concurrency limiter
        if (i < 5) {
          try {
            analysis = await aiLimiter.run(() => analyzeEmail(emailToAnalyze));
          } catch (e) {
            analysis = fastClassifyEmail(emailToAnalyze);
          }
        } else {
          analysis = fastClassifyEmail(emailToAnalyze);
        }

        // Validate AI outputs against visible text
        const outputValidation = validateAiOutput(analysis, shieldResult.visibleText);
        if (!outputValidation.isValid) {
          analysis.summary = `[FIREWALL ADVISORY: Potential Output Anomaly] ${analysis.summary}`;
        }
      }

      if (analysis.is_sensitive) {
        sensitiveCount++;
      } else {
        aiProcessedCount++;
      }

      // 4. Store Email Metadata in SQLite strictly under user_id
      const insertEmail = db.prepare(`
        INSERT INTO emails (
          id, user_id, thread_id, account_id, sender, sender_name, recipient, subject,
          body_text, body_html, snippet, date_received, is_read,
          is_sensitive, sensitive_type, category, priority_score, summary, shield_verdict, ai_processed
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          user_id = excluded.user_id,
          category = excluded.category,
          priority_score = excluded.priority_score,
          summary = excluded.summary,
          shield_verdict = excluded.shield_verdict
      `);

      insertEmail.run(
        parsedEmail.id,
        userId,
        parsedEmail.thread_id,
        userId,
        parsedEmail.sender,
        parsedEmail.sender_name,
        parsedEmail.recipient,
        parsedEmail.subject,
        parsedEmail.body_text,
        parsedEmail.body_html,
        parsedEmail.snippet,
        parsedEmail.date_received,
        parsedEmail.is_read,
        analysis.is_sensitive ? 1 : 0,
        analysis.sensitive_type || null,
        analysis.category,
        analysis.priority_score,
        analysis.summary,
        shieldResult.verdict,
        1
      );

      // 5. Save Extracted Action Items under user_id
      if (Array.isArray(analysis.tasks) && analysis.tasks.length > 0) {
        const insertTask = db.prepare(`
          INSERT INTO tasks (id, user_id, email_id, task_title, deadline_date, deadline_text)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        for (const t of analysis.tasks) {
          insertTask.run(
            'task_' + Math.random().toString(36).slice(2, 10),
            userId,
            parsedEmail.id,
            t.task_title,
            t.deadline_date || null,
            t.deadline_text || null
          );
        }
      }

      // 6. Save AI Reply Drafts under user_id
      if (Array.isArray(analysis.reply_drafts) && analysis.reply_drafts.length > 0) {
        const insertDraft = db.prepare(`
          INSERT INTO drafts (id, user_id, email_id, to_address, subject, reply_body, tone, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING_APPROVAL')
        `);
        for (const d of analysis.reply_drafts) {
          insertDraft.run(
            'draft_' + Math.random().toString(36).slice(2, 10),
            userId,
            parsedEmail.id,
            parsedEmail.sender,
            d.subject || `Re: ${parsedEmail.subject}`,
            d.reply_body,
            d.tone || 'Professional'
          );
        }
      }

      newEmailsCount++;
    }

    // 7. Update user's last_sync_at timestamp
    const now = new Date().toISOString();
    db.prepare('UPDATE users SET last_sync_at = ? WHERE id = ?').run(now, userId);

    // 8. Record audit log under user_id
    db.prepare(`
      INSERT INTO activity_logs (id, user_id, event_type, severity, message, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      'log_' + Date.now(),
      userId,
      'SYNC_COMPLETED',
      sensitiveCount > 0 ? 'SECURITY' : 'INFO',
      `Live inbox sync completed: ${newEmailsCount} new emails saved, ${skippedDuplicates} duplicates skipped. (${aiProcessedCount} AI classified, ${sensitiveCount} shielded)`,
      JSON.stringify({ userId, email: user.email, newEmailsCount, skippedDuplicates, sensitiveCount, aiProcessedCount })
    );

    return {
      success: true,
      mode: 'LIVE',
      newEmailsCount,
      skippedDuplicates,
      sensitiveCount,
      aiProcessedCount,
      totalInbox: db.prepare('SELECT COUNT(*) as c FROM emails WHERE user_id = ?').get(userId)?.c || 0,
      lastSyncedAt: now
    };
  } finally {
    activeUserSyncs.delete(userId);
  }
}

// Injectable draft creator for deterministic test suites (Rule 5: Zero external Gmail calls in tests)
let customDraftSender = null;
export function setGmailDraftSender(fn) {
  customDraftSender = fn;
}
export function resetGmailDraftSender() {
  customDraftSender = null;
}

/**
 * Creates an authorized draft in user's Gmail Drafts folder (using minimum permissions `gmail.compose`).
 * STRICT PRIVACY REQUIREMENT:
 * - Does NOT send emails.
 * - Does NOT require `gmail.send` scope.
 * - Human-in-the-loop: executed ONLY when user approves a draft.
 * 
 * @param {string} draftId 
 * @param {string} userId
 * @param {object} overrides 
 */
export async function createGmailDraft(draftId, userId, overrides = {}) {
  // Enforce strict ownership check
  const draft = db.prepare('SELECT * FROM drafts WHERE id = ? AND user_id = ?').get(draftId, userId);
  if (!draft) {
    const err = new Error(`Draft with ID ${draftId} not found or unauthorized.`);
    err.statusCode = 404;
    throw err;
  }

  const to = overrides.to_address || draft.to_address;
  const subject = overrides.subject || draft.subject;
  const body = overrides.reply_body || draft.reply_body;

  // Mock test bypass if custom sender is registered
  if (customDraftSender) {
    const mockRes = await customDraftSender(draftId, userId, overrides);
    db.prepare(`
      UPDATE drafts 
      SET status = 'APPROVED', 
          approved_at = CURRENT_TIMESTAMP,
          to_address = ?,
          subject = ?,
          reply_body = ?
      WHERE id = ? AND user_id = ?
    `).run(to, subject, body, draftId, userId);

    return {
      success: true,
      mode: 'MOCK',
      gmailDraftId: mockRes?.gmailDraftId || 'mock_draft_' + Date.now(),
      message: 'Draft authorized and mocked for testing.'
    };
  }

  const emailRecord = db.prepare('SELECT * FROM emails WHERE id = ? AND user_id = ?').get(draft.email_id, userId);

  const authData = await getAuthenticatedClientForUser(userId);
  const { oauth2Client, user } = authData;

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  // Construct RFC 2822 email format
  const rawEmailLines = [
    `From: ${user.name || 'MailMind User'} <${user.email}>`,
    `To: ${to}`,
    `Subject: =?utf-8?B?${Buffer.from(subject).toString('base64')}?=`,
    `Content-Type: text/plain; charset=utf-8`,
    `MIME-Version: 1.0`,
    ''
  ];

  if (emailRecord?.id) {
    rawEmailLines.splice(3, 0, `In-Reply-To: <${emailRecord.id}>`);
    rawEmailLines.splice(4, 0, `References: <${emailRecord.id}>`);
  }

  rawEmailLines.push(body);
  const rawEmail = rawEmailLines.join('\r\n');
  const encodedMessage = Buffer.from(rawEmail)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  // Push draft to Gmail
  const draftRes = await gmail.users.drafts.create({
    userId: 'me',
    requestBody: {
      message: {
        raw: encodedMessage,
        threadId: emailRecord?.thread_id || undefined
      }
    }
  });

  const gmailDraftId = draftRes.data.id;

  // Update local draft status to APPROVED / CREATED_IN_GMAIL
  db.prepare(`
    UPDATE drafts 
    SET status = 'APPROVED', 
        approved_at = CURRENT_TIMESTAMP,
        to_address = ?,
        subject = ?,
        reply_body = ?
    WHERE id = ? AND user_id = ?
  `).run(to, subject, body, draftId, userId);

  // Log user activity
  db.prepare(`
    INSERT INTO activity_logs (id, user_id, event_type, severity, message, metadata)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    'log_' + Date.now(),
    userId,
    'DRAFT_CREATED_GMAIL',
    'INFO',
    `Created draft in Gmail for ${to} ("${subject}")`,
    JSON.stringify({ draftId, gmailDraftId, to, subject })
  );

  return {
    success: true,
    mode: 'LIVE',
    gmailDraftId,
    message: 'Draft successfully pushed to your Gmail Drafts folder.'
  };
}

/**
 * Rescans an existing email with the Shield pipeline and persists findings
 * 
 * @param {string} emailId 
 * @param {string} userId 
 */
export async function scanAndSaveShieldResult(emailId, userId) {
  const email = db.prepare('SELECT * FROM emails WHERE id = ? AND user_id = ?').get(emailId, userId);
  if (!email) {
    const err = new Error('Email not found or access denied.');
    err.statusCode = 404;
    throw err;
  }

  const shieldResult = await runShieldPipeline(email);

  // Check if scan record already exists
  const existingScan = db.prepare('SELECT id FROM shield_scans WHERE email_id = ? AND user_id = ?').get(emailId, userId);
  const scanId = existingScan?.id || ('scan_' + Math.random().toString(36).slice(2, 10));

  if (existingScan) {
    db.prepare(`
      UPDATE shield_scans 
      SET verdict = ?,
          threat_score = ?,
          layers_json = ?,
          hidden_segments_json = ?,
          visible_text = ?,
          ai_text = ?,
          created_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).run(
      shieldResult.verdict,
      shieldResult.threatScore,
      JSON.stringify(shieldResult.layers),
      JSON.stringify(shieldResult.hiddenSegments),
      shieldResult.visibleText,
      shieldResult.aiText,
      scanId,
      userId
    );
  } else {
    db.prepare(`
      INSERT INTO shield_scans (
        id, user_id, email_id, verdict, threat_score, layers_json,
        hidden_segments_json, visible_text, ai_text
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      scanId,
      userId,
      emailId,
      shieldResult.verdict,
      shieldResult.threatScore,
      JSON.stringify(shieldResult.layers),
      JSON.stringify(shieldResult.hiddenSegments),
      shieldResult.visibleText,
      shieldResult.aiText
    );
  }

  // Update verdict on emails table
  db.prepare('UPDATE emails SET shield_verdict = ? WHERE id = ? AND user_id = ?').run(
    shieldResult.verdict,
    emailId,
    userId
  );

  // Log scan event
  db.prepare(`
    INSERT INTO activity_logs (id, user_id, event_type, severity, message, metadata)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    'log_' + Date.now(),
    userId,
    'SHIELD_SCAN',
    shieldResult.verdict === 'DETAINED' ? 'SECURITY' : (shieldResult.verdict === 'SUSPICIOUS' ? 'WARNING' : 'INFO'),
    `Shield scan completed: Verdict ${shieldResult.verdict} (Threat Score: ${shieldResult.threatScore}/100)`,
    JSON.stringify({ emailId, verdict: shieldResult.verdict, threatScore: shieldResult.threatScore })
  );

  return {
    scanId,
    emailId,
    ...shieldResult
  };
}
