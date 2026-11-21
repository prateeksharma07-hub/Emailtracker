import crypto from 'node:crypto';
import { db } from '../../db/database.js';
import { parseEmailHeaders } from './headerParser.js';

/**
 * Checks if Sender Trust feature flag is active
 */
export function isSenderTrustEnabled() {
  return process.env.FEATURE_SENDER_TRUST !== 'false';
}

/**
 * Ingests incoming email headers, records email_headers_meta, and updates sender_profiles.
 * 
 * STRICT PRIVACY & SAFETY:
 * - Stores ONLY header metadata (addresses, display names, timestamps, counts, SPF/DKIM/DMARC).
 * - NEVER stores email bodies.
 * - Entire process runs in try/catch to ensure zero disruption to live email sync.
 * 
 * @param {string} emailId - ID of stored email
 * @param {string} userId - ID of authenticated user
 * @param {Array<{ name: string, value: string }>} headers - Gmail API raw headers
 * @returns {object|null} Ingested metadata summary
 */
export function ingestIncomingEmailHeaders(emailId, userId, headers = []) {
  if (!isSenderTrustEnabled()) return null;
  if (!emailId || !userId || !headers || headers.length === 0) return null;

  try {
    const parsed = parseEmailHeaders(headers);
    const { from, replyTo, auth, date } = parsed;

    if (!from || !from.email) return null;

    // 1. Upsert into email_headers_meta (only if email row exists to satisfy foreign key)
    try {
      const emailExists = db.prepare('SELECT id FROM emails WHERE id = ? AND user_id = ?').get(emailId, userId);
      if (emailExists) {
        const metaId = 'ehm_' + crypto.randomUUID();
        db.prepare(`
          INSERT INTO email_headers_meta (
            id, email_id, user_id, from_addr, from_name, reply_to, spf, dkim, dmarc
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(user_id, email_id) DO UPDATE SET
            from_addr = excluded.from_addr,
            from_name = excluded.from_name,
            reply_to = excluded.reply_to,
            spf = excluded.spf,
            dkim = excluded.dkim,
            dmarc = excluded.dmarc
        `).run(
          metaId,
          emailId,
          userId,
          from.email,
          from.name || null,
          replyTo?.email || null,
          auth.spf || 'unknown',
          auth.dkim || 'unknown',
          auth.dmarc || 'unknown'
        );
      }
    } catch (metaErr) {
      console.warn('[Sender Memory Headers Meta Warning]', metaErr.message);
    }

    // 2. Upsert into sender_profiles
    const existingProfile = db.prepare(`
      SELECT * FROM sender_profiles WHERE user_id = ? AND sender_email = ?
    `).get(userId, from.email);

    if (!existingProfile) {
      const profileId = 'snd_' + crypto.randomUUID();
      const displayNames = from.name ? [from.name] : [];
      db.prepare(`
        INSERT INTO sender_profiles (
          id, user_id, sender_email, sender_domain, display_names_json,
          first_seen_at, last_seen_at, received_count, sent_to_count, trust_state, user_set
        ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1, 0, 'unknown', 0)
      `).run(
        profileId,
        userId,
        from.email,
        from.domain,
        JSON.stringify(displayNames)
      );
    } else {
      let displayNames = [];
      try {
        displayNames = JSON.parse(existingProfile.display_names_json || '[]');
      } catch (_) {
        displayNames = [];
      }
      if (from.name && !displayNames.includes(from.name)) {
        displayNames.push(from.name);
      }

      db.prepare(`
        UPDATE sender_profiles
        SET received_count = received_count + 1,
            last_seen_at = CURRENT_TIMESTAMP,
            display_names_json = ?
        WHERE id = ? AND user_id = ?
      `).run(
        JSON.stringify(displayNames),
        existingProfile.id,
        userId
      );
    }

    return {
      emailId,
      from,
      replyTo,
      auth
    };
  } catch (err) {
    console.warn('[Sender Memory Ingestion Warning]', err.message);
    return null;
  }
}
