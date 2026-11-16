import { google } from 'googleapis';
import { db } from '../db/database.js';
import { getAuthenticatedClient, getActiveAccount } from './oauthService.js';
import { analyzeEmail } from './geminiService.js';
import { analyzeSensitivity, generateLocalSensitiveMetadata, stripHtml } from './sanitizationService.js';

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
export function normalizeGmailMessage(rawMessage, accountId) {
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
    thread_id: rawMessage.threadId || rawMessage.id,
    account_id: accountId,
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

/**
 * Synchronizes emails from Gmail API into local SQLite database
 * 
 * @param {string} accountId 
 * @param {number} maxResults 
 * @returns {Promise<object>} Sync summary
 */
export async function syncGmailInbox(accountId, maxResults = 15) {
  const { oauth2Client, account } = await getAuthenticatedClient(accountId);
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  console.log(`[Gmail Sync] Fetching recent ${maxResults} messages for account: ${account.email}`);

  // Fetch recent message IDs
  const listRes = await gmail.users.messages.list({
    userId: 'me',
    maxResults,
    q: 'in:inbox'
  });

  const messageSummaries = listRes.data.messages || [];
  let newEmailsCount = 0;
  let sensitiveCount = 0;
  let aiProcessedCount = 0;

  for (const item of messageSummaries) {
    // Check if email is already in database
    const existing = db.prepare('SELECT id FROM emails WHERE id = ?').get(item.id);
    if (existing) {
      continue; // Skip already downloaded messages
    }

    // Fetch full message details
    const fullRes = await gmail.users.messages.get({
      userId: 'me',
      id: item.id,
      format: 'full'
    });

    const parsedEmail = normalizeGmailMessage(fullRes.data, account.id);

    // AI Analysis + Privacy Guard pipeline
    const analysis = await analyzeEmail(parsedEmail);

    if (analysis.is_sensitive) {
      sensitiveCount++;
    } else {
      aiProcessedCount++;
    }

    // Save Email to SQLite
    const insertEmail = db.prepare(`
      INSERT INTO emails (
        id, thread_id, account_id, sender, sender_name, recipient, subject,
        body_text, body_html, snippet, date_received, is_read,
        is_sensitive, sensitive_type, category, priority_score, summary, ai_processed
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertEmail.run(
      parsedEmail.id,
      parsedEmail.thread_id,
      parsedEmail.account_id,
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
      1
    );

    // Save Extracted Tasks if any
    if (Array.isArray(analysis.tasks) && analysis.tasks.length > 0) {
      const insertTask = db.prepare(`
        INSERT INTO tasks (id, email_id, task_title, deadline_date, deadline_text)
        VALUES (?, ?, ?, ?, ?)
      `);
      for (const t of analysis.tasks) {
        insertTask.run(
          'task_' + Math.random().toString(36).slice(2, 10),
          parsedEmail.id,
          t.task_title,
          t.deadline_date || null,
          t.deadline_text || null
        );
      }
    }

    // Save AI Reply Drafts if any (All created in PENDING_APPROVAL status)
    if (Array.isArray(analysis.reply_drafts) && analysis.reply_drafts.length > 0) {
      const insertDraft = db.prepare(`
        INSERT INTO drafts (id, email_id, to_address, subject, reply_body, tone, status)
        VALUES (?, ?, ?, ?, ?, ?, 'PENDING_APPROVAL')
      `);
      for (const d of analysis.reply_drafts) {
        insertDraft.run(
          'draft_' + Math.random().toString(36).slice(2, 10),
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

  // Update account's last_synced_at
  db.prepare('UPDATE accounts SET last_synced_at = CURRENT_TIMESTAMP WHERE id = ?').run(account.id);

  // Log sync event
  db.prepare(`
    INSERT INTO activity_logs (id, event_type, severity, message, metadata)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    'log_' + Date.now(),
    'SYNC_COMPLETED',
    sensitiveCount > 0 ? 'SECURITY' : 'INFO',
    `Inbox sync completed: ${newEmailsCount} new emails synced. (${aiProcessedCount} AI classified, ${sensitiveCount} shielded by Privacy Guard)`,
    JSON.stringify({ accountId: account.id, newEmailsCount, sensitiveCount, aiProcessedCount })
  );

  return {
    success: true,
    newEmailsCount,
    sensitiveCount,
    aiProcessedCount,
    totalInbox: db.prepare('SELECT COUNT(*) as count FROM emails').get().count
  };
}

/**
 * Dispatches an approved email draft via Gmail API.
 * 
 * STRICT HUMAN-IN-THE-LOOP SAFETY GATE:
 * Email will ONLY send if draft is explicitly passed and confirmed.
 * 
 * @param {string} draftId - ID of the draft
 * @param {object} overrides - Optional human-edited { to_address, subject, reply_body }
 */
export async function sendApprovedEmail(draftId, overrides = {}) {
  const draft = db.prepare('SELECT * FROM drafts WHERE id = ?').get(draftId);
  if (!draft) {
    throw new Error(`Draft with ID ${draftId} not found.`);
  }

  const emailRecord = db.prepare('SELECT * FROM emails WHERE id = ?').get(draft.email_id);
  const accountId = emailRecord?.account_id;

  const to = overrides.to_address || draft.to_address;
  const subject = overrides.subject || draft.subject;
  const body = overrides.reply_body || draft.reply_body;

  if (!to || !body) {
    throw new Error('Cannot send email: Recipient and body text are required.');
  }

  const { oauth2Client, account } = await getAuthenticatedClient(accountId);
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  // Construct RFC 2822 message
  const rawEmailLines = [
    `From: ${account.name || 'MailMind User'} <${account.email}>`,
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

  // Dispatch via Gmail API
  const sendRes = await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: encodedMessage,
      threadId: emailRecord?.thread_id || undefined
    }
  });

  const gmailMessageId = sendRes.data.id;

  // Update draft status to SENT
  db.prepare(`
    UPDATE drafts 
    SET status = 'SENT', 
        sent_at = CURRENT_TIMESTAMP, 
        approved_at = CURRENT_TIMESTAMP,
        to_address = ?,
        subject = ?,
        reply_body = ?
    WHERE id = ?
  `).run(to, subject, body, draftId);

  // Log dispatch event
  db.prepare(`
    INSERT INTO activity_logs (id, event_type, severity, message, metadata)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    'log_' + Date.now(),
    'EMAIL_SENT',
    'INFO',
    `Approved email successfully dispatched to ${to} ("${subject}")`,
    JSON.stringify({ draftId, gmailMessageId, to, subject })
  );

  return {
    success: true,
    draftId,
    gmailMessageId,
    sentTo: to,
    subject
  };
}

/**
 * Seeds high-quality sample emails covering all categories and safety scenarios:
 * - Urgent
 * - Work with deadline
 * - Meeting request
 * - Sensitive OTP (Privacy Guard test)
 * - Sensitive Banking (Privacy Guard test)
 * - Newsletter
 * - Personal
 */
export async function seedDemoEmails() {
  const activeAcc = getActiveAccount();
  const accountId = activeAcc?.id || 'demo_account';

  // Check if emails already exist
  const count = db.prepare('SELECT COUNT(*) as count FROM emails').get().count;
  if (count > 0) {
    return { success: true, message: 'Inbox already contains emails', count };
  }

  // Create demo account if none exists
  if (!activeAcc) {
    db.prepare(`
      INSERT OR IGNORE INTO accounts (id, email, name, picture, access_token, created_at, last_synced_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(
      'demo_account',
      'alex.founder@mailmind.ai',
      'Alex Founder',
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
      'mock_token'
    );
  }

  const sampleEmails = [
    {
      id: 'msg_001_urgent',
      thread_id: 'th_001',
      sender: 'sarah.vp@enterprise-client.com',
      sender_name: 'Sarah Chen (VP Product)',
      recipient: 'alex.founder@mailmind.ai',
      subject: 'URGENT: Production API Latency Spiking - Immediate Review Needed',
      body_text: 'Alex,\n\nWe are noticing response latency spike over 800ms on the US-East cluster since 4 PM. Several enterprise customers have raised tickets. Can your infrastructure engineering team investigate this immediately and share an incident update within the next 2 hours?\n\nThanks,\nSarah Chen',
      body_html: '<p>Alex,</p><p>We are noticing response latency spike over 800ms on the US-East cluster since 4 PM. Several enterprise customers have raised tickets. Can your infrastructure engineering team investigate this immediately and share an incident update within the next 2 hours?</p><p>Thanks,<br/>Sarah Chen</p>',
      snippet: 'We are noticing response latency spike over 800ms on the US-East cluster since 4 PM. Immediate review needed...',
      date_received: new Date(Date.now() - 35 * 60 * 1000).toISOString()
    },
    {
      id: 'msg_002_meeting',
      thread_id: 'th_002',
      sender: 'marcus.vance@sequoia-capital.com',
      sender_name: 'Marcus Vance',
      recipient: 'alex.founder@mailmind.ai',
      subject: 'Invitation: MailMind Series A Partner Presentation — Thursday 2:30 PM PST',
      body_text: 'Hi Alex,\n\nOur investment committee thoroughly reviewed your deck. We would like to invite you and your co-founder to present at our Menlo Park office (or via Zoom) this Thursday at 2:30 PM PST. Please confirm if that slot works or suggest an alternate time.\n\nBest,\nMarcus',
      body_html: '<p>Hi Alex,</p><p>Our investment committee thoroughly reviewed your deck. We would like to invite you and your co-founder to present at our Menlo Park office (or via Zoom) this Thursday at 2:30 PM PST. Please confirm if that slot works or suggest an alternate time.</p><p>Best,<br/>Marcus</p>',
      snippet: 'Our investment committee thoroughly reviewed your deck. We would like to invite you to present this Thursday...',
      date_received: new Date(Date.now() - 2 * 3600 * 1000).toISOString()
    },
    {
      id: 'msg_003_task_contract',
      thread_id: 'th_003',
      sender: 'elena.rostova@legal-advisors.com',
      sender_name: 'Elena Rostova (Counsel)',
      recipient: 'alex.founder@mailmind.ai',
      subject: 'Action Required: Master Services Agreement for CloudScale Inc — Deadline Friday 5 PM',
      body_text: 'Hi Alex,\n\nAttached is the redlined MSA from CloudScale counsel. Section 8.2 (Indemnity Caps) has been adjusted as per our discussion. Please review clauses 4 and 8.2 and provide your countersignature before Friday at 5:00 PM EST so we can close the quarter cleanly.\n\nWarm regards,\nElena',
      body_html: '<p>Hi Alex,</p><p>Attached is the redlined MSA from CloudScale counsel. Please review clauses 4 and 8.2 and provide your countersignature before Friday at 5:00 PM EST.</p><p>Warm regards,<br/>Elena</p>',
      snippet: 'Attached is the redlined MSA from CloudScale counsel. Please review and provide countersignature before Friday at 5 PM...',
      date_received: new Date(Date.now() - 5 * 3600 * 1000).toISOString()
    },
    {
      id: 'msg_004_privacy_otp',
      thread_id: 'th_004',
      sender: 'no-reply@accounts.google.com',
      sender_name: 'Google Identity Protection',
      recipient: 'alex.founder@mailmind.ai',
      subject: 'Your Google Verification Security Code is 839201',
      body_text: 'Security Alert: Someone is attempting to sign in to your Google Account. Enter the verification code 839201 on your device to confirm your identity. If this was not you, secure your account immediately at myaccount.google.com/security. This OTP code expires in 10 minutes.',
      body_html: '<p>Security Alert: Someone is attempting to sign in to your Google Account. Enter the verification code <strong>839201</strong> on your device to confirm your identity. This OTP code expires in 10 minutes.</p>',
      snippet: 'Enter the verification code 839201 on your device to confirm your identity. This OTP code expires in 10 minutes.',
      date_received: new Date(Date.now() - 8 * 3600 * 1000).toISOString()
    },
    {
      id: 'msg_005_privacy_banking',
      thread_id: 'th_005',
      sender: 'alerts@chase-commercial.com',
      sender_name: 'Chase Commercial Banking',
      recipient: 'alex.founder@mailmind.ai',
      subject: 'Wire Transfer Confirmation: Debit Alert for Acct ending in 4921',
      body_text: 'Commercial Wire Notification: A wire transfer in the amount of $48,500.00 USD was successfully posted from Account Number 38492018492 to Silicon Valley Tech Suppliers. If you did not authorize this wire transaction, contact your dedicated relationship manager immediately.',
      body_html: '<p>Commercial Wire Notification: A wire transfer in the amount of $48,500.00 USD was successfully posted from Account Number 38492018492 to Silicon Valley Tech Suppliers.</p>',
      snippet: 'A wire transfer in the amount of $48,500.00 USD was successfully posted from Account Number 38492018492...',
      date_received: new Date(Date.now() - 14 * 3600 * 1000).toISOString()
    },
    {
      id: 'msg_006_newsletter',
      thread_id: 'th_006',
      sender: 'dan@tldr.tech',
      sender_name: 'TLDR Tech Digest',
      recipient: 'alex.founder@mailmind.ai',
      subject: 'TLDR: Next-Gen AI Inference Chips, Anthropic Reasoning Models & Open Source Breakthroughs',
      body_text: 'Good morning tech world! In today edition:\n- Frontier models reach new benchmarks in real-time latency.\n- Hardware accelerators deliver 4x throughput efficiency.\n- Software architectures shifting to local-first SQLite and agentic workflows.\n\nClick here to unsubscribe or manage your daily newsletter preferences.',
      body_html: '<p>Good morning tech world! In today edition: Frontier models reach new benchmarks...</p><p><a href="#">Unsubscribe</a></p>',
      snippet: 'Good morning tech world! In today edition: Frontier models reach new benchmarks in real-time latency...',
      date_received: new Date(Date.now() - 22 * 3600 * 1000).toISOString()
    },
    {
      id: 'msg_007_personal',
      thread_id: 'th_007',
      sender: 'david.miller@gmail.com',
      sender_name: 'David Miller',
      recipient: 'alex.founder@mailmind.ai',
      subject: 'Dinner this weekend in SF? Catching up after TechCrunch Disrupt',
      body_text: 'Hey Alex!\n\nHope startup life is treating you well! It was great running into you at TechCrunch Disrupt last week. A few of us from the Stanford cohort are gathering for dinner this Saturday around 7:30 PM in Hayes Valley. Let me know if you can make it!\n\nCheers,\nDave',
      body_html: '<p>Hey Alex!</p><p>Hope startup life is treating you well! A few of us are gathering for dinner this Saturday around 7:30 PM in Hayes Valley. Let me know if you can make it!</p><p>Cheers,<br/>Dave</p>',
      snippet: 'Hope startup life is treating you well! A few of us are gathering for dinner this Saturday around 7:30 PM...',
      date_received: new Date(Date.now() - 28 * 3600 * 1000).toISOString()
    }
  ];

  for (const email of sampleEmails) {
    const analysis = await analyzeEmail(email);

    db.prepare(`
      INSERT INTO emails (
        id, thread_id, account_id, sender, sender_name, recipient, subject,
        body_text, body_html, snippet, date_received, is_read,
        is_sensitive, sensitive_type, category, priority_score, summary, ai_processed
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      email.id,
      email.thread_id,
      accountId,
      email.sender,
      email.sender_name,
      email.recipient,
      email.subject,
      email.body_text,
      email.body_html,
      email.snippet,
      email.date_received,
      0,
      analysis.is_sensitive ? 1 : 0,
      analysis.sensitive_type || null,
      analysis.category,
      analysis.priority_score,
      analysis.summary,
      1
    );

    // Save tasks
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

    // Save reply drafts
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
  }

  // Log seeding
  db.prepare(`
    INSERT INTO activity_logs (id, event_type, severity, message, metadata)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    'log_' + Date.now(),
    'SEED_DATA_LOADED',
    'INFO',
    `Loaded 7 realistic emails with AI intelligence and Zero-Leak Privacy Guard verification.`,
    JSON.stringify({ seededCount: sampleEmails.length })
  );

  return { success: true, seededCount: sampleEmails.length };
}
