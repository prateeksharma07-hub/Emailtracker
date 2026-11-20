import crypto from 'node:crypto';

/**
 * Derives a 32-byte Buffer from the environment variable TOKEN_ENC_KEY.
 * Falls back to a deterministic SHA-256 hash if key length is irregular.
 */
function getEncryptionKey() {
  const rawKey = process.env.TOKEN_ENC_KEY;
  if (!rawKey) {
    console.warn('[Crypto] WARNING: TOKEN_ENC_KEY not set in environment. Falling back to default system key.');
    return crypto.createHash('sha256').update('mailmind-default-insecure-key-change-me').digest();
  }

  // 64 hex characters = 32 bytes
  if (rawKey.length === 64 && /^[0-9a-fA-F]+$/.test(rawKey)) {
    return Buffer.from(rawKey, 'hex');
  }

  // Otherwise hash whatever string is provided to ensure exactly 32 bytes
  return crypto.createHash('sha256').update(rawKey).digest();
}

/**
 * Encrypts a plaintext string (e.g. OAuth token) using AES-256-GCM.
 * Format: iv_hex:auth_tag_hex:ciphertext_hex
 * 
 * @param {string|null} text 
 * @returns {string|null} Encrypted string or null
 */
export function encryptToken(text) {
  if (!text || typeof text !== 'string') return null;

  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  } catch (err) {
    console.error('[Crypto Error] Failed to encrypt token:', err.message);
    throw new Error('Token encryption failed.');
  }
}

/**
 * Decrypts an AES-256-GCM encrypted string back to plaintext.
 * 
 * @param {string|null} encryptedPayload 
 * @returns {string|null} Plaintext token or null
 */
export function decryptToken(encryptedPayload) {
  if (!encryptedPayload || typeof encryptedPayload !== 'string') return null;

  const parts = encryptedPayload.split(':');
  if (parts.length !== 3) {
    // Legacy or unencrypted token fallback check
    return null;
  }

  try {
    const [ivHex, authTagHex, cipherHex] = parts;
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(cipherHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (err) {
    console.error('[Crypto Error] Failed to decrypt token (authentication tag mismatch or invalid key):', err.message);
    return null;
  }
}
