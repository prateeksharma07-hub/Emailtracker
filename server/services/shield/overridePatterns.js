/**
 * Layer 2: Instruction-Override & Jailbreak Pattern Engine
 * 
 * Scans email text for prompt injection keywords and semantic override patterns
 * across English, Hindi (Devanagari), and Romanized Hinglish.
 */

// Weighted pattern definitions
export const OVERRIDE_PATTERNS = [
  // --- High Severity (Direct Prompt Injections & Jailbreaks) ---
  {
    id: 'IGNORE_PREVIOUS_EN',
    regex: /\b(?:ignore|disregard|forget|bypass|override)\s+(?:all\s+)?(?:previous|above|prior|system|earlier)\s+(?:instructions?|prompts?|rules?|directives?|commands?|guidelines?)\b/i,
    weight: 50,
    category: 'INSTRUCTION_OVERRIDE',
    description: 'Direct instruction override ("ignore previous instructions")'
  },
  {
    id: 'IGNORE_PREVIOUS_HINGLISH',
    regex: /\b(?:pehle\s+ki|pichh?li|upar\s+ki)\s+(?:saari\s+)?(?:instructions?|baatein?|nirdesh)\s+(?:ko\s+)?(?:ignore|bhool|hata|radd)\b/i,
    weight: 50,
    category: 'INSTRUCTION_OVERRIDE',
    description: 'Hinglish instruction override ("pehle ki instructions ignore karo")'
  },
  {
    id: 'FORGET_ABOVE_HINGLISH',
    regex: /\b(?:upar\s+ki\s+baatein?\s+bhool\s+jao|purane\s+nirdesh\s+radd\s+karo|sab\s+bhool\s+kar)\b/i,
    weight: 50,
    category: 'INSTRUCTION_OVERRIDE',
    description: 'Hinglish memory wipe directive ("upar ki baatein bhool jao")'
  },
  {
    id: 'ROLEPLAY_HIJACK_EN',
    regex: /\b(?:you\s+are\s+now|act\s+as|pretend\s+to\s+be)\s+(?:in\s+)?(?:an?\s+)?(?:unrestricted|jailbroken|unfiltered|dan(?:\s+mode)?|developer\s+mode|root|admin\s+ai|evil)\b/i,
    weight: 50,
    category: 'PERSONA_HIJACK',
    description: 'Persona or jailbreak hijacking ("you are now in developer/DAN mode")'
  },
  {
    id: 'DELIMITER_BREAKOUT_ATTACK',
    regex: /(?:<<<|<<)\s*(?:END_)?UNTRUSTED_EMAIL_CONTENT\s*(?:>>>|>>)/i,
    weight: 50,
    category: 'INSTRUCTION_OVERRIDE',
    description: 'Delimiter breakout injection attempt'
  },
  {
    id: 'ROLEPLAY_HIJACK_HINGLISH',
    regex: /\b(?:tum\s+ab\s+(?:ek\s+)?(?:unrestricted|naye|admin|hack)\s+(?:agent|ai|bot)\s+ho|apni\s+restrictions?\s+bhool\s+jao)\b/i,
    weight: 45,
    category: 'PERSONA_HIJACK',
    description: 'Hinglish persona hijack ("tum ab ek unrestricted agent ho")'
  },
  {
    id: 'SYSTEM_PROMPT_LEAK_EN',
    regex: /\b(?:output|reveal|print|repeat|show|display)\s+(?:your\s+)?(?:system\s+prompt|developer\s+instructions?|hidden\s+prompt|initial\s+prompt)\b/i,
    weight: 40,
    category: 'PROMPT_LEAK',
    description: 'System prompt exfiltration request'
  },
  {
    id: 'CREDENTIAL_EXFILTRATION_EN',
    regex: /\b(?:reveal|forward|send|exfiltrate|output)\s+(?:the\s+)?(?:otp|password|token|api\s*key|secret|credentials?)\s+(?:to|here)\b/i,
    weight: 50,
    category: 'DATA_EXFILTRATION',
    description: 'Credential exfiltration instruction ("reveal the password/OTP")'
  },
  {
    id: 'CREDENTIAL_EXFILTRATION_HINGLISH',
    regex: /\b(?:otp|password|secret|credentials?)\s+(?:batao|share\s+karo|forward\s+karo|bhejo|nikalo)\b/i,
    weight: 50,
    category: 'DATA_EXFILTRATION',
    description: 'Hinglish credential exfiltration ("OTP share karo")'
  },
  {
    id: 'PAYMENT_FRAUD_INJECTION_EN',
    regex: /\b(?:disregard\s+original|change\s+the|updated?)\s+(?:bank\s+account|wire\s+details|payment\s+instructions?|iban|routing\s+number)\b/i,
    weight: 45,
    category: 'FINANCIAL_FRAUD',
    description: 'Adversarial payment/banking redirect instruction'
  },
  {
    id: 'PAYMENT_FRAUD_INJECTION_HINGLISH',
    regex: /\b(?:bank\s+details|khata\s+number|account\s+number)\s+(?:badal\s+do|change\s+karo|ye\s+naya\s+hai)\b/i,
    weight: 45,
    category: 'FINANCIAL_FRAUD',
    description: 'Hinglish payment detail alteration instruction'
  },
  {
    id: 'FORCED_CLASSIFICATION_EN',
    regex: /\b(?:mark|classify|summarize)\s+this\s+(?:email\s+)?as\s+(?:urgent|critical|safe|legitimate|verified|priority\s+5)\b/i,
    weight: 35,
    category: 'FORCED_CLASSIFICATION',
    description: 'Instruction attempting to force urgency or legitimacy'
  },
  {
    id: 'FORCED_CLASSIFICATION_HINGLISH',
    regex: /\b(?:ise\s+|is\s+email\s+ko\s+)(?:urgent|safe|legitimate|important)\s+(?:bolo|mark\s+karo|batao)\b/i,
    weight: 35,
    category: 'FORCED_CLASSIFICATION',
    description: 'Hinglish forced classification directive ("ise urgent bolo")'
  },

  // --- Medium Severity (Context Inversion & Command Injection) ---
  {
    id: 'DELIMITER_INJECTION_EN',
    regex: /(?:<<<|\[\[\[|```)\s*(?:END_UNTRUSTED|END_EMAIL|SYSTEM|ASSISTANT|ADMIN)\s*(?:>>>|\]\]\]|```)/i,
    weight: 40,
    category: 'DELIMITER_ATTACK',
    description: 'Attempt to escape containment delimiters'
  },
  {
    id: 'DO_NOT_SUMMARIZE_EN',
    regex: /\b(?:do\s+not\s+(?:summarize|extract)|instead\s+(?:of\s+summarizing,?\s+)?(?:do|output|write|send))\b/i,
    weight: 30,
    category: 'FLOW_HIJACK',
    description: 'Attempt to divert AI flow away from email summarization'
  },
  {
    id: 'AUTO_FORWARD_DIRECTIVE_EN',
    regex: /\b(?:automatically\s+forward|send\s+all\s+(?:incoming|future)\s+emails)\s+to\b/i,
    weight: 40,
    category: 'DATA_EXFILTRATION',
    description: 'Auto-forwarding directive attempt'
  }
];

/**
 * Scans a text string for prompt injection override patterns.
 * 
 * @param {string} text 
 * @returns {object} Scan result
 */
export function scanOverridePatterns(text = '') {
  if (!text || typeof text !== 'string') {
    return {
      status: 'CLEARED',
      score: 0,
      matches: [],
      findings: ['No override patterns found.']
    };
  }

  const matches = [];
  const findings = [];
  let totalScore = 0;

  for (const pattern of OVERRIDE_PATTERNS) {
    const match = text.match(pattern.regex);
    if (match) {
      // Extract matched snippet with brief surrounding context
      const matchIndex = match.index || 0;
      const start = Math.max(0, matchIndex - 20);
      const end = Math.min(text.length, matchIndex + match[0].length + 20);
      const excerpt = text.slice(start, end).replace(/\s+/g, ' ').trim();

      matches.push({
        id: pattern.id,
        category: pattern.category,
        weight: pattern.weight,
        description: pattern.description,
        matchedText: match[0],
        excerpt: (start > 0 ? '...' : '') + excerpt + (end < text.length ? '...' : '')
      });

      findings.push(`[${pattern.category}] Detected override phrase: "${match[0]}"`);
      totalScore += pattern.weight;
    }
  }

  // Normalize score between 0 and 100
  const normalizedScore = Math.min(100, totalScore);

  let status = 'CLEARED';
  if (normalizedScore >= 50) {
    status = 'DETAINED';
  } else if (normalizedScore >= 25) {
    status = 'SUSPICIOUS';
  }

  return {
    status,
    score: normalizedScore,
    matches,
    findings: findings.length > 0 ? findings : ['No instruction-override language detected.']
  };
}
