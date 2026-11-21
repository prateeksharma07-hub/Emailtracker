import { analyzeSensitivity } from '../sanitizationService.js';

/**
 * Deterministic Checks for MailMind Regret Shield (Phase 2 Feature)
 * 
 * Executes fast, offline, zero-LLM checks on email drafts before authorization:
 * 1. Attachment mention (e.g., "PFA", "attached") when MailMind does not attach files.
 * 2. Unfilled placeholders (e.g., "[Your Name]", "TODO", "{{...}}").
 * 3. Outgoing sensitive credentials (OTP, passwords, card numbers, Aadhaar, PAN, bank accounts).
 * 4. Recipient risk (domain mismatch, Reply-All > 5 recipients, external domain).
 * 5. Greeting mismatch (greeting name does not match sender/recipient names).
 */

// Verhoeff algorithm multiplication table (d)
const VERHOEFF_D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
];

// Verhoeff algorithm permutation table (p)
const VERHOEFF_P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]
];

/**
 * Validates a 12-digit Indian Aadhaar number using the Verhoeff checksum algorithm
 * 
 * @param {string|number} numStr 
 * @returns {boolean}
 */
export function validateVerhoeff(numStr) {
  const digits = String(numStr).replace(/\D/g, '').split('').map(Number);
  if (digits.length !== 12) return false;
  // Aadhaar numbers start with 2-9
  if (digits[0] < 2) return false;
  digits.reverse();
  let c = 0;
  for (let i = 0; i < digits.length; i++) {
    c = VERHOEFF_D[c][VERHOEFF_P[i % 8][digits[i]]];
  }
  return c === 0;
}

const ATTACHMENT_PATTERNS = [
  /\b(?:please\s+find\s+attached|find\s+attached|pfa|attached|attaching|attachment|attachments|attach\s+kar\s+diya|enclosed|see\s+attached)\b/i
];

