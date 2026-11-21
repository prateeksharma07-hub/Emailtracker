/**
 * MAILMIND AI — Sensitive Data Protection & Sanitization Service
 * 
 * SENSITIVE DATA SHIELD (LOCAL REGEX INTERCEPTION):
 * Detects OTPs, 2FA codes, credit/debit cards, bank account numbers, passwords,
 * credentials, medical reports, and legal notices BEFORE any email content touches an external AI model.
 * 
 * If sensitive content is detected, the email is flagged as `is_sensitive = 1`,
 * categorized and summarized locally using deterministic rules, and AI processing is STRICTLY BYPASSED.
 */

// Regex patterns for sensitive content
const PATTERNS = {
  // OTP / 2FA / Verification Codes (4-8 digits or 6-char alphanumeric near security keywords)
  OTP: [
    /(?:verification|security|one-time|otp|2fa|pin|authorization|login|passcode|confirm(?:ation)?)(?:\s+(?:code|pin|token|is|password)){1,3}\s*[:\s-]*\b([0-9]{4,8})\b/i,
    /(?:code|otp|pin|token|passcode)\s+(?:is|to verify)\s*[:\s-]*\b([0-9]{4,8})\b/i,
    /\b([0-9]{4,8})\b\s*(?:is your (?:verification|security|login|one-time|otp|google|microsoft|apple|amazon) code)/i,
    /(?:enter the code|use code|verification code)\s*[:\s-]*\b([0-9A-Z]{4,8})\b/i,
    /\b(?:otp|one-time password|2-factor|two-factor)\b/i
  ],

  // Credit / Debit Cards (13-19 digits, Visa, Mastercard, Amex, Discover, Rupay)
  CREDIT_CARD: [
    /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|6(?:011|5[0-9]{2})[0-9]{12}|(5[06-8]\d{2}|6\d{3})[0-9]{12,15})\b/,
    /\b\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b/,
    /(?:cvv|cvc|card security code|exp(?:iry)? date)\s*[:\s-]*\d{2,4}/i
  ],

  // Banking, Accounts, Wire, Routing, IBAN, IFSC
  BANKING: [
    /\b[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}\b/, // IBAN format
    /\b[A-Z]{4}0[A-Z0-9]{6}\b/, // Indian IFSC format
    /(?:account number|acct no|routing number|bank statement|wire transfer|balance statement|debit alert|credit alert|neft|rtgs|ach transfer)\b/i,
    /(?:tax return|w-2|1099-misc|ssn|social security number|pan card|aadhaar)\b/i
  ],

  // Passwords, Tokens, API Keys, Private Keys
  CREDENTIALS: [
    /(?:temporary password|current password|new password|reset your password|credentials|login secret)\s*[:\s-]*\S+/i,
    /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/,
    /\b(?:ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9]{82}|sk-[a-zA-Z0-9]{48}|AIza[0-9A-Za-z-_]{35})\b/
  ],

  // Medical Diagnoses & Sensitive Health Data
  MEDICAL: [
    /\b(?:prescription|biopsy|pathology report|mri scan|ct scan|radiology report|oncology|hiv status|psychiatric evaluation|patient medical record)\b/i
  ],

  // Legal Subpoenas & Privileged Communication
  LEGAL: [
    /\b(?:attorney-client privileged|subpoena|summons and complaint|court injunction|arbitration award|settlement agreement and release)\b/i
  ]
};

/**
 * Analyzes text to determine if it contains sensitive information.
 * 
 * @param {string} subject - Email subject line
 * @param {string} body - Email body (plain text or stripped HTML)
 * @returns {object} { isSensitive: boolean, sensitiveType: string | null, reason: string | null }
 */
export function analyzeSensitivity(subject = '', body = '') {
  const fullText = `${subject}\n\n${body}`;

  // Check each category
  for (const [type, regexList] of Object.entries(PATTERNS)) {
    for (const regex of regexList) {
      if (regex.test(fullText)) {
        return {
          isSensitive: true,
          sensitiveType: type,
          reason: `Detected sensitive ${type.toLowerCase()} content matching security rule: ${regex.source.slice(0, 40)}...`
        };
      }
    }
  }

  return {
    isSensitive: false,
    sensitiveType: null,
    reason: null
  };
}

/**
 * Generates safe local deterministic metadata for sensitive emails
 * so they can be securely indexed without sending any bytes to external AI.
 * 
 * @param {object} email
 * @param {string} sensitiveType
 * @returns {object}
 */
export function generateLocalSensitiveMetadata(email, sensitiveType) {
  let category = 'Work';
  let priority_score = 4;
  let summary = '[PROTECTED] Sensitive email detected. Content was shielded locally to preserve your confidentiality.';

  switch (sensitiveType) {
    case 'OTP':
      category = 'Urgent';
      priority_score = 5;
      summary = '🔒 Security Verification Code / 2FA alert. Protected by Privacy Guard. Expires shortly.';
      break;
    case 'CREDIT_CARD':
    case 'BANKING':
      category = 'Urgent';
      priority_score = 4;
      summary = '💳 Financial transaction / banking notice. Protected by Privacy Guard. Local review recommended.';
      break;
    case 'CREDENTIALS':
      category = 'Urgent';
      priority_score = 5;
      summary = '🔑 Account credentials / password security notification. Shielded locally.';
      break;
    case 'MEDICAL':
      category = 'Personal';
      priority_score = 4;
      summary = '🩺 Confidential health / medical correspondence. Protected by Privacy Guard.';
      break;
    case 'LEGAL':
      category = 'Work';
      priority_score = 4;
      summary = '⚖️ Confidential legal / privileged document. Protected by Privacy Guard.';
      break;
    default:
      category = 'Other';
      priority_score = 3;
      summary = '🔒 Sensitive document shielded locally by Privacy Guard.';
  }

  return {
    category,
    priority_score,
    summary,
    tasks: [],
    reply_drafts: []
  };
}

/**
 * Strips HTML tags and normalizes whitespace
 * @param {string} html 
 * @returns {string}
 */
export function stripHtml(html = '') {
  if (!html) return '';
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}
