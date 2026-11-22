/**
 * MailMind AI — Sync Configuration & Batch Size Constants
 * 
 * Single source of truth for:
 * - Allowed batch size choices configurable by the user
 * - Default sync batch size
 * - Internal concurrency & paging bounds
 */

export const ALLOWED_BATCH_SIZES = Object.freeze([20, 50, 100, 200]);
export const DEFAULT_BATCH_SIZE = 50;

// Internal execution limits (independent of user target batch size)
export const FETCH_CONCURRENCY = 8;       // Max parallel Gmail messages.get requests
export const FETCH_CHUNK_SIZE = 16;        // Chunk size for batching get requests
export const AI_CONCURRENCY = 3;           // Max concurrent Groq LLM requests
export const MAX_GMAIL_PAGE_SIZE = 100;    // Max messages per single Gmail messages.list call
export const MAX_FETCH_RETRIES = 3;        // Exponential backoff retries on 429/5xx

/**
 * Validates whether a value is an allowed batch size
 * @param {any} val 
 * @returns {boolean}
 */
export function isValidBatchSize(val) {
  const num = Number(val);
  return Number.isInteger(num) && ALLOWED_BATCH_SIZES.includes(num);
}

/**
 * Sanitizes and normalizes batch size, falling back to default if invalid
 * @param {any} val 
 * @param {number} fallback 
 * @returns {number}
 */
export function normalizeBatchSize(val, fallback = DEFAULT_BATCH_SIZE) {
  const num = Number(val);
  if (Number.isInteger(num) && ALLOWED_BATCH_SIZES.includes(num)) {
    return num;
  }
  return fallback;
}
