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

const ATTACHMENT_PATTERNS = [
  /\b(?:please\s+find\s+attached|find\s+attached|pfa|attached|attaching|attachment|attachments|attach\s+kar\s+diya|enclosed|see\s+attached)\b/i
];

const PLACEHOLDER_PATTERNS = [
  /\[(?:your\s+name|name|date|insert\s+[^\]]+|company|link|title|phone|email|todo|xyz|abc|amount|client)\]/i,
  /\b(?:TODO|FIXME|XXXX+)\b/,
  /\{\{[^}]+\}\}/,
  /<(?:name|date|company|link|insert\s+[^>]+)>/i
];

// India & International Sensitive Data Patterns
const SENSITIVE_PATTERNS = {
  // 12-digit Aadhaar number (does not start with 0 or 1)
  AADHAAR: /\b[2-9]\d{3}\s?\d{4}\s?\d{4}\b/,
  // Indian PAN (5 letters, 4 digits, 1 letter)
  PAN: /\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b/,
  // Bank Account numbers (9 to 18 digits) near financial words
  BANK_ACCOUNT: /(?:account|a\/c|acct|bank|ifsc|transfer\s+to|beneficiary)\s*(?:no\.?|number)?\s*[:\s-]*\b(\d{9,18})\b/i,
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
  for (const regex of PLACEHOLDER_PATTERNS) {
    const match = text.match(regex);
    if (match) {
      items.push({
        type: 'unfilled_placeholder',
        severity: 'HIGH',
        excerpt: match[0],
        message: `Draft contains unfilled placeholder "${match[0]}". Please fill in or remove before authorizing.`
      });
      break;
    }
  }

  // 3. Outgoing Sensitive Data Check (PAN, Aadhaar, Bank A/C, Passwords, OTP)
  // A. Check Aadhaar
  const aadhaarMatch = text.match(SENSITIVE_PATTERNS.AADHAAR);
  if (aadhaarMatch) {
    items.push({
      type: 'outgoing_sensitive_data',
      severity: 'HIGH',
      excerpt: maskSecret('AADHAAR', aadhaarMatch[0]),
      message: 'High-risk: Aadhaar number detected in draft text. Do not transmit identity numbers in plain email.'
    });
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

  // C. Check Bank Account
  const bankMatch = text.match(SENSITIVE_PATTERNS.BANK_ACCOUNT);
  if (bankMatch) {
    items.push({
      type: 'outgoing_sensitive_data',
      severity: 'HIGH',
      excerpt: maskSecret('BANK_ACCOUNT', bankMatch[1] || bankMatch[0]),
      message: 'High-risk: Bank account number detected in draft text.'
    });
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
