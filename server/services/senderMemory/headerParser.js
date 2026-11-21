/**
 * Header Parser for Sender Trust Memory (MailMind AI)
 * 
 * Securely parses email headers and Gmail authentication results:
 * - Authentication-Results: strictly inspects stanzas from 'mx.google.com' to prevent forged sender headers.
 * - Sender Address: extracts email, domain, and display name (handling quoted names and comma separators).
 */

/**
 * Normalizes SPF, DKIM, or DMARC result tokens to standard enum
 * 
 * @param {string} val 
 * @returns {'pass' | 'fail' | 'none' | 'unknown'}
 */
function normalizeAuthResult(val) {
  if (!val || typeof val !== 'string') return 'unknown';
  const v = val.trim().toLowerCase();
  if (v === 'pass' || v === 'bestguesspass') return 'pass';
  if (v === 'fail' || v === 'softfail') return 'fail';
  if (v === 'none') return 'none';
  return 'unknown';
}

/**
 * Parses Gmail's Authentication-Results header.
 * 
 * SECURITY INVARIANT:
 * Attackers can inject their own fake 'Authentication-Results' header into email bodies.
 * We ONLY accept headers whose authenticating service ID (authserv-id) is 'mx.google.com'.
 * 
 * @param {string|string[]} authResultsHeaders - Header value(s)
 * @returns {{ spf: 'pass'|'fail'|'none'|'unknown', dkim: 'pass'|'fail'|'none'|'unknown', dmarc: 'pass'|'fail'|'none'|'unknown' }}
 */
export function parseAuthenticationResults(authResultsHeaders) {
  const defaultResult = { spf: 'unknown', dkim: 'unknown', dmarc: 'unknown' };
  if (!authResultsHeaders) return defaultResult;

  const headerList = Array.isArray(authResultsHeaders) ? authResultsHeaders : [authResultsHeaders];

  // Locate the stanza stamped by Google's inbound MTA (authserv-id: mx.google.com)
  let googleAuthStanza = null;
  for (const h of headerList) {
    if (!h || typeof h !== 'string') continue;
    const cleaned = h.trim().replace(/^authentication-results:\s*/i, '');
    const firstToken = cleaned.split(';')[0].trim().toLowerCase();
    if (firstToken === 'mx.google.com') {
      googleAuthStanza = cleaned;
      break;
    }
  }

  if (!googleAuthStanza) return defaultResult;

  const spfMatch = googleAuthStanza.match(/\bspf=([a-z]+)/i);
  const dkimMatch = googleAuthStanza.match(/\bdkim=([a-z]+)/i);
  const dmarcMatch = googleAuthStanza.match(/\bdmarc=([a-z]+)/i);

  return {
    spf: spfMatch ? normalizeAuthResult(spfMatch[1]) : 'unknown',
    dkim: dkimMatch ? normalizeAuthResult(dkimMatch[1]) : 'unknown',
    dmarc: dmarcMatch ? normalizeAuthResult(dmarcMatch[1]) : 'unknown'
  };
}

/**
 * Parses an RFC 2822 sender string like:
 * - "John Doe" <john@example.com>
 * - "Doe, John" <john@example.com>
 * - <john@example.com>
 * - john@example.com
 * 
 * @param {string} rawString 
 * @returns {{ email: string, domain: string, name: string }}
 */
export function parseSenderAddress(rawString) {
  if (!rawString || typeof rawString !== 'string') {
    return { email: '', domain: '', name: '' };
  }

  const trimmed = rawString.trim();

  // Case 1: Name <email@domain.com> (with optional quotes around name)
  const angleMatch = trimmed.match(/^(?:["']?([^"'<>]*)["']?\s*)?<\s*([^<>@\s]+@[^<>@\s]+)\s*>$/);
  if (angleMatch) {
    const rawName = (angleMatch[1] || '').trim();
    const email = angleMatch[2].trim().toLowerCase();
    const domain = (email.split('@')[1] || '').toLowerCase();
    return {
      email,
      domain,
      name: rawName || email.split('@')[0]
    };
  }

  // Case 2: Bare email address in text
  const bareMatch = trimmed.match(/\b([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/);
  if (bareMatch) {
    const email = bareMatch[1].trim().toLowerCase();
    const domain = (email.split('@')[1] || '').toLowerCase();
    let name = trimmed.replace(bareMatch[0], '').replace(/[<>"']/g, '').trim();
    if (!name) name = email.split('@')[0];
    return { email, domain, name };
  }

  return { email: '', domain: '', name: trimmed };
}

/**
 * Extracts relevant headers from Gmail payload headers array
 * 
 * @param {Array<{ name: string, value: string }>} headers 
 * @returns {{ from: object, replyTo: object|null, auth: object, date: string }}
 */
export function parseEmailHeaders(headers = []) {
  if (!Array.isArray(headers)) {
    return {
      from: { email: '', domain: '', name: '' },
      replyTo: null,
      auth: { spf: 'unknown', dkim: 'unknown', dmarc: 'unknown' },
      date: ''
    };
  }

  let fromValue = '';
  let replyToValue = '';
  const authResults = [];
  let dateValue = '';

  for (const h of headers) {
    if (!h || !h.name) continue;
    const nameLower = h.name.toLowerCase();
    if (nameLower === 'from' && !fromValue) {
      fromValue = h.value || '';
    } else if (nameLower === 'reply-to' && !replyToValue) {
      replyToValue = h.value || '';
    } else if (nameLower === 'authentication-results') {
      authResults.push(h.value || '');
    } else if (nameLower === 'date' && !dateValue) {
      dateValue = h.value || '';
    }
  }

  const from = parseSenderAddress(fromValue);
  const replyTo = replyToValue ? parseSenderAddress(replyToValue) : null;
  const auth = parseAuthenticationResults(authResults);

  return { from, replyTo, auth, date: dateValue };
}