const BANK_CONTEXT_REGEX = /\b(?:account|a\/c|acc(?:\s*no\.?)?|acct|bank|ifsc|beneficiary|transfer\s+to)\b/i;
const NON_BANK_PREFIX_REGEX = /\b(?:order|invoice|tracking|shipment|receipt|ticket|waybill)\s*(?:id|#|no\.?|number)?\s*[:#-]?\s*$/i;

// Sensitive Patterns for PAN, Passwords, OTP
const SENSITIVE_PATTERNS = {
  // Indian PAN (5 letters, 4 digits, 1 letter)
  PAN: /\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b/,
  // Passwords / Passcodes in outgoing text
  PASSWORDS: /(?:password|passwd|secret|passcode|pin)\s*[:=]\s*([^\s,;]+)/i,
  // One-Time Passwords / Verification Codes
  OTP: /\b(?:otp|one-time\s+password|2fa\s+code|verification\s+code)\s*[:=]?\s*([0-9]{4,8})\b/i
};

/**
 * Masks a sensitive excerpt so raw secrets are never duplicated in database or logs
 */
function maskSecret(type, raw) {
  if (!raw) return '[REDACTED]';
  const str = String(raw).trim();
  if (type === 'AADHAAR') {
    const digits = str.replace(/\s+/g, '');
    return `Aadhaar: **** **** ${digits.slice(-4)}`;
  }
  if (type === 'PAN') {
    return `PAN: ${str.slice(0, 2)}***${str.slice(-2)}`;
  }
  if (type === 'BANK_ACCOUNT') {
    return `Bank A/C: ****${str.slice(-4)}`;
  }
  return `[${type} DETECTED: REDACTED]`;
}

/**
 * Extracts domain name from an email address
 */
function extractDomain(emailStr = '') {
  const match = emailStr.match(/@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  return match ? match[1].toLowerCase() : '';
}

/**
 * Runs all deterministic checks on a draft
 * 
 * @param {string} draftText - The proposed reply body
 * @param {object} context - { toAddresses: string[], fromAddress: string, replyToAddress: string, senderName: string, threadSenders: string[] }
 * @returns {Array<object>} Array of finding items
 */
export function runDeterministicChecks(draftText = '', context = {}) {
  const items = [];
  if (!draftText || typeof draftText !== 'string') return items;

  const text = draftText.trim();
  const {
    toAddresses = [],
    fromAddress = '',
    replyToAddress = '',
    senderName = '',
    threadSenders = []
  } = context;

  // 1. Attachment Mention Check
  for (const regex of ATTACHMENT_PATTERNS) {
    const match = text.match(regex);
    if (match) {
      items.push({
        type: 'attachment_mention',
        severity: 'MEDIUM',
        excerpt: match[0],
        message: 'Draft me attachment ka zikr hai, par MailMind drafts me file attach nahi karta. Gmail me draft kholkar attach karna na bhoolo.'
      });
      break;
    }
  }

  // 2. Unfilled Placeholders Check
  // A. [placeholder]
  const bracketMatch = text.match(/\[(?:your\s+name|name|date|insert\s+[^\]]+|company|link|title|phone|email|todo|xyz|abc|amount|client)\]/i);
  if (bracketMatch) {
    items.push({
      type: 'unfilled_placeholder',
      severity: 'HIGH',
      excerpt: bracketMatch[0],
      message: `Draft contains unfilled placeholder "${bracketMatch[0]}". Please fill in or remove before authorizing.`
    });
  }

  // B. {{mustache}}
  if (!items.some(it => it.type === 'unfilled_placeholder')) {
    const mustacheMatch = text.match(/\{\{[^}]+\}\}/);
    if (mustacheMatch) {
      items.push({
        type: 'unfilled_placeholder',
        severity: 'HIGH',
        excerpt: mustacheMatch[0],
        message: `Draft contains unfilled placeholder "${mustacheMatch[0]}". Please fill in or remove before authorizing.`
      });
    }
  }

  // C. <placeholder> (strictly placeholder words to avoid matching email addresses or HTML tags)
  if (!items.some(it => it.type === 'unfilled_placeholder')) {
    const angleMatch = text.match(/<(?:name|date|company|your[^>]*|client|amount|link|insert[^>]*)>/i);
    if (angleMatch) {
      items.push({
        type: 'unfilled_placeholder',
        severity: 'HIGH',
        excerpt: angleMatch[0],
        message: `Draft contains unfilled placeholder "${angleMatch[0]}". Please fill in or remove before authorizing.`
      });
    }
  }

  // D. Standalone uppercase TODO or FIXME
  if (!items.some(it => it.type === 'unfilled_placeholder')) {
    const todoMatch = text.match(/\b(?:TODO|FIXME)\b/);
    if (todoMatch) {
      items.push({
        type: 'unfilled_placeholder',
        severity: 'HIGH',
        excerpt: todoMatch[0],
        message: `Draft contains unfilled placeholder "${todoMatch[0]}". Please fill in or remove before authorizing.`
      });
    }
  }

  // E. Standalone XXXX+ (skips masked digits like 'XXXX 1234' or '1234 XXXX')
  if (!items.some(it => it.type === 'unfilled_placeholder')) {
    const xRegex = /\b[Xx]{4,}\b/g;
    let xMatch;
    while ((xMatch = xRegex.exec(text)) !== null) {
      const start = xMatch.index;
      const end = start + xMatch[0].length;
      const pre = text.slice(Math.max(0, start - 10), start);
      const post = text.slice(end, Math.min(text.length, end + 10));

      if (/\d+\s*[-–—]?\s*$/.test(pre) || /^[-–—\s]*\d+/.test(post)) {
        continue;
      }

      items.push({
        type: 'unfilled_placeholder',
        severity: 'HIGH',
        excerpt: xMatch[0],
        message: `Draft contains unfilled placeholder "${xMatch[0]}". Please fill in or remove before authorizing.`
      });
      break;
    }
  }

  // 3. Outgoing Sensitive Data Check (PAN, Aadhaar, Bank A/C, Passwords, OTP)
  // A. Check Aadhaar: 12-digit number starting with 2-9, with valid Verhoeff checksum.
  // Must NOT match Indian mobile numbers (+91..., 919...) or invalid checksums.
  const aadhaarRegex = /(?<!\d)(?:[2-9]\d{3}[\s-]?[0-9]{4}[\s-]?[0-9]{4})(?!\d)/g;
  let aadhaarMatch;
  while ((aadhaarMatch = aadhaarRegex.exec(text)) !== null) {
    const rawMatch = aadhaarMatch[0];
    const matchStart = aadhaarMatch.index;

    // Skip if preceded by '+' (international phone prefix e.g. +91)
    const prefix = text.slice(Math.max(0, matchStart - 6), matchStart);
    if (/\+\s*(?:91\s*)?$/.test(prefix)) {
      continue;
    }

    const digits = rawMatch.replace(/\D/g, '');
    if (digits.length !== 12) continue;

    // Disregard if it starts with 91 followed by Indian mobile (6, 7, 8, 9)
    if (/^91[6-9]\d{9}$/.test(digits)) {
      continue;
    }

    // Must satisfy Verhoeff checksum
    if (validateVerhoeff(digits)) {
      items.push({
        type: 'outgoing_sensitive_data',
        severity: 'HIGH',
        excerpt: maskSecret('AADHAAR', rawMatch),
        message: 'High-risk: Aadhaar number detected in draft text. Do not transmit identity numbers in plain email.'
      });
      break;
    }
  }

  // B. Check PAN
  const panMatch = text.match(SENSITIVE_PATTERNS.PAN);
  if (panMatch) {
    items.push({
      type: 'outgoing_sensitive_data',
      severity: 'HIGH',
      excerpt: maskSecret('PAN', panMatch[0]),
      message: 'High-risk: Indian Permanent Account Number (PAN) detected in draft text.'
    });
  }

  // C. Check Bank Account (9-18 digits within ±40 chars of financial/account keywords)
  const bankCandidateRegex = /(?<!\d)(\d{9,18})(?!\d)/g;
  let bankMatch;
  while ((bankMatch = bankCandidateRegex.exec(text)) !== null) {
    const rawNumber = bankMatch[1];
    const start = bankMatch.index;
    const end = start + rawNumber.length;

    // Window of ±40 characters around candidate
    const windowStart = Math.max(0, start - 40);
    const windowEnd = Math.min(text.length, end + 40);
    const windowText = text.slice(windowStart, windowEnd);

    // If immediately preceded by order/tracking/invoice, skip
    const immediatePrefix = text.slice(windowStart, start);
    if (NON_BANK_PREFIX_REGEX.test(immediatePrefix)) {
      continue;
    }

    // Skip if it is already verified as Aadhaar
    if (rawNumber.length === 12 && validateVerhoeff(rawNumber)) {
      continue;
    }

    if (BANK_CONTEXT_REGEX.test(windowText)) {
      items.push({
        type: 'outgoing_sensitive_data',
        severity: 'HIGH',
        excerpt: maskSecret('BANK_ACCOUNT', rawNumber),
        message: 'High-risk: Bank account number detected in draft text.'
      });
      break;
    }
  }

  // D. Check Passwords / OTP
  const passMatch = text.match(SENSITIVE_PATTERNS.PASSWORDS) || text.match(SENSITIVE_PATTERNS.OTP);
  if (passMatch) {
    items.push({
      type: 'outgoing_sensitive_data',
      severity: 'HIGH',
      excerpt: maskSecret('PASSWORD', passMatch[0]),
      message: 'High-risk: Cleartext credentials or verification code detected in draft.'
    });
  }

  // E. Generic sanitization check (Credit cards, Private keys, etc.)
  const genericSens = analyzeSensitivity('', text);
  if (genericSens.isSensitive && items.every(it => it.type !== 'outgoing_sensitive_data')) {
    items.push({
      type: 'outgoing_sensitive_data',
      severity: 'HIGH',
      excerpt: `[${genericSens.type || 'SENSITIVE_DATA'}]`,
      message: `High-risk sensitive content detected (${genericSens.type}). Please verify recipient before sending.`
    });
  }

  // 4. Recipient Risks
  // A. Reply-To Domain Mismatch
  if (replyToAddress && fromAddress) {
    const fromDomain = extractDomain(fromAddress);
    const replyDomain = extractDomain(replyToAddress);
    if (fromDomain && replyDomain && fromDomain !== replyDomain) {
      items.push({
        type: 'recipient_risk',
        severity: 'MEDIUM',
        excerpt: `${replyToAddress} (vs ${fromAddress})`,
        message: `Reply-To domain "${replyDomain}" differs from sender domain "${fromDomain}". Verify recipient destination.`
      });
    }
  }

  // B. Reply-All Hazard (> 5 recipients)
  const allRecipients = Array.isArray(toAddresses) ? toAddresses : [toAddresses].filter(Boolean);
  if (allRecipients.length > 5) {
    items.push({
      type: 'recipient_risk',
      severity: 'MEDIUM',
      excerpt: `${allRecipients.length} recipients`,
      message: `Reply-all hazard: Draft addresses ${allRecipients.length} recipients. Check for unintended recipients.`
    });
  }

  // C. New External Recipient Domain
  if (threadSenders.length > 0 && allRecipients.length > 0) {
    const knownDomains = new Set(threadSenders.map(extractDomain).filter(Boolean));
    for (const rec of allRecipients) {
      const recDomain = extractDomain(rec);
      if (recDomain && knownDomains.size > 0 && !knownDomains.has(recDomain)) {
        items.push({
          type: 'recipient_risk',
          severity: 'MEDIUM',
          excerpt: rec,
          message: `Recipient domain "@${recDomain}" was not previously present in this email thread.`
        });
        break;
      }
    }
  }

  // 5. Greeting Name Mismatch
  const greetingMatch = text.match(/^(?:Hi|Hey|Dear|Hello)\s+([A-Za-z]+)\b/i);
  if (greetingMatch) {
    const greetedName = greetingMatch[1].toLowerCase();
    
    // Assemble candidate names from context
    const candidateNames = [];
    if (senderName) {
      candidateNames.push(...senderName.toLowerCase().split(/\s+/));
    }
    for (const addr of [...allRecipients, fromAddress]) {
      const match = addr.match(/^([^@]+)@/);
      if (match) {
        candidateNames.push(...match[1].toLowerCase().split(/[._-]/));
      }
    }

    // Ignore generic greetings like "All", "Team", "Everyone", "There", "Folks"
    const genericGreetings = new Set(['all', 'team', 'everyone', 'there', 'folks', 'sir', 'madam']);
    if (!genericGreetings.has(greetedName) && candidateNames.length > 0) {
      const isMatch = candidateNames.some(cand => cand.includes(greetedName) || greetedName.includes(cand));
      if (!isMatch) {
        items.push({
          type: 'greeting_mismatch',
          severity: 'LOW',
          excerpt: greetingMatch[0],
          message: `Greeting name "${greetingMatch[1]}" does not match any name in the recipient or sender list.`
        });
      }
    }
  }

  return items;
}
