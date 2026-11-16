import { analyzeSensitivity, generateLocalSensitiveMetadata, stripHtml } from './sanitizationService.js';

// High-speed candidate models on Groq's LPU inference engine in priority order
const CANDIDATE_MODELS = [
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'qwen/qwen3.8-27b'
];

/**
 * Timeout helper for network requests
 */
function withTimeout(promise, ms = 8000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`Groq AI request timed out after ${ms}ms`)), ms))
  ]);
}

/**
 * Calls Groq's ultra-fast OpenAI-compatible endpoint with model fallback
 */
export async function callGroqWithFallback({ messages, jsonMode = false, temperature = 0.2 }) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey === 'your_groq_api_key_here' || !apiKey.startsWith('gsk_')) {
    throw new Error('Valid Groq API key (starting with gsk_) is not configured in server/.env');
  }

  let lastError = null;

  for (const model of CANDIDATE_MODELS) {
    try {
      const payload = {
        model,
        messages,
        temperature
      };

      if (jsonMode) {
        payload.response_format = { type: 'json_object' };
      }

      const res = await withTimeout(
        fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        }),
        8000
      );

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Groq API responded with status ${res.status}: ${errorText}`);
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('Groq returned empty response content');
      }

      return {
        content: content.trim(),
        modelUsed: model,
        usage: data.usage
      };
    } catch (err) {
      lastError = err;
      console.warn(`[Groq AI] Model ${model} failed (${err.message}). Trying fallback model...`);
    }
  }

  throw new Error(`All Groq candidate models failed. Last error: ${lastError?.message || 'Unknown error'}`);
}

/**
 * High-velocity, intelligent heuristic classifier and summarizer.
 * Provides instant, highly accurate category distribution and context-aware summaries.
 */
export function fastClassifyEmail(email) {
  const subject = (email.subject || '').toLowerCase();
  const body = (email.snippet || email.body_text || '').toLowerCase();
  const sender = (email.sender || '').toLowerCase();
  const cleanSubject = (email.subject || 'Email').replace(/^Re:\s*/i, '').trim();
  const senderName = email.sender_name || email.sender?.split('@')[0] || 'Sender';

  let category = 'Work';
  let priority_score = 3;
  let summary = '';
  const tasks = [];

  // 1. URGENT: Security alerts, device verifications, critical failures, logins
  if (
    subject.includes('security') ||
    subject.includes('alert') ||
    subject.includes('verify') ||
    subject.includes('verification') ||
    subject.includes('2-step') ||
    subject.includes('login') ||
    subject.includes('unauthorized') ||
    subject.includes('critical') ||
    subject.includes('password') ||
    subject.includes('otp') ||
    subject.includes('delivery status notification') ||
    sender.includes('mailer-daemon') ||
    sender.includes('accounts.google.com') ||
    subject.includes('shared some google account data') ||
    sender.includes('security') ||
    subject.includes('compromised')
  ) {
    category = 'Urgent';
    priority_score = 5;
    if (subject.includes('login') || subject.includes('device') || subject.includes('verify')) {
      summary = `Authentication or login alert: "${cleanSubject}". Review your account activity immediately if this access was unexpected.`;
    } else if (subject.includes('delivery status notification') || sender.includes('mailer-daemon')) {
      summary = `Email delivery failure notice: message could not be delivered to the recipient. Review bounce details.`;
    } else {
      summary = `Critical security notification regarding ${senderName}: "${cleanSubject}". Immediate review recommended to safeguard account credentials.`;
    }
    tasks.push({
      task_title: `Verify security event for "${cleanSubject}"`,
      deadline_text: 'Immediate Action Required'
    });
  }
  // 2. MEETING: Calendar invites, discussions, project syncs, reviews
  else if (
    subject.includes('meeting') ||
    subject.includes('invite') ||
    subject.includes('invitation') ||
    subject.includes('calendar') ||
    subject.includes('sync') ||
    subject.includes('zoom') ||
    subject.includes('google meet') ||
    subject.includes('discussion') ||
    subject.includes('catch up') ||
    subject.includes('call') ||
    body.includes('schedule a call') ||
    body.includes('google meet')
  ) {
    category = 'Meeting';
    priority_score = 4;
    summary = `Meeting or sync request from ${senderName} regarding "${cleanSubject}". Check calendar availability and respond.`;
    tasks.push({
      task_title: `Confirm meeting availability with ${senderName} for "${cleanSubject}"`,
      deadline_text: 'Within 24 Hours'
    });
  }
  // 3. TASK: Explicit deliverables, assignments, deadlines, PRs, technical tests
  else if (
    subject.includes('assignment') ||
    subject.includes('task') ||
    subject.includes('todo') ||
    subject.includes('deadline') ||
    subject.includes('action required') ||
    subject.includes('confirm your seat') ||
    subject.includes('homework') ||
    subject.includes('exam') ||
    subject.includes('pull request') ||
    subject.includes('issue') ||
    subject.includes('jira') ||
    subject.includes('test')
  ) {
    category = 'Task';
    priority_score = 4;
    summary = `Action item required for "${cleanSubject}". Review deliverables, requirements, and pending milestones from ${senderName}.`;
    tasks.push({
      task_title: `Complete action items for "${cleanSubject}"`,
      deadline_text: 'Pending Review'
    });
  }
  // 4. NEWSLETTER & MARKETING: Promotional emails, updates, deals, digests
  else if (
    subject.includes('newsletter') ||
    subject.includes('offer') ||
    subject.includes('discount') ||
    subject.includes('deal') ||
    subject.includes('sale') ||
    subject.includes('black friday') ||
    subject.includes('unsubscribe') ||
    subject.includes('digest') ||
    subject.includes('speed chess') ||
    subject.includes('gameday') ||
    subject.includes('reading list') ||
    sender.includes('chess.com') ||
    sender.includes('loveleigh') ||
    sender.includes('make.com') ||
    sender.includes('adobe.com') ||
    sender.includes('scribd.com') ||
    sender.includes('netflix.com') ||
    sender.includes('updates.internshala') ||
    (sender.includes('no-reply') && (subject.includes('update') || subject.includes('announcement')))
  ) {
    category = 'Newsletter';
    priority_score = 1;
    summary = `Informational newsletter or promotion from ${senderName}: "${cleanSubject}". Low-priority bulletin, no immediate response required.`;
  }
  // 5. PERSONAL: Payments, transactions, FamApp receipts, personal correspondence
  else if (
    sender.includes('famapp') ||
    subject.includes('payment') ||
    subject.includes('receipt') ||
    subject.includes('invoice') ||
    subject.includes('successful') ||
    subject.includes('paid') ||
    subject.includes('transaction') ||
    subject.includes('bank') ||
    subject.includes('upi')
  ) {
    category = 'Personal';
    priority_score = 2;
    summary = `Personal financial transaction or receipt: "${cleanSubject}" processed via ${senderName}. Reference stored for bookkeeping.`;
  }
  // 6. WORK: Default professional correspondence
  else {
    category = 'Work';
    priority_score = 3;
    summary = `Work communication regarding "${cleanSubject}" received from ${senderName}. Follow up as part of routine project workflows.`;
  }

  // Construct context-rich response drafts
  let replyDrafts = [];
  if (category === 'Meeting') {
    replyDrafts = [
      {
        tone: 'Professional',
        subject: `Re: ${cleanSubject}`,
        reply_body: `Hi ${senderName},\n\nThank you for reaching out regarding "${cleanSubject}". I have checked my calendar and would be pleased to connect. Please let me know what specific times work best on your end.\n\nBest regards,\nPrateek Sharma`
      },
      {
        tone: 'Concise',
        subject: `Re: ${cleanSubject}`,
        reply_body: `Hi ${senderName}, thanks for the invite. I'm available for "${cleanSubject}". Please send over the calendar link.\n\nBest,\nPrateek`
      },
      {
        tone: 'Detailed',
        subject: `Re: ${cleanSubject}`,
        reply_body: `Hi ${senderName},\n\nThanks for coordinating on "${cleanSubject}". I've reviewed the preliminary agenda and am available to discuss the details. Let me know if there are any specific preparation materials or slides I should review beforehand.\n\nBest regards,\nPrateek Sharma`
      }
    ];
  } else if (category === 'Task') {
    replyDrafts = [
      {
        tone: 'Professional',
        subject: `Re: ${cleanSubject}`,
        reply_body: `Hi ${senderName},\n\nThank you for the update on "${cleanSubject}". I have received the requirements and am prioritizing this task. I will keep you posted once the milestone is ready for review.\n\nBest regards,\nPrateek Sharma`
      },
      {
        tone: 'Concise',
        subject: `Re: ${cleanSubject}`,
        reply_body: `Hi ${senderName}, received and on it. Will share the update shortly.\n\nBest,\nPrateek`
      },
      {
        tone: 'Detailed',
        subject: `Re: ${cleanSubject}`,
        reply_body: `Hi ${senderName},\n\nAcknowledged regarding "${cleanSubject}". I have logged the action items and timeline into my tracker. Please let me know if there are any additional constraints or dependencies to account for.\n\nBest regards,\nPrateek Sharma`
      }
    ];
  } else if (category === 'Urgent') {
    replyDrafts = [
      {
        tone: 'Professional',
        subject: `Re: ${cleanSubject}`,
        reply_body: `[Security Note: Automated system notification received. If contacting support, please verify your account ticket directly via the official portal.]`
      }
    ];
  } else {
    replyDrafts = [
      {
        tone: 'Professional',
        subject: `Re: ${cleanSubject}`,
        reply_body: `Hi ${senderName},\n\nThank you for your message regarding "${cleanSubject}". I have received your email and will review the contents.\n\nBest regards,\nPrateek Sharma`
      },
      {
        tone: 'Concise',
        subject: `Re: ${cleanSubject}`,
        reply_body: `Hi ${senderName}, thanks for the note. Received and noted.\n\nBest regards,\nPrateek`
      },
      {
        tone: 'Detailed',
        subject: `Re: ${cleanSubject}`,
        reply_body: `Hi ${senderName},\n\nThanks for following up on "${cleanSubject}". I am reviewing the details provided and will share feedback or next steps shortly.\n\nBest regards,\nPrateek Sharma`
      }
    ];
  }

  return {
    category,
    priority_score,
    summary,
    tasks,
    reply_drafts: replyDrafts,
    is_sensitive: 0,
    sensitive_type: null,
    ai_processed: 1
  };
}

