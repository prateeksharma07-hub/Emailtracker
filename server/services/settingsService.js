import { db } from '../db/database.js';
import { 
  ALLOWED_BATCH_SIZES, 
  DEFAULT_BATCH_SIZE, 
  isValidBatchSize 
} from '../config/syncConstants.js';

/**
 * Retrieves settings for a specific user, defaulting if not yet stored
 * 
 * @param {string} userId 
 * @returns {object} { syncBatchSize, allowedBatchSizes, defaultBatchSize }
 */
export function getUserSettings(userId) {
  if (!userId) {
    return {
      syncBatchSize: DEFAULT_BATCH_SIZE,
      allowedBatchSizes: ALLOWED_BATCH_SIZES,
      defaultBatchSize: DEFAULT_BATCH_SIZE
    };
  }

  const row = db.prepare(`
    SELECT sync_batch_size 
    FROM user_settings 
    WHERE user_id = ?
  `).get(userId);

  const syncBatchSize = row && isValidBatchSize(row.sync_batch_size)
    ? row.sync_batch_size
    : DEFAULT_BATCH_SIZE;

  return {
    syncBatchSize,
    allowedBatchSizes: ALLOWED_BATCH_SIZES,
    defaultBatchSize: DEFAULT_BATCH_SIZE
  };
}

/**
 * Updates settings for a specific user with validation
 * 
 * @param {string} userId 
 * @param {object} updates - { syncBatchSize }
 * @returns {object} Updated settings
 */
export function updateUserSettings(userId, updates = {}) {
  if (!userId) {
    const err = new Error('User ID is required');
    err.status = 400;
    throw err;
  }

  if (updates.syncBatchSize !== undefined) {
    if (!isValidBatchSize(updates.syncBatchSize)) {
      const err = new Error(`Invalid batch size. Allowed values: ${ALLOWED_BATCH_SIZES.join(', ')}`);
      err.status = 400;
      throw err;
    }

    const batchSize = Number(updates.syncBatchSize);
    db.prepare(`
      INSERT INTO user_settings (user_id, sync_batch_size, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO UPDATE SET
        sync_batch_size = excluded.sync_batch_size,
        updated_at = CURRENT_TIMESTAMP
    `).run(userId, batchSize);
  }

  return getUserSettings(userId);
}
