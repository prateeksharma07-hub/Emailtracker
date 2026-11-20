import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { encryptToken } from '../services/cryptoService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure .env is loaded for encryption key
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

// Database file path
const dbPath = path.resolve(__dirname, '..', 'mailmind.db');

export const db = new DatabaseSync(dbPath);

/**
 * Checks if a column exists in a given SQLite table
 */
function columnExists(tableName, columnName) {
  try {
    const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
    return columns.some(col => col.name === columnName);
  } catch (err) {
    return false;
  }
}

/**
 * Checks if a table exists in the SQLite database
 */
function tableExists(tableName) {
  try {
    const row = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name = ?`).get(tableName);
    return Boolean(row);
  } catch (err) {
    return false;
  }
}

/**
 * Runs multi-user database migrations safely
 */
function runMigrations() {
  console.log('[Database] Checking schema migrations...');

  // 1. Ensure `users` table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      google_id TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      picture TEXT,
      access_token_enc TEXT,
      refresh_token_enc TEXT,
      token_expiry INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_sync_at DATETIME
    );
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
  `);

  // 2. Ensure `sessions` table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
  `);

  // 3. Ensure `user_id` exists in `emails`
  if (tableExists('emails') && !columnExists('emails', 'user_id')) {
    console.log('[Migration] Adding user_id column to emails table...');
    db.exec(`ALTER TABLE emails ADD COLUMN user_id TEXT;`);
  }

  // 4. Ensure `user_id` exists in `tasks`
  if (tableExists('tasks') && !columnExists('tasks', 'user_id')) {
    console.log('[Migration] Adding user_id column to tasks table...');
    db.exec(`ALTER TABLE tasks ADD COLUMN user_id TEXT;`);
  }

  // 5. Ensure `user_id` exists in `drafts`
  if (tableExists('drafts') && !columnExists('drafts', 'user_id')) {
    console.log('[Migration] Adding user_id column to drafts table...');
    db.exec(`ALTER TABLE drafts ADD COLUMN user_id TEXT;`);
  }

  // 6. Ensure `user_id` exists in `activity_logs`
  if (tableExists('activity_logs') && !columnExists('activity_logs', 'user_id')) {
    console.log('[Migration] Adding user_id column to activity_logs table...');
    db.exec(`ALTER TABLE activity_logs ADD COLUMN user_id TEXT;`);
  }

  // 7. Ensure `oauth_states` table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS oauth_states (
      state TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL
    );
  `);

  // 8. Ensure `settings` table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 9. Migrate legacy `accounts` data into `users` if present
  if (tableExists('accounts')) {
    try {
      const accounts = db.prepare('SELECT * FROM accounts').all();
      for (const acc of accounts) {
        if (!acc.email) continue;

        let existingUser = db.prepare('SELECT * FROM users WHERE email = ?').get(acc.email);
        if (!existingUser) {
          const userId = 'usr_' + crypto.randomBytes(8).toString('hex');
          const googleId = acc.id && acc.id !== 'demo_account' ? acc.id : 'gid_' + crypto.randomBytes(8).toString('hex');
          const encAccess = acc.access_token ? encryptToken(acc.access_token) : null;
          const encRefresh = acc.refresh_token ? encryptToken(acc.refresh_token) : null;

          db.prepare(`
            INSERT INTO users (id, google_id, email, name, picture, access_token_enc, refresh_token_enc, token_expiry, created_at, last_sync_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            userId,
            googleId,
            acc.email,
            acc.name || acc.email.split('@')[0],
            acc.picture || null,
            encAccess,
            encRefresh,
            acc.token_expiry || null,
            acc.created_at || new Date().toISOString(),
            acc.last_synced_at || null
          );

          existingUser = { id: userId };
          console.log(`[Migration] Migrated legacy account ${acc.email} to user ID: ${userId}`);
        }

        if (existingUser?.id) {
          // Backfill user_id on emails, tasks, drafts, logs
          db.prepare("UPDATE emails SET user_id = ? WHERE (user_id IS NULL OR user_id = '') AND account_id = ?").run(existingUser.id, acc.id);
          db.prepare("UPDATE emails SET user_id = ? WHERE (user_id IS NULL OR user_id = '')").run(existingUser.id);
          db.prepare(`
            UPDATE tasks 
            SET user_id = ? 
            WHERE (user_id IS NULL OR user_id = '') 
              AND email_id IN (SELECT id FROM emails WHERE user_id = ?)
          `).run(existingUser.id, existingUser.id);
          db.prepare(`
            UPDATE drafts 
            SET user_id = ? 
            WHERE (user_id IS NULL OR user_id = '') 
              AND email_id IN (SELECT id FROM emails WHERE user_id = ?)
          `).run(existingUser.id, existingUser.id);
          db.prepare("UPDATE activity_logs SET user_id = ? WHERE (user_id IS NULL OR user_id = '')").run(existingUser.id);
        }
      }
    } catch (migErr) {
      console.warn('[Migration Note] Legacy account migration warning:', migErr.message);
    }
  }

  // 10. Create indexes on user_id and existing columns
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_emails_user_id ON emails(user_id);
    CREATE INDEX IF NOT EXISTS idx_emails_date ON emails(date_received DESC);
    CREATE INDEX IF NOT EXISTS idx_emails_category ON emails(category);
    CREATE INDEX IF NOT EXISTS idx_emails_priority ON emails(priority_score);
    CREATE INDEX IF NOT EXISTS idx_emails_sensitive ON emails(is_sensitive);

    CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_email ON tasks(email_id);

    CREATE INDEX IF NOT EXISTS idx_drafts_user_id ON drafts(user_id);
    CREATE INDEX IF NOT EXISTS idx_drafts_status ON drafts(status);

    CREATE INDEX IF NOT EXISTS idx_logs_user_id ON activity_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_logs_created ON activity_logs(created_at DESC);
  `);

  console.log('[Database] Migrations verified successfully.');
}

/**
 * Initializes the SQLite database schema
 */
export function initDb() {
  try {
    const schemaPath = path.resolve(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    // Execute schema statements
    db.exec(schemaSql);
    runMigrations();
    console.log(`[Database] SQLite connected & schema initialized at ${dbPath}`);

    // Insert initial activity log if table is empty
    const checkLog = db.prepare('SELECT COUNT(*) as count FROM activity_logs').get();
    if (checkLog.count === 0) {
      const logInsert = db.prepare(`
        INSERT INTO activity_logs (id, event_type, severity, message, metadata)
        VALUES (?, ?, ?, ?, ?)
      `);
      logInsert.run(
        'log_' + Date.now(),
        'SYSTEM_INITIALIZED',
        'INFO',
        'MAILMIND AI multi-user database initialized with zero-retention privacy protocols.',
        JSON.stringify({ engine: 'node:sqlite', multiUser: true, version: '2.0.0' })
      );
    }
  } catch (err) {
    console.error('[Database Error] Failed to initialize SQLite schema:', err);
    throw err;
  }
}

export default db;