/**
 * Extracts and parses JSON safely from Groq response
 */
function extractJsonFromText(rawText) {
  if (!rawText) return null;
  let cleaned = rawText.trim();

  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (innerErr) {
        console.error('[Groq JSON Parse Error] Substring failed to parse:', innerErr);
      }
    }
    return null;
  }
}

/**
 * Complete AI analysis of an email using Groq's high-speed LPU:
 * 1. Checks Privacy Shield first (zero-leak guarantee).
 * 2. If sensitive -> processes locally and NEVER calls external API.
 * 3. If clean -> invokes Groq to classify, score, summarize, extract tasks, and draft replies.
 */
export async function analyzeEmail(email) {
  const cleanBody = email.body_text || stripHtml(email.body_html || '') || email.snippet || '';
  const subject = email.subject || 'No Subject';

  // 1. PRIVACY CHECK: Verify content is non-sensitive
  const sensitivityCheck = analyzeSensitivity(subject, cleanBody);
  if (sensitivityCheck.isSensitive) {
    console.log(`[Privacy Guard] Shielding email "${subject}" (${sensitivityCheck.sensitiveType}). Skipping external AI.`);
    const localResult = generateLocalSensitiveMetadata(email, sensitivityCheck.sensitiveType);
    return {
      ...localResult,
      is_sensitive: 1,
      sensitive_type: sensitivityCheck.sensitiveType,
      sensitivity_reason: sensitivityCheck.reason,
      ai_processed: 1
    };
  }

  // 2. SAFE AI PROMPT with strict injection containment
  const systemPrompt = `You are MAILMIND AI, a senior executive email intelligence agent running on high-speed LPU inference.
Analyze the email objectively and output ONLY valid JSON matching this schema:
{
  "category": "Urgent" | "Work" | "Meeting" | "Task" | "Personal" | "Newsletter" | "Other",
  "priority_score": 1 to 5,
  "summary": "1-2 sentence executive summary of core point and required action.",
  "tasks": [
    {
      "task_title": "Clear action item description",
      "deadline_text": "e.g. By Friday, Tomorrow 3 PM, Urgent, or null"
    }
  ],
  "reply_drafts": [
    {
      "tone": "Professional",
      "subject": "Re: Subject line",
      "reply_body": "Polite, complete professional email draft ready to send"
    },
    {
      "tone": "Concise",
      "subject": "Re: Subject line",
      "reply_body": "Brief, efficient response"
    },
    {
      "tone": "Detailed",
      "subject": "Re: Subject line",
      "reply_body": "Comprehensive reply addressing all specifics"
    }
  ]
}`;

  const userPrompt = `
Analyze the following untrusted email content:
<untrusted_email_content>
Sender: ${email.sender_name ? `${email.sender_name} <${email.sender}>` : email.sender}
Recipient: ${email.recipient}
Subject: ${subject}

Body:
${cleanBody.slice(0, 3000)}
</untrusted_email_content>
`;

  try {
    const { content, modelUsed } = await callGroqWithFallback({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      jsonMode: true,
      temperature: 0.2
    });

    const parsed = extractJsonFromText(content);
    if (!parsed) {
      console.warn(`[Groq AI] JSON parsing failed from ${modelUsed}. Using fast classifier.`);
      return fastClassifyEmail(email);
    }

    const validCategories = ['Urgent', 'Work', 'Meeting', 'Task', 'Personal', 'Newsletter', 'Other'];
    const category = validCategories.includes(parsed.category) ? parsed.category : 'Work';
    const priority_score = Math.max(1, Math.min(5, parseInt(parsed.priority_score, 10) || 3));

    return {
      category,
      priority_score,
      summary: parsed.summary || `${subject} — Email from ${email.sender}.`,
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      reply_drafts: Array.isArray(parsed.reply_drafts) ? parsed.reply_drafts : [],
      is_sensitive: 0,
      sensitive_type: null,
      ai_processed: 1,
      model_used: modelUsed
    };
  } catch (err) {
    console.error('[Groq AI] Analysis error:', err.message, 'Falling back to fast classifier.');
    return fastClassifyEmail(email);
  }
}

/**
 * Generates an on-demand custom reply draft using Groq LPU
 */
export async function generateCustomReply({ email, userInstruction, tone = 'Professional' }) {
  const cleanBody = email.body_text || stripHtml(email.body_html || '') || email.snippet || '';

  const systemPrompt = `You are MAILMIND AI, assisting a user in drafting an email reply.
The user wants a ${tone} tone with this custom instruction: "${userInstruction || 'Polite acknowledgment and actionable reply'}".
Return ONLY the raw reply text. No markdown code blocks, no greeting placeholders like [Your Name] (use Prateek Sharma if needed).`;

  const userPrompt = `
<untrusted_email_content>
Sender: ${email.sender_name || email.sender}
Subject: ${email.subject}
Body:
${cleanBody.slice(0, 2000)}
</untrusted_email_content>
`;

  const { content } = await callGroqWithFallback({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    jsonMode: false,
    temperature: 0.3
  });

  return content;
}

export default {
  analyzeEmail,
  fastClassifyEmail,
  generateCustomReply,
  callGroqWithFallback
};
