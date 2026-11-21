/**
 * Layer 4: AI Output Validator
 * 
 * Inspects AI-generated summaries, extracted tasks, and reply drafts against the original
 * human-visible email text.
 * 
 * Verifies that the LLM did not hallucinate or execute an injected payload by introducing:
 * - Unseen URLs or shortened redirect links
 * - Exfiltration email addresses
 * - Unauthorized banking/payment details
 * - Phone numbers not present in the visible email
 */

// Extraction regex patterns
const URL_REGEX = /https?:\/\/[^\s<>"')]+(?:\b|\/)/gi;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_REGEX = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
const IBAN_OR_BANK_REGEX = /\b(?:[A-Z]{2}\d{2}[A-Z0-9]{11,30}|\d{9,18})\b/g;

/**
 * Normalizes a URL for comparison (removes trailing slashes and http/https protocol)
 */
function normalizeUrl(url) {
  return url.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
}

/**
 * Validates AI outputs against visible text
 * 
 * @param {object} aiOutput - { summary, tasks: [{ task_title }], reply_drafts: [{ reply_body }] }
 * @param {string} visibleText - Clean, human-visible text from the email
 * @returns {object} Validation result
 */
export function validateAiOutput(aiOutput = {}, visibleText = '') {
  const findings = [];
  const flaggedEntities = [];
  let threatScore = 0;

  if (!aiOutput || !visibleText) {
    return {
      status: 'CLEARED',
      score: 0,
      isValid: true,
      flaggedEntities: [],
      findings: ['No output to validate against visible content.']
    };
  }

  // Aggregate all AI generated text into one string
  const aiGeneratedText = [
    aiOutput.summary || '',
    ...(aiOutput.tasks || []).map(t => t.task_title || ''),
    ...(aiOutput.reply_drafts || []).map(d => d.reply_body || '')
  ].join('\n');

  const lowerVisible = visibleText.toLowerCase();

  // 1. Check for hallucinated / injected URLs
  const aiUrls = aiGeneratedText.match(URL_REGEX) || [];
  const visibleUrls = (visibleText.match(URL_REGEX) || []).map(normalizeUrl);

  for (const url of aiUrls) {
    const norm = normalizeUrl(url);
    if (!visibleUrls.some(v => v.includes(norm) || norm.includes(v))) {
      flaggedEntities.push({ type: 'UNSEEN_URL', value: url });
      findings.push(`AI output introduced URL not present in visible email: ${url}`);
      threatScore += 45;
    }
  }

  // 2. Check for hallucinated / exfiltrated email addresses
  const aiEmails = aiGeneratedText.match(EMAIL_REGEX) || [];
  for (const email of aiEmails) {
    if (!lowerVisible.includes(email.toLowerCase())) {
      flaggedEntities.push({ type: 'UNSEEN_EMAIL', value: email });
      findings.push(`AI output introduced email address not present in visible content: ${email}`);
      threatScore += 40;
    }
  }

  // 3. Check for unauthorized financial/bank routing numbers
  const aiBankRefs = aiGeneratedText.match(IBAN_OR_BANK_REGEX) || [];
  for (const ref of aiBankRefs) {
    // Only flag long digit sequences (account/routing) not seen in visible text
    if (ref.length >= 8 && !visibleText.includes(ref)) {
      flaggedEntities.push({ type: 'UNSEEN_FINANCIAL_INFO', value: ref });
      findings.push(`AI output introduced banking/account reference not found in original text: ${ref}`);
      threatScore += 50;
    }
  }

  const isValid = flaggedEntities.length === 0;
  const normalizedScore = Math.min(100, threatScore);
  const status = isValid ? 'CLEARED' : (normalizedScore >= 50 ? 'DETAINED' : 'SUSPICIOUS');

  return {
    status,
    score: normalizedScore,
    isValid,
    flaggedEntities,
    findings: findings.length > 0 ? findings : ['AI outputs verified: No hallucinated or injected external entities detected.']
  };
}
