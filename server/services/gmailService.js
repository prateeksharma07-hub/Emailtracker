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
 * Synchronizes emails from live Gmail API into local SQLite database.
 * 
 * REQUIREMENTS COMPLIANCE:
 * - Fetches latest 20 emails by default.
 * - Supports pagination (pageToken).
 * - Avoids duplicates using Gmail message IDs.
 * - Extracts and stores sender, subject, date, snippet, and read/unread status.
 * - Associates all records with the authenticated account_id.
 * - Safeguards sensitive data before AI triage.
 * - Detects and handles expired or revoked Google tokens.
 * 
 * @param {string} accountId 
 * @param {object} options - { maxResults: 20, pageToken: null }
 * @returns {Promise<object>} Sync summary
 */
export async function syncGmailInbox(accountId, options = {}) {
  const maxResults = options.maxResults || 20;
  const pageToken = options.pageToken || undefined;

  const authData = await getAuthenticatedClient(accountId);
  const { oauth2Client, account, isDemo } = authData;

  // Handle Demo mode sync
  if (isDemo) {
    console.log('[Gmail Sync] Demo Mode active. Returning local sample data status.');
    return {
      success: true,
      mode: 'DEMO',
      newEmailsCount: 0,
      sensitiveCount: db.prepare('SELECT COUNT(*) as c FROM emails WHERE account_id = ? AND is_sensitive = 1').get(account.id)?.c || 0,
      aiProcessedCount: db.prepare('SELECT COUNT(*) as c FROM emails WHERE account_id = ? AND ai_processed = 1').get(account.id)?.c || 0,
      totalInbox: db.prepare('SELECT COUNT(*) as c FROM emails WHERE account_id = ?').get(account.id)?.c || 0,
      lastSyncedAt: account.last_synced_at || new Date().toISOString()
    };
  }

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  console.log(`[Gmail Sync] Fetching recent ${maxResults} messages from Gmail API for: ${account.email}`);

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

    // Check for expired or revoked token
    if (apiErr.code === 401 || apiErr.message?.includes('invalid_grant') || apiErr.message?.includes('Token has been expired or revoked')) {
      const tokenErr = new Error('Your Google session has expired or been revoked. Please reconnect your Gmail account.');
      tokenErr.code = 'TOKEN_EXPIRED';

      // Log event
      db.prepare(`
        INSERT INTO activity_logs (id, event_type, severity, message, metadata)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        'log_' + Date.now(),
        'OAUTH_TOKEN_EXPIRED',
        'WARNING',
        `Google OAuth session expired or revoked for ${account.email}`,
        JSON.stringify({ accountId: account.id, error: apiErr.message })
      );

      throw tokenErr;
    }

    throw apiErr;
  }

  const messageSummaries = listRes.data.messages || [];
  const nextPageToken = listRes.data.nextPageToken || null;

  let newEmailsCount = 0;
  let skippedDuplicates = 0;
  let sensitiveCount = 0;
  let aiProcessedCount = 0;

  for (const item of messageSummaries) {
    // 1. DUPLICATE PREVENTION: Check if message ID already exists
    const existing = db.prepare('SELECT id FROM emails WHERE id = ?').get(item.id);
    if (existing) {
      skippedDuplicates++;
      continue; // Skip message already in local database
    }

    // 2. Fetch full message payload
    let fullRes;
    try {
      fullRes = await gmail.users.messages.get({
        userId: 'me',
        id: item.id,
        format: 'full'
      });
    } catch (msgErr) {
      console.warn(`[Gmail Sync] Could not fetch message ${item.id}:`, msgErr.message);
      continue;
    }

    const parsedEmail = normalizeGmailMessage(fullRes.data, account.id);

    // 3. AI Analysis + Zero-Leak Privacy Guard Pipeline
    const analysis = await analyzeEmail(parsedEmail);

    if (analysis.is_sensitive) {
      sensitiveCount++;
    } else {
      aiProcessedCount++;
    }

    // 4. Store Email Metadata in SQLite (Idempotent ON CONFLICT ignore to handle concurrent syncs)
    const insertEmail = db.prepare(`
      INSERT INTO emails (
        id, thread_id, account_id, sender, sender_name, recipient, subject,
        body_text, body_html, snippet, date_received, is_read,
        is_sensitive, sensitive_type, category, priority_score, summary, ai_processed
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO NOTHING
    `);

    insertEmail.run(
      parsedEmail.id,
      parsedEmail.thread_id,
      account.id,
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

    // 5. Save Extracted Action Items if any
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

    // 6. Save AI Reply Drafts if any (Strictly in PENDING_APPROVAL status)
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
  const now = new Date().toISOString();
  db.prepare('UPDATE accounts SET last_synced_at = ? WHERE id = ?').run(now, account.id);

  // Log sync event
  db.prepare(`
    INSERT INTO activity_logs (id, event_type, severity, message, metadata)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    'log_' + Date.now(),
    'SYNC_COMPLETED',
    sensitiveCount > 0 ? 'SECURITY' : 'INFO',
    `Live inbox sync completed: ${newEmailsCount} new emails saved, ${skippedDuplicates} duplicates skipped. (${aiProcessedCount} AI classified, ${sensitiveCount} shielded by Privacy Guard)`,
    JSON.stringify({ accountId: account.id, newEmailsCount, skippedDuplicates, sensitiveCount, aiProcessedCount })
  );

  return {
    success: true,
    mode: 'LIVE',
    newEmailsCount,
    skippedDuplicates,
    sensitiveCount,
    aiProcessedCount,
    nextPageToken,
    lastSyncedAt: now,
    totalInbox: db.prepare('SELECT COUNT(*) as count FROM emails WHERE account_id = ?').get(account.id)?.count || 0
  };
}

/**
 * Creates an authorized draft in Gmail Drafts (using minimum permissions `gmail.compose`).
 * 
 * STRICT COMPLIANCE:
 * - Does NOT send emails.
 * - Does NOT require `gmail.send` scope.
 * - Creates a real draft in user's Gmail Drafts folder so user can review it in Gmail if desired.
 * 
 * @param {string} draftId 
 * @param {object} overrides 
 */
export async function createGmailDraft(draftId, overrides = {}) {
  const draft = db.prepare('SELECT * FROM drafts WHERE id = ?').get(draftId);
  if (!draft) {
    throw new Error(`Draft with ID ${draftId} not found.`);
  }

  const emailRecord = db.prepare('SELECT * FROM emails WHERE id = ?').get(draft.email_id);
  const accountId = emailRecord?.account_id;

  const to = overrides.to_address || draft.to_address;
  const subject = overrides.subject || draft.subject;
  const body = overrides.reply_body || draft.reply_body;

  const authData = await getAuthenticatedClient(accountId);
  const { oauth2Client, account, isDemo } = authData;

  // Handle Demo mode
  if (isDemo || !oauth2Client) {
    db.prepare(`
      UPDATE drafts 
      SET status = 'APPROVED', 
          approved_at = CURRENT_TIMESTAMP,
          to_address = ?,
          subject = ?,
          reply_body = ?
      WHERE id = ?
    `).run(to, subject, body, draftId);

    return {
      success: true,
      mode: 'DEMO',
      message: 'Draft approved and stored in local queue.'
    };
  }

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  // Construct RFC 2822 email
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

  // Create Gmail draft using minimum permissions (gmail.compose)
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

  // Update local draft
  db.prepare(`
    UPDATE drafts 
    SET status = 'CREATED_IN_GMAIL', 
        approved_at = CURRENT_TIMESTAMP,
        to_address = ?,
        subject = ?,
        reply_body = ?
    WHERE id = ?
  `).run(to, subject, body, draftId);

  // Log draft creation
  db.prepare(`
    INSERT INTO activity_logs (id, event_type, severity, message, metadata)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    'log_' + Date.now(),
    'DRAFT_CREATED_GMAIL',
    'INFO',
    `Created draft in Gmail for ${to} ("${subject}")`,
    JSON.stringify({ draftId, gmailDraftId, to, subject })
  );

  return {
    success: true,
    mode: 'LIVE',
    gmailDraftId,
    message: 'Draft successfully created in your Gmail account.'
  };
}

/**
 * Seeds high-quality demo sample emails for immediate evaluation
 */
export async function seedDemoEmails() {
  const activeAcc = getActiveAccount();
  const accountId = 'demo_account';

  // Check if demo account already exists
  const existingAcc = db.prepare('SELECT id FROM accounts WHERE id = ?').get(accountId);
  if (!existingAcc) {
    db.prepare(`
      INSERT INTO accounts (id, email, name, picture, access_token, created_at, last_synced_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(
      accountId,
      'alex.founder@mailmind.ai',
      'Alex Founder (Demo Mode)',
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
      'mock_token'
    );
  }

  // Check if emails already exist for demo
  const count = db.prepare('SELECT COUNT(*) as count FROM emails WHERE account_id = ?').get(accountId)?.count || 0;
  if (count > 0) {
    return { success: true, message: 'Demo inbox already loaded with sample emails', count };
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
      date_received: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
      preAnalysis: {
        category: 'Urgent',
        priority_score: 5,
        summary: 'Sarah Chen reports a critical API latency spike exceeding 800ms on the US-East cluster, requesting an immediate infrastructure investigation and incident update within 2 hours.',
        tasks: [
          { task_title: 'Investigate US-East cluster API latency spike', deadline_text: 'Within 2 hours' }
        ],
        reply_drafts: [
          { tone: 'Professional', reply_body: 'Hi Sarah,\n\nOur infrastructure team has been alerted and is actively investigating the US-East latency spike. We will provide an incident update within the next 90 minutes.\n\nBest regards,\nAlex' },
          { tone: 'Concise', reply_body: 'Hi Sarah,\n\nInvestigating now with the infra team. Update coming within 2 hours.' },
          { tone: 'Detailed', reply_body: 'Hi Sarah,\n\nThank you for flagging. We have opened a P1 incident bridge. Engineering is inspecting recent deployments and database connection pool saturation. I will personally update you within 2 hours.\n\nBest,\nAlex' }
        ]
      }
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
      date_received: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
      preAnalysis: {
        category: 'Meeting',
        priority_score: 4,
        summary: 'Marcus Vance from Sequoia Capital invites the founders to present their Series A deck to the investment committee this Thursday at 2:30 PM PST.',
        tasks: [
          { task_title: 'Confirm Series A Partner Presentation slot with Sequoia', deadline_text: 'Thursday 2:30 PM PST' }
        ],
        reply_drafts: [
          { tone: 'Professional', reply_body: 'Hi Marcus,\n\nThank you for the invitation. Thursday at 2:30 PM PST works perfectly for our team. We look forward to presenting to the partnership.\n\nBest regards,\nAlex' },
          { tone: 'Concise', reply_body: 'Hi Marcus,\n\nConfirmed for Thursday at 2:30 PM PST. Looking forward to it!' },
          { tone: 'Detailed', reply_body: 'Hi Marcus,\n\nWe are thrilled by the opportunity. Thursday at 2:30 PM PST works great. We will attend in person at Menlo Park and share an updated deck tomorrow.\n\nWarm regards,\nAlex' }
        ]
      }
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
      date_received: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
      preAnalysis: {
        category: 'Task',
        priority_score: 4,
        summary: 'Legal counsel Elena Rostova requests review of redlined clauses 4 and 8.2 of the CloudScale MSA and countersignature by Friday at 5:00 PM EST.',
        tasks: [
          { task_title: 'Review and countersign CloudScale MSA clauses 4 & 8.2', deadline_text: 'Friday 5:00 PM EST' }
        ],
        reply_drafts: [
          { tone: 'Professional', reply_body: 'Hi Elena,\n\nReceived. I will review the indemnity cap changes in section 8.2 and provide our countersignature by Friday morning.\n\nBest,\nAlex' }
        ]
      }
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
      date_received: new Date(Date.now() - 8 * 3600 * 1000).toISOString(),
      preAnalysis: {
        category: 'Urgent',
        priority_score: 5,
        summary: '🔒 Security Verification Code / 2FA alert. Protected by Privacy Guard. Expires shortly.',
        tasks: [],
        reply_drafts: [],
        is_sensitive: 1,
        sensitive_type: 'OTP'
      }
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
      date_received: new Date(Date.now() - 14 * 3600 * 1000).toISOString(),
      preAnalysis: {
        category: 'Urgent',
        priority_score: 4,
        summary: '💳 Financial transaction / banking notice. Protected by Privacy Guard. Local review recommended.',
        tasks: [],
        reply_drafts: [],
        is_sensitive: 1,
        sensitive_type: 'BANKING'
      }
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
      date_received: new Date(Date.now() - 22 * 3600 * 1000).toISOString(),
      preAnalysis: {
        category: 'Newsletter',
        priority_score: 1,
        summary: 'TLDR daily digest highlighting frontier inference benchmarks, hardware accelerators, and local-first software architectures.',
        tasks: [],
        reply_drafts: []
      }
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
      date_received: new Date(Date.now() - 28 * 3600 * 1000).toISOString(),
      preAnalysis: {
        category: 'Personal',
        priority_score: 2,
        summary: 'David Miller invites Alex to a Stanford cohort dinner this Saturday at 7:30 PM in Hayes Valley, San Francisco.',
        tasks: [
          { task_title: 'RSVP to David Miller regarding Stanford dinner in SF', deadline_text: 'Before Saturday' }
        ],
        reply_drafts: [
          { tone: 'Professional', reply_body: 'Hey Dave,\n\nGreat to hear from you! Count me in for Saturday at 7:30 PM. Looking forward to catching up with everyone.\n\nBest,\nAlex' }
        ]
      }
    }
  ];

  for (const email of sampleEmails) {
    const analysis = email.preAnalysis || await analyzeEmail(email);

    db.prepare(`
      INSERT OR REPLACE INTO emails (
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
    `Loaded 7 realistic emails for demo evaluation.`,
    JSON.stringify({ seededCount: sampleEmails.length, accountId })
  );

  return { success: true, seededCount: sampleEmails.length, accountId };
}
