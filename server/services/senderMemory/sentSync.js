import crypto from 'node:crypto';
import { google } from 'googleapis';
import { db } from '../../db/database.js';
import { getAuthenticatedClientForUser } from '../oauthService.js';
import { parseSenderAddress } from './headerParser.js';

/**
 * Splits a comma-separated list of email addresses respecting quoted segments with commas.
 * (e.g., '"Doe, John" <john@corp.com>, Jane Smith <jane@corp.com>')
 * 
 * @param {string} rawString 
 * @returns {string[]}
 */
export function splitAddressList(rawString) {
  if (!rawString || typeof rawString !== 'string') return [];
  const tokens = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < rawString.length; i++) {
    const char = rawString[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      current += char;
    } else if (char === ',' && !inQuotes) {
      if (current.trim()) tokens.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) tokens.push(current.trim());
  return tokens;
}

/**
 * Parses all recipient addresses from a To or Cc header
 * 
 * @param {string} rawHeader 
 * @returns {Array<{ name: string, email: string, domain: string }>}
 */
export function parseAddressList(rawHeader) {
  const tokens = splitAddressList(rawHeader);
  const addresses = [];
  for (const token of tokens) {
    const parsed = parseSenderAddress(token);
    if (parsed && parsed.email) {
      addresses.push(parsed);
    }
  }
  return addresses;
}

/**
 * Helper to fetch a single message metadata with exponential backoff on 429
 */
async function fetchMetadataWithBackoff(gmail, messageId, maxRetries = 2) {
  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      const res = await gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'metadata',
        metadataHeaders: ['To', 'Cc', 'Date']
      });
      return res.data;
    } catch (err) {
      const status = err.status || err.code || (err.response && err.response.status);
      if (status === 429 && attempt < maxRetries) {
        attempt++;
        const backoffMs = Math.pow(2, attempt) * 500;
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      } else {
        throw err;
      }
    }
  }
}

/**
 * Concurrency runner for processing items in batches of size N
 */
async function runWithConcurrency(items, limit, workerFn) {
  const results = [];
  for (let i = 0; i < items.length; i += limit) {
    const batch = items.slice(i, i + limit);
    const batchResults = await Promise.allSettled(batch.map(workerFn));
    results.push(...batchResults);
  }
  return results;
}

/**
 * Synchronizes SENT mail metadata from Gmail to update `sent_to_count` and `last_sent_at`.
 * 
 * STRICT INVARIANTS:
 * - NEVER fetches email bodies (format='metadata', headers='To,Cc,Date').
 * - Incremental sync: tracks last_sent_sync timestamp in settings.
 * - Rate-limited with 429 exponential backoff.
 * - Safe concurrency (5 batches).
 * 
 * @param {string} userId - Authenticated user ID
 * @param {object} [customGmail] - Optional injectable Gmail client for unit tests
 * @param {number} [customLimit] - Optional override limit
 * @returns {Promise<{ success: boolean, processedCount: number, updatedCount: number }>}
 */
