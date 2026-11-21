/**
 * Layer 3: Groq Prompt Guard Integration
 * 
 * Invokes Meta's Prompt Guard 2 (meta-llama/llama-prompt-guard-2-22m) hosted on Groq LPU.
 * Evaluates inputs for adversarial jailbreaks and indirect prompt injections.
 * 
 * ARCHITECTURE NOTES:
 * - Prompt Guard 2 has a 512-token context window (~1500 characters).
 * - Large emails are sliced into ~1500 character chunks with 100 character overlap.
 * - Slices are scanned in parallel using a concurrency guard.
 * - The highest attack probability across chunks is returned.
 * - Preview Safety: If Groq Prompt Guard endpoint is unavailable or errors out,
 *   the layer safely marks itself as 'unavailable' so remaining pipeline layers continue.
 */

import { scanPromptGuard } from '../llm/client.js';

const DEFAULT_MODEL = 'meta-llama/llama-prompt-guard-2-22m';
const CHUNK_SIZE = 1400; // Safe threshold for 512-token context window
const CHUNK_OVERLAP = 100;
const MAX_CONCURRENT_CHUNKS = 3;

/**
 * Splits long text into overlapping chunks
 */
function sliceTextIntoChunks(text = '', chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  if (!text || text.length <= chunkSize) {
    return [text];
  }

  const chunks = [];
  let startIndex = 0;

  while (startIndex < text.length) {
    const endIndex = Math.min(startIndex + chunkSize, text.length);
    chunks.push(text.slice(startIndex, endIndex));

    if (endIndex >= text.length) break;
    startIndex += chunkSize - overlap;
  }

  // Cap at top 6 chunks to prevent excessive API calls on giant emails
  return chunks.slice(0, 6);
}

/**
 * Scans a single text chunk with Groq Prompt Guard
 */
async function scanChunk(chunk, apiKey, modelName) {
  return scanPromptGuard({ chunk, model: modelName });
}

/**
 * Scans email text using Groq Llama Prompt Guard 2
 * 
 * @param {string} text 
 * @returns {Promise<object>} Layer result
 */
export async function runPromptGuardScan(text = '') {
  const apiKey = process.env.GROQ_API_KEY;
  const modelName = process.env.GROQ_PROMPT_GUARD_MODEL || DEFAULT_MODEL;

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return {
      status: 'CLEARED',
      score: 0,
      confidence: 1.0,
      findings: ['No text content to evaluate.']
    };
  }

  // Check if API key is configured
  if (!apiKey || apiKey === 'your_groq_api_key_here' || !apiKey.startsWith('gsk_')) {
    return {
      status: 'unavailable',
      score: 0,
      findings: ['Prompt Guard skipped: GROQ_API_KEY not configured.']
    };
  }

  const chunks = sliceTextIntoChunks(text);
  const findings = [];
  let maxScore = 0.0;

  try {
    // Parallel scanning with chunk batching
    for (let i = 0; i < chunks.length; i += MAX_CONCURRENT_CHUNKS) {
      const slice = chunks.slice(i, i + MAX_CONCURRENT_CHUNKS);
      const results = await Promise.all(
        slice.map(c => scanChunk(c, apiKey, modelName))
      );

      for (const score of results) {
        if (score > maxScore) {
          maxScore = score;
        }
      }
    }

    const threatScore = Math.round(maxScore * 100);

    let status = 'CLEARED';
    if (maxScore >= 0.85) {
      status = 'DETAINED';
      findings.push(`Llama Prompt Guard flagged high-probability prompt injection (Score: ${(maxScore * 100).toFixed(1)}%)`);
    } else if (maxScore >= 0.45) {
      status = 'SUSPICIOUS';
      findings.push(`Llama Prompt Guard flagged suspicious adversarial text structure (Score: ${(maxScore * 100).toFixed(1)}%)`);
    } else {
      findings.push(`Llama Prompt Guard cleared text as safe (Score: ${(maxScore * 100).toFixed(1)}%)`);
    }

    return {
      status,
      score: threatScore,
      probability: maxScore,
      chunksEvaluated: chunks.length,
      findings
    };
  } catch (err) {
    console.warn(`[Shield Layer 3] Prompt Guard call notice (${err.message}). Marking layer unavailable.`);
    return {
      status: 'unavailable',
      score: 0,
      error: err.message,
      findings: [`Prompt Guard layer unavailable: ${err.message}. Fallback to heuristic layers active.`]
    };
  }
}
