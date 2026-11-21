import crypto from 'node:crypto';
import { db } from '../../db/database.js';
import { runDeterministicChecks } from './deterministicChecks.js';
import { analyzeDraftTone } from './toneCheck.js';

/**
 * Regret Shield Service (Phase 2 Feature)
 * 
 * Orchestrates deterministic risk checks and Groq tone analysis before email authorization.
 * Features:
 * - SHA-256 hash caching in `draft_checks` table
 * - Feature flag gating: FEATURE_REGRET_SHIELD (default: true)
 * - Severity calculation: 'pass' | 'review' | 'high'
 * - Clean excerpts storage (no full body duplication)
 */

/**
 * Computes SHA-256 hash of normalized draft text
 */
export function computeDraftHash(text = '') {
  return crypto.createHash('sha256').update(String(text).trim()).digest('hex');
}

/**
 * Checks if the Regret Shield feature is enabled in environment
 */
export function isRegretShieldEnabled() {
  return process.env.FEATURE_REGRET_SHIELD !== 'false';
}

/**
 * Runs the comprehensive Regret Shield evaluation
 * 
 * @param {object} params
 * @param {string} params.draftId - Draft ID
 * @param {string} params.draftText - Content of the draft
 * @param {string} params.userId - Authenticated user ID
 * @param {object} params.recipientContext - { toAddresses, fromAddress, replyToAddress, senderName, threadSenders }
 * @param {string} params.visibleContext - Visible body of original email
 * @param {boolean} params.forceRecheck - If true, bypasses draft_checks cache
 * @returns {Promise<object>} Combined Regret Shield evaluation
 */
export async function evaluateDraft(params = {}) {
  const {
    draftId = 'adhoc',
    draftText = '',
    userId,
    recipientContext = {},
    visibleContext = '',
    forceRecheck = false
  } = params;

  const draftHash = computeDraftHash(draftText);

  // If feature is disabled via env flag, return clean pass immediately
  if (!isRegretShieldEnabled()) {
    return {
      severity: 'pass',
      items: [],
      commitments: [],
      softerRewrite: null,
      toneCheckAvailable: true,
      draftHash,
      disabledByFlag: true
    };
  }

  // 1. Check cache in `draft_checks` table if userId & draftId are provided
  if (!forceRecheck && userId && draftId) {
    try {
      const cached = db.prepare(`
        SELECT * FROM draft_checks 
        WHERE user_id = ? AND draft_id = ? AND draft_hash = ?
      `).get(userId, draftId, draftHash);

      if (cached) {
        const parsed = JSON.parse(cached.result_json);
        return {
          ...parsed,
          severity: cached.severity,
          draftHash,
          cached: true,
          acknowledgedAt: cached.acknowledged_at
        };
      }
    } catch (cacheErr) {
      console.warn('[Regret Shield] Cache read notice:', cacheErr.message);
    }
  }

  // 2. Run Deterministic Checks (offline, fast)
  const deterministicItems = runDeterministicChecks(draftText, recipientContext);

  // 3. Run LLM Tone & Commitment Check
  const toneResult = await analyzeDraftTone(draftText, visibleContext);

  // 4. Combine items: deterministic items + tone flags
  const combinedItems = [...deterministicItems];
  if (Array.isArray(toneResult.flags)) {
    for (const flag of toneResult.flags) {
      combinedItems.push({
        type: flag.type,
        severity: flag.type === 'harsh' ? 'HIGH' : 'MEDIUM',
        excerpt: flag.excerpt || '',
        message: flag.suggestion || `Potential tone consideration: ${flag.type}`
      });
    }
  }

  // 5. Calculate Composite Severity
  // Rule:
  // - Any HIGH item OR tone risk_level === 'high' => "high"
  // - Any MEDIUM/LOW item OR tone risk_level === 'medium' => "review"
  // - Otherwise => "pass"
  let severity = 'pass';
  const hasHigh = combinedItems.some(it => it.severity === 'HIGH') || toneResult.risk_level === 'high';
  const hasMediumOrLow = combinedItems.some(it => it.severity === 'MEDIUM' || it.severity === 'LOW') || toneResult.risk_level === 'medium';

  if (hasHigh) {
    severity = 'high';
  } else if (hasMediumOrLow) {
    severity = 'review';
  }

  const evaluation = {
    severity,
    items: combinedItems,
    commitments: toneResult.commitments || [],
    softerRewrite: toneResult.softer_rewrite || null,
    toneCheckAvailable: toneResult.toneCheckAvailable !== false,
    draftHash
  };

  // 6. Cache result in `draft_checks` table under userId if draft exists in database
  if (userId && draftId && draftId !== 'adhoc') {
    try {
      const draftExists = db.prepare('SELECT id FROM drafts WHERE id = ? AND user_id = ?').get(draftId, userId);
      if (draftExists) {
        const checkId = 'chk_' + Math.random().toString(36).slice(2, 10);
        const resultJsonToStore = JSON.stringify({
          items: evaluation.items,
          commitments: evaluation.commitments,
          softerRewrite: evaluation.softerRewrite,
          toneCheckAvailable: evaluation.toneCheckAvailable
        });

        db.prepare(`
          INSERT INTO draft_checks (id, user_id, draft_id, draft_hash, severity, result_json, created_at)
          VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        `).run(
          checkId,
          userId,
          draftId,
          draftHash,
          severity,
          resultJsonToStore
        );
      }
    } catch (saveErr) {
      console.warn('[Regret Shield] Cache persist notice:', saveErr.message);
    }
  }

  return evaluation;
}

/**
 * Acknowledges a high-severity regret check for an approved draft
 */
export function acknowledgeDraftCheck(draftId, draftHash, userId) {
  if (!draftId || !draftHash || !userId) return;
  try {
    db.prepare(`
      UPDATE draft_checks 
      SET acknowledged_at = datetime('now')
      WHERE draft_id = ? AND draft_hash = ? AND user_id = ?
    `).run(draftId, draftHash, userId);
  } catch (err) {
    console.warn('[Regret Shield] Acknowledge notice:', err.message);
  }
}