export async function syncSentMailMetadata(userId, customGmail = null, customLimit = null) {
  if (process.env.FEATURE_SENDER_TRUST === 'false') {
    return { success: true, processedCount: 0, updatedCount: 0, disabledByFlag: true };
  }

  const limit = customLimit || parseInt(process.env.SENT_SYNC_LIMIT, 10) || 300;

  try {
    let gmail = customGmail;
    if (!gmail) {
      const authData = await getAuthenticatedClientForUser(userId);
      gmail = google.gmail({ version: 'v1', auth: authData.oauth2Client });
    }

    // Check last sent sync timestamp
    const syncSettingKey = `last_sent_sync_${userId}`;
    const lastSyncRow = db.prepare('SELECT value FROM settings WHERE key = ?').get(syncSettingKey);
    let listQuery = '';
    if (lastSyncRow && lastSyncRow.value) {
      const lastSyncEpoch = Math.floor(new Date(lastSyncRow.value).getTime() / 1000);
      if (!isNaN(lastSyncEpoch) && lastSyncEpoch > 0) {
        listQuery = `after:${lastSyncEpoch}`;
      }
    }

    // Fetch list of sent message IDs up to limit
    let messageSummaries = [];
    let pageToken = undefined;
    while (messageSummaries.length < limit) {
      const fetchCount = Math.min(100, limit - messageSummaries.length);
      const listParams = {
        userId: 'me',
        labelIds: ['SENT'],
        maxResults: fetchCount
      };
      if (listQuery) listParams.q = listQuery;
      if (pageToken) listParams.pageToken = pageToken;

      const listRes = await gmail.users.messages.list(listParams);
      const messages = listRes.data?.messages || [];
      if (messages.length === 0) break;

      messageSummaries.push(...messages);
      pageToken = listRes.data?.nextPageToken;
      if (!pageToken) break;
    }

    if (messageSummaries.length === 0) {
      return { success: true, processedCount: 0, updatedCount: 0 };
    }

    // Concurrently fetch metadata for messages (5 at a time)
    const BATCH_CONCURRENCY = 5;
    const fetchResults = await runWithConcurrency(
      messageSummaries,
      BATCH_CONCURRENCY,
      msg => fetchMetadataWithBackoff(gmail, msg.id)
    );

    let processedCount = 0;
    let updatedCount = 0;

    for (const res of fetchResults) {
      if (res.status !== 'fulfilled' || !res.value) continue;
      const msgData = res.value;
      const headers = msgData.payload?.headers || [];

      let toHeader = '';
      let ccHeader = '';
      let dateHeader = '';

      for (const h of headers) {
        if (!h || !h.name) continue;
        const nameLower = h.name.toLowerCase();
        if (nameLower === 'to') toHeader = h.value || '';
        else if (nameLower === 'cc') ccHeader = h.value || '';
        else if (nameLower === 'date') dateHeader = h.value || '';
      }

      let sentDate = new Date().toISOString();
      if (dateHeader) {
        try {
          const parsedD = new Date(dateHeader);
          if (!isNaN(parsedD.getTime())) sentDate = parsedD.toISOString();
        } catch (_) {}
      }

      const allRecipients = [
        ...parseAddressList(toHeader),
        ...parseAddressList(ccHeader)
      ];

      // Deduplicate recipients for this single message
      const seenForThisMsg = new Set();
      for (const rec of allRecipients) {
        if (!rec.email || seenForThisMsg.has(rec.email)) continue;
        seenForThisMsg.add(rec.email);

        const existing = db.prepare(`
          SELECT * FROM sender_profiles WHERE user_id = ? AND sender_email = ?
        `).get(userId, rec.email);

        if (!existing) {
          const newId = 'snd_' + crypto.randomUUID();
          const displayNames = rec.name ? [rec.name] : [];
          db.prepare(`
            INSERT INTO sender_profiles (
              id, user_id, sender_email, sender_domain, display_names_json,
              first_seen_at, last_seen_at, received_count, sent_to_count, last_sent_at,
              trust_state, user_set
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1, ?, 'unknown', 0)
          `).run(
            newId,
            userId,
            rec.email,
            rec.domain,
            JSON.stringify(displayNames),
            sentDate,
            sentDate,
            sentDate
          );
          updatedCount++;
        } else {
          let displayNames = [];
          try {
            displayNames = JSON.parse(existing.display_names_json || '[]');
          } catch (_) {
            displayNames = [];
          }
          if (rec.name && !displayNames.includes(rec.name)) {
            displayNames.push(rec.name);
          }

          db.prepare(`
            UPDATE sender_profiles
            SET sent_to_count = sent_to_count + 1,
                last_sent_at = CASE 
                  WHEN last_sent_at IS NULL OR ? > last_sent_at THEN ? 
                  ELSE last_sent_at 
                END,
                display_names_json = ?
            WHERE id = ? AND user_id = ?
          `).run(
            sentDate,
            sentDate,
            JSON.stringify(displayNames),
            existing.id,
            userId
          );
          updatedCount++;
        }
      }

      processedCount++;
    }

    // Record last sent sync timestamp in settings
    db.prepare(`
      INSERT INTO settings (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `).run(syncSettingKey, new Date().toISOString());

    return {
      success: true,
      processedCount,
      updatedCount
    };
  } catch (err) {
    console.warn('[Sent Mail Sync Notice]', err.message);
    return {
      success: false,
      error: err.message,
      processedCount: 0,
      updatedCount: 0
    };
  }
}
