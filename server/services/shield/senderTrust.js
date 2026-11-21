import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from '../../db/database.js';
import { parseSenderAddress } from '../senderMemory/headerParser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load configuration for weights, thresholds, homoglyphs and allowlists
let config;
try {
  const configPath = path.resolve(__dirname, 'shield.config.json');
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (e) {
  config = {
    weights: {
      first_time_sender: 5,
      reply_to_mismatch: 15,
      auth_spf_fail: 10,
      auth_dkim_fail: 10,
      auth_dmarc_fail: 30,
      punycode_domain: 20,
      lookalike_domain: 35,
      display_name_spoof: 40,
      risky_ask_with_anomaly: 50,
      sender_trust_contribution: 0.30
    },
    thresholds: { suspicious: 25, detained: 60 },
    homoglyphs: { '1': 'l', '0': 'o', 'rn': 'm', 'vv': 'w' },
    freeMailAllowlist: ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com', 'mail.com', 'proton.me', 'protonmail.com', 'zoho.com', 'aol.com']
  };
}

const FREE_MAIL_SET = new Set(config.freeMailAllowlist || []);

/**
 * Normalizes visual homoglyphs in domain labels (1->l, 0->o, rn->m, vv->w)
 */
export function normalizeHomoglyphs(str = '') {
  let s = str.toLowerCase();
  for (const [k, v] of Object.entries(config.homoglyphs || {})) {
    s = s.replaceAll(k, v);
  }
  return s;
}

/**
 * Standard Levenshtein edit distance algorithm
 */
export function levenshteinDistance(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

/**
 * Checks if incoming domain is a deceptive lookalike of an established domain.
 * Criteria:
 * - Not a free-mail provider (gmail.com vs mail.com is NOT a lookalike)
 * - Same TLD
 * - Label length >= 6
 * - Levenshtein distance <= 2 on homoglyph-normalized label
 */
export function checkLookalikeDomain(incomingDomain = '', establishedDomains = []) {
  if (!incomingDomain || typeof incomingDomain !== 'string') return null;
  const incLower = incomingDomain.toLowerCase().trim();
  if (FREE_MAIL_SET.has(incLower)) return null;

  const incParts = incLower.split('.');
  if (incParts.length < 2) return null;
  const incTld = incParts[incParts.length - 1];
  const incLabel = incParts.slice(0, -1).join('.');

  if (incLabel.length < 6) return null;
  const normIncLabel = normalizeHomoglyphs(incLabel);

  for (const est of establishedDomains) {
    if (!est || typeof est !== 'string') continue;
    const estLower = est.toLowerCase().trim();
    if (estLower === incLower || FREE_MAIL_SET.has(estLower)) continue;

    const estParts = estLower.split('.');
    if (estParts.length < 2) continue;
    const estTld = estParts[estParts.length - 1];
    const estLabel = estParts.slice(0, -1).join('.');

    // Must share the exact same top-level domain to be an effective impersonation
    if (incTld !== estTld) continue;

    const normEstLabel = normalizeHomoglyphs(estLabel);
    if (normIncLabel === normEstLabel || levenshteinDistance(normIncLabel, normEstLabel) <= 2) {
      return {
        matchedDomain: estLower,
        distance: levenshteinDistance(normIncLabel, normEstLabel)
      };
    }
  }

  return null;
}

/**
 * Checks if incoming display name impersonates an established contact with a different email address
 */
export function checkDisplayNameSpoof(incomingName = '', incomingEmail = '', incomingDomain = '', establishedContacts = []) {
  if (!incomingName || typeof incomingName !== 'string') return null;
  const nameClean = incomingName.toLowerCase().replace(/["']/g, '').trim();
  if (nameClean.length < 3) return null;

  // Generic system titles that are common across organizations
  const GENERIC_TITLES = new Set(['admin', 'administrator', 'support', 'helpdesk', 'team', 'service', 'notifications', 'security alert', 'billing department']);
  if (GENERIC_TITLES.has(nameClean)) return null;

  for (const contact of establishedContacts) {
    if (!contact || !contact.sender_email) continue;
    const contactEmail = contact.sender_email.toLowerCase();
    const contactDomain = (contact.sender_domain || '').toLowerCase();

    // If email or domain matches the established contact, it is NOT a spoof
    if (contactEmail === incomingEmail || (contactDomain && contactDomain === incomingDomain)) {
      continue;
    }

    let displayNames = [];
    try {
      displayNames = typeof contact.display_names_json === 'string'
        ? JSON.parse(contact.display_names_json)
        : (contact.display_names || []);
    } catch (_) {
      displayNames = [];
    }

    for (const dName of displayNames) {
      if (!dName || typeof dName !== 'string') continue;
      const dClean = dName.toLowerCase().replace(/["']/g, '').trim();
      if (dClean === nameClean) {
        return {
          spoofedContactEmail: contactEmail,
          spoofedContactName: dName
        };
      }
    }
  }

  return null;
}

/**
 * Scans email text for risky asks: wire/payments, gift cards, credentials reset, banking change
 */
export function scanRiskyAsk(text = '') {
  if (!text || typeof text !== 'string') return { isRisky: false };

  const content = text.toLowerCase();

  // 1. Payment or Bank Detail Modification
  const bankChangeRegex = /\b(?:change|update|new|replace)\s+(?:our|my|the)?\s*(?:bank|account|banking|wire|routing|payment|remittance)\s*(?:details|info|number|instructions)?\b/i;
  const wireRegex = /\b(?:wire\s+transfer|wire\s+(?:money|funds|payment|usd|inr|cash|rs|amount)|transfer\s+(?:money|funds|payment|usd|inr|cash|rs|amount)|wire\s+needed|transfer\s+needed)\b/i;
  const giftCardRegex = /\b(?:gift\s*card|itunes|steam|amazon\s*gift)\b/i;

  // 2. Credential Verification / Account Lockout
  const credentialRegex = /\b(?:verify|confirm|re-enter|update)\s+(?:your)?\s*(?:password|credentials|login|account|banking|identity)\b/i;
  const resetPassRegex = /\b(?:reset|change)\s+(?:your)?\s*(?:password|passcode|pin)\s*(?:immediately|urgent|now)?\b/i;
  const phishingClickRegex = /\b(?:click\s*here\s*to\s*(?:login|verify|unlock|reactivate))\b/i;

  // 3. Hinglish Urgent Payment & Account change patterns
  const hinglishPaymentRegex = /\b(?:paisa\s*bhejo|account\s*number\s*badlo|turant\s*payment|payment\s*kar\s*do|paise\s*transfer\s*karo|jaldi\s*bhejo)\b/i;

  // 4. Urgency Indicators
  const urgencyRegex = /\b(?:urgent|immediately|within\s*\d+\s*(?:hours|mins|minutes)|asap|action\s*required|right\s*now|turant|fatafat)\b/i;

  const hasUrgency = urgencyRegex.test(content);

  if (bankChangeRegex.test(content)) {
    return { isRisky: true, reason: 'Request to modify banking or payment disbursement instructions', category: 'BANKING_MODIFICATION' };
  }
  if (wireRegex.test(content) && (hasUrgency || content.includes('wire transfer'))) {
    return { isRisky: true, reason: 'Urgent wire transfer or money remittance request', category: 'URGENT_WIRE' };
  }
  if (giftCardRegex.test(content)) {
    return { isRisky: true, reason: 'Request to purchase or transfer gift cards', category: 'GIFT_CARD' };
  }
  if (credentialRegex.test(content) || resetPassRegex.test(content) || phishingClickRegex.test(content)) {
    return { isRisky: true, reason: 'Request to enter credentials, verify account password, or click re-authentication links', category: 'CREDENTIAL_HARVESTING' };
  }
  if (hinglishPaymentRegex.test(content)) {
    return { isRisky: true, reason: 'Hinglish urgent payment / account change instruction detected', category: 'HINGLISH_PAYMENT' };
  }

  return { isRisky: false };
}

/**
 * Evaluates Sender Trust Memory for an incoming email
 * 
 * @param {object} email - { id, user_id, sender, sender_name, subject, body_text, snippet, headers }
 * @param {object} [injectedContext] - Optional pre-loaded context for unit tests & offline benchmarking
 * @returns {object} Layer 4 Sender Trust evaluation result
 */
export function evaluateSenderTrust(email = {}, injectedContext = null) {
  try {
    const rawSender = email.sender || email.from_addr || email.from || '';
    const userId = email.user_id || email.userId;

    // If no sender information or no user ID, return neutral PASS (Invariant 5: preserve old fixtures)
    if (!rawSender) {
      return {
        name: 'Sender Trust & Identity Memory',
        status: 'PASS',
        label: 'unknown',
        score: 0,
        findings: [],
        profileSummary: null,
        noSenderContext: true
      };
    }

    const parsedSender = parseSenderAddress(rawSender);
    const senderEmail = parsedSender.email;
    const senderDomain = parsedSender.domain;
    const senderName = email.sender_name || email.senderName || parsedSender.name || '';

    // Retrieve context from database if not explicitly injected
    let profile = null;
    let headersMeta = null;
    let establishedContacts = [];
    let establishedDomains = [];

    const ctx = injectedContext || email.senderContext || null;
    if (ctx) {
      profile = ctx.profile || null;
      headersMeta = ctx.headersMeta || null;
      establishedContacts = ctx.establishedContacts || [];
      establishedDomains = ctx.establishedDomains || [];
    } else if (userId) {
      try {
        profile = db.prepare('SELECT * FROM sender_profiles WHERE user_id = ? AND sender_email = ?').get(userId, senderEmail);
        if (email.id) {
          headersMeta = db.prepare('SELECT * FROM email_headers_meta WHERE user_id = ? AND email_id = ?').get(userId, email.id);
        }
        establishedContacts = db.prepare(`
          SELECT sender_email, sender_domain, display_names_json, sent_to_count, trust_state
          FROM sender_profiles
          WHERE user_id = ? AND (sent_to_count > 0 OR trust_state = 'trusted')
        `).all(userId);

        establishedDomains = db.prepare(`
          SELECT DISTINCT sender_domain
          FROM sender_profiles
          WHERE user_id = ? AND (sent_to_count > 0 OR trust_state = 'trusted' OR received_count >= 3)
        `).all(userId).map(r => r.sender_domain).filter(Boolean);
      } catch (dbErr) {
        console.warn('[Sender Trust DB Query Notice]', dbErr.message);
      }
    }

    // INVARIANT: Blocked senders are immediately DETAINED
    if (profile && profile.trust_state === 'blocked') {
      return {
        name: 'Sender Trust & Identity Memory',
        status: 'DETAINED',
        label: 'blocked',
        score: 100,
        findings: [{
          signal: 'blocked_sender',
          reason: 'Aapne is sender ko block kiya hai. Autonomous processing halted.'
        }],
        profileSummary: {
          firstSeen: profile.first_seen_at,
          receivedCount: profile.received_count || 1,
          sentToCount: profile.sent_to_count || 0,
          auth: { spf: headersMeta?.spf || 'unknown', dkim: headersMeta?.dkim || 'unknown', dmarc: headersMeta?.dmarc || 'unknown' }
        }
      };
    }

    // Check establishment criteria
    const sentToCount = profile?.sent_to_count || 0;
    const receivedCount = profile?.received_count || 1;
    const trustState = profile?.trust_state || 'unknown';

    let isEstablished = false;
    if (sentToCount >= 1 || trustState === 'trusted') {
      isEstablished = true;
    } else if (receivedCount >= 3 && profile?.first_seen_at) {
      const firstSeenEpoch = new Date(profile.first_seen_at).getTime();
      const fourteenDaysAgo = Date.now() - (14 * 24 * 60 * 60 * 1000);
      if (!isNaN(firstSeenEpoch) && firstSeenEpoch <= fourteenDaysAgo) {
        isEstablished = true;
      }
    }

    const findings = [];
    let layerScore = 0;
    let hasAnomaly = false;

    // 1. First-time sender signal (informative, small weight)
    if (!profile || (receivedCount <= 1 && sentToCount === 0 && trustState !== 'trusted')) {
      findings.push({
        signal: 'first_time_sender',
        reason: 'First-time sender: No prior bilateral correspondence recorded with this sender address.'
      });
      layerScore += config.weights.first_time_sender || 5;
    }

    // 2. Punycode Domain Check
    if (senderDomain.startsWith('xn--')) {
      findings.push({
        signal: 'punycode_domain',
        reason: `Internationalized Punycode domain detected (${senderDomain}): possible homograph spoofing.`
      });
      layerScore += config.weights.punycode_domain || 20;
      hasAnomaly = true;
    }

    // 3. Lookalike Domain Check
    const lookalike = checkLookalikeDomain(senderDomain, establishedDomains);
    if (lookalike) {
      findings.push({
        signal: 'lookalike_domain',
        reason: `Lookalike domain: "@${senderDomain}" visually mimics established contact domain "@${lookalike.matchedDomain}".`
      });
      layerScore += config.weights.lookalike_domain || 35;
      hasAnomaly = true;
    }

    // 4. Display-Name Spoof Check
    const spoof = checkDisplayNameSpoof(senderName, senderEmail, senderDomain, establishedContacts);
    if (spoof) {
      findings.push({
        signal: 'display_name_spoof',
        reason: `Display-name spoof: Sender name "${senderName}" matches known contact "${spoof.spoofedContactEmail}", but originates from external address "${senderEmail}".`
      });
      layerScore += config.weights.display_name_spoof || 40;
      hasAnomaly = true;
    }

    // 5. Authentication Failure Checks (SPF, DKIM, DMARC)
    const spf = headersMeta?.spf || 'unknown';
    const dkim = headersMeta?.dkim || 'unknown';
    const dmarc = headersMeta?.dmarc || 'unknown';

    if (dmarc === 'fail') {
      findings.push({
        signal: 'dmarc_failure',
        reason: 'Domain-based Message Authentication (DMARC) validation failed for this sender.'
      });
      layerScore += config.weights.auth_dmarc_fail || 30;
      hasAnomaly = true;
    }
    if (spf === 'fail') {
      findings.push({
        signal: 'spf_failure',
        reason: 'Sender Policy Framework (SPF) check failed: sending IP is not authorized by domain owner.'
      });
      layerScore += config.weights.auth_spf_fail || 10;
    }
    if (dkim === 'fail') {
      findings.push({
        signal: 'dkim_failure',
        reason: 'DomainKeys Identified Mail (DKIM) cryptographic signature verification failed.'
      });
      layerScore += config.weights.auth_dkim_fail || 10;
    }

    // 6. Reply-To Mismatch Check
    const fromRaw = headersMeta?.from_addr || rawSender;
    if (headersMeta?.reply_to && fromRaw) {
      const fromParsed = parseSenderAddress(fromRaw);
      const replyParsed = parseSenderAddress(headersMeta.reply_to);
      if (fromParsed.domain && replyParsed.domain && fromParsed.domain !== replyParsed.domain) {
        findings.push({
          signal: 'reply_to_mismatch',
          reason: `Reply-To destination domain "@${replyParsed.domain}" diverges from sender domain "@${fromParsed.domain}".`
        });
        layerScore += config.weights.reply_to_mismatch || 15;
        hasAnomaly = true;
      }
    }

    // 7. Risky Ask Check
    const fullText = `${email.subject || ''}\n${email.body_text || email.bodyText || email.snippet || ''}`;
    const riskyAsk = scanRiskyAsk(fullText);

    if (riskyAsk.isRisky) {
      if (hasAnomaly) {
        // High threat: Anomaly + Risky Ask => Heavy penalty & triggers DETAINED
        findings.push({
          signal: 'risky_ask_with_anomaly',
          reason: `Critical: Email contains ${riskyAsk.reason} originating from an unverified or anomalous sender.`
        });
        layerScore += config.weights.risky_ask_with_anomaly || 50;
      } else if (isEstablished) {
        // Informational finding for established contacts requesting payments
        findings.push({
          signal: 'risky_ask_established_warning',
          reason: 'Jaane-pehchane sender ne payment/credential maanga, kisi dusre channel (call/in-person) se verify karo.'
        });
      }
    }

    // INVARIANT: Anomaly alone is MAX SUSPICIOUS (never DETAINED unless anomaly + risky ask or blocked)
    let status = 'PASS';
    if (hasAnomaly && riskyAsk.isRisky) {
      status = 'DETAINED';
    } else if (layerScore >= (config.thresholds.suspicious || 25)) {
      status = 'SUSPICIOUS';
    } else {
      status = 'PASS';
    }

    // Label determination
    let label = 'new';
    if (trustState === 'trusted') label = 'trusted';
    else if (status === 'DETAINED' || status === 'SUSPICIOUS') label = 'suspicious';
    else if (isEstablished) label = 'established';
    else label = 'new';

    return {
      name: 'Sender Trust & Identity Memory',
      status,
      label,
      score: Math.min(100, layerScore),
      findings,
      profileSummary: {
        firstSeen: profile?.first_seen_at || new Date().toISOString(),
        receivedCount,
        sentToCount,
        auth: { spf, dkim, dmarc }
      }
    };
  } catch (err) {
    // INVARIANT: Fail-safe on error. Mark layer 'unavailable' without failing closed the entire pipeline.
    console.warn('[Sender Trust Layer Warning]', err.message);
    return {
      name: 'Sender Trust & Identity Memory',
      status: 'PASS',
      label: 'unknown',
      score: 0,
      findings: [{ signal: 'layer_error', reason: 'Sender Trust verification temporarily unavailable.' }],
      profileSummary: null,
      unavailable: true
    };
  }
}
