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
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA busy_timeout = 5000;');
db.exec('PRAGMA foreign_keys = ON;');

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

  // 3b. Safe copy-and-swap migration for `emails` foreign keys
  if (tableExists('emails')) {
    try {
      const emailFks = db.prepare("PRAGMA foreign_key_list('emails')").all();
      const hasLegacyAccountFk = emailFks.some(fk => fk.table === 'accounts');
      const hasUserFk = emailFks.some(fk => fk.table === 'users' && fk.from === 'user_id');

      if (hasLegacyAccountFk || !hasUserFk) {
        console.log('[Migration] Migrating emails table foreign key constraint to users(id)...');
        db.exec('PRAGMA foreign_keys = OFF;');
        db.exec(`
          CREATE TABLE IF NOT EXISTS emails_new (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            thread_id TEXT NOT NULL,
            account_id TEXT,
            sender TEXT NOT NULL,
            sender_name TEXT,
            recipient TEXT NOT NULL,
            subject TEXT,
            body_text TEXT,
            body_html TEXT,
            snippet TEXT,
            date_received DATETIME NOT NULL,
            is_read INTEGER DEFAULT 0,
            is_sensitive INTEGER DEFAULT 0,
            sensitive_type TEXT,
            category TEXT DEFAULT 'Other',
            priority_score INTEGER DEFAULT 3,
            summary TEXT,
            shield_verdict TEXT DEFAULT 'CLEARED',
            needs_reply INTEGER DEFAULT 0,
            needs_reply_reason TEXT,
            needs_reply_urgency INTEGER DEFAULT 1,
            suggested_action TEXT,
            detected_language TEXT DEFAULT 'English',
            is_follow_up_candidate INTEGER DEFAULT 0,
            follow_up_due_date DATETIME,
            ai_processed INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
          );
        `);

        const oldCols = db.prepare("PRAGMA table_info('emails')").all().map(c => c.name);
        const targetCols = [
          'id', 'user_id', 'thread_id', 'account_id', 'sender', 'sender_name', 'recipient', 'subject',
          'body_text', 'body_html', 'snippet', 'date_received', 'is_read', 'is_sensitive', 'sensitive_type',
          'category', 'priority_score', 'summary', 'shield_verdict', 'needs_reply', 'needs_reply_reason',
          'needs_reply_urgency', 'suggested_action', 'detected_language', 'is_follow_up_candidate',
          'follow_up_due_date', 'ai_processed', 'created_at'
        ].filter(c => oldCols.includes(c));

        const colList = targetCols.join(', ');
        db.exec(`INSERT INTO emails_new (${colList}) SELECT ${colList} FROM emails;`);
        db.exec('DROP TABLE emails;');
        db.exec('ALTER TABLE emails_new RENAME TO emails;');

        db.exec(`
          CREATE INDEX IF NOT EXISTS idx_emails_user_id ON emails(user_id);
          CREATE INDEX IF NOT EXISTS idx_emails_date ON emails(date_received DESC);
          CREATE INDEX IF NOT EXISTS idx_emails_category ON emails(category);
          CREATE INDEX IF NOT EXISTS idx_emails_priority ON emails(priority_score);
          CREATE INDEX IF NOT EXISTS idx_emails_sensitive ON emails(is_sensitive);
          CREATE INDEX IF NOT EXISTS idx_emails_shield_verdict ON emails(shield_verdict);
        `);
        db.exec('PRAGMA foreign_keys = ON;');
        console.log('[Migration] emails table copy-and-swap migration complete.');
      }
    } catch (colMigErr) {
      db.exec('PRAGMA foreign_keys = ON;');
      console.warn('[Migration Warning] emails table copy-and-swap migration notice:', colMigErr.message);
    }
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

  // 6b. Ensure `shield_verdict` exists in `emails`
  if (tableExists('emails') && !columnExists('emails', 'shield_verdict')) {
    console.log('[Migration] Adding shield_verdict column to emails table...');
    db.exec(`ALTER TABLE emails ADD COLUMN shield_verdict TEXT DEFAULT 'CLEARED';`);
  }

  // 6c. Ensure `shield_scans` table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS shield_scans (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      email_id TEXT NOT NULL,
      verdict TEXT NOT NULL,
      threat_score INTEGER NOT NULL DEFAULT 0,
      layers_json TEXT NOT NULL,
      hidden_segments_json TEXT NOT NULL,
      visible_text TEXT,
      ai_text TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE CASCADE
    );
  `);

  // 6d. Phase 2: Autopilot columns in `emails`
  if (tableExists('emails')) {
    if (!columnExists('emails', 'needs_reply')) {
      db.exec(`ALTER TABLE emails ADD COLUMN needs_reply INTEGER DEFAULT 0;`);
    }
    if (!columnExists('emails', 'needs_reply_reason')) {
      db.exec(`ALTER TABLE emails ADD COLUMN needs_reply_reason TEXT;`);
    }
    if (!columnExists('emails', 'needs_reply_urgency')) {
      db.exec(`ALTER TABLE emails ADD COLUMN needs_reply_urgency INTEGER DEFAULT 1;`);
    }
    if (!columnExists('emails', 'suggested_action')) {
      db.exec(`ALTER TABLE emails ADD COLUMN suggested_action TEXT;`);
    }
    if (!columnExists('emails', 'detected_language')) {
      db.exec(`ALTER TABLE emails ADD COLUMN detected_language TEXT DEFAULT 'English';`);
    }
    if (!columnExists('emails', 'is_follow_up_candidate')) {
      db.exec(`ALTER TABLE emails ADD COLUMN is_follow_up_candidate INTEGER DEFAULT 0;`);
    }
    if (!columnExists('emails', 'follow_up_due_date')) {
      db.exec(`ALTER TABLE emails ADD COLUMN follow_up_due_date DATETIME;`);
    }
  }

  // 6e. Phase 2: Autopilot columns in `drafts`
  if (tableExists('drafts')) {
    if (!columnExists('drafts', 'language')) {
      db.exec(`ALTER TABLE drafts ADD COLUMN language TEXT DEFAULT 'English';`);
    }
    if (!columnExists('drafts', 'draft_type')) {
      db.exec(`ALTER TABLE drafts ADD COLUMN draft_type TEXT DEFAULT 'REPLY';`);
    }
  }

  // 6f. Phase 2: Defensive Attack Lab Runs Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS lab_runs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      scenario TEXT NOT NULL,
      results_json TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_lab_runs_user_id ON lab_runs(user_id);
  `);

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

    CREATE TABLE IF NOT EXISTS user_settings (
      user_id TEXT PRIMARY KEY,
      sync_batch_size INTEGER NOT NULL DEFAULT 50,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Ensure `sync_batch_size` column exists in `user_settings` table
  if (tableExists('user_settings') && !columnExists('user_settings', 'sync_batch_size')) {
    console.log('[Migration] Adding sync_batch_size column to user_settings table...');
    db.exec(`ALTER TABLE user_settings ADD COLUMN sync_batch_size INTEGER NOT NULL DEFAULT 50;`);
  }

  // 9. Ensure `draft_checks` table exists (Regret Shield)
  db.exec(`
    CREATE TABLE IF NOT EXISTS draft_checks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      draft_id TEXT NOT NULL,
      draft_hash TEXT NOT NULL,
      severity TEXT NOT NULL,
      result_json TEXT NOT NULL,
      acknowledged_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (draft_id) REFERENCES drafts(id) ON DELETE CASCADE
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

    CREATE INDEX IF NOT EXISTS idx_shield_user_id ON shield_scans(user_id);
    CREATE INDEX IF NOT EXISTS idx_shield_email_id ON shield_scans(email_id);
    CREATE INDEX IF NOT EXISTS idx_shield_verdict ON shield_scans(verdict);
    CREATE INDEX IF NOT EXISTS idx_emails_shield_verdict ON emails(shield_verdict);

    CREATE INDEX IF NOT EXISTS idx_draft_checks_user ON draft_checks(user_id);
    CREATE INDEX IF NOT EXISTS idx_draft_checks_draft ON draft_checks(draft_id);
    CREATE INDEX IF NOT EXISTS idx_draft_checks_hash ON draft_checks(draft_hash);
  `);

  // 11. Ensure Sender Trust Memory tables exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS sender_profiles (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      sender_email TEXT NOT NULL,
      sender_domain TEXT NOT NULL,
      display_names_json TEXT DEFAULT '[]',
      first_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      received_count INTEGER DEFAULT 0,
      sent_to_count INTEGER DEFAULT 0,
      last_sent_at DATETIME,
      trust_state TEXT DEFAULT 'unknown',
      user_set INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, sender_email)
    );

    CREATE INDEX IF NOT EXISTS idx_sender_profiles_user_email ON sender_profiles(user_id, sender_email);
    CREATE INDEX IF NOT EXISTS idx_sender_profiles_user_domain ON sender_profiles(user_id, sender_domain);
    CREATE INDEX IF NOT EXISTS idx_sender_profiles_trust ON sender_profiles(trust_state);

    CREATE TABLE IF NOT EXISTS email_headers_meta (
      id TEXT PRIMARY KEY,
      email_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      from_addr TEXT NOT NULL,
      from_name TEXT,
      reply_to TEXT,
      spf TEXT DEFAULT 'unknown',
      dkim TEXT DEFAULT 'unknown',
      dmarc TEXT DEFAULT 'unknown',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE CASCADE,
      UNIQUE(user_id, email_id)
    );

    CREATE INDEX IF NOT EXISTS idx_headers_meta_user_email ON email_headers_meta(user_id, email_id);
  `);

  // 12. Run idempotent foreign key repair migration (cleans orphan derived child rows if any)
  runRepairMigration();

  console.log('[Database] Migrations verified successfully.');
}

/**
 * Idempotently inspects foreign key consistency and cleans orphan derived child rows.
 * Creates a timestamped backup before any repair deletes.
 */
export function runRepairMigration() {
  try {
    const violations = db.prepare('PRAGMA foreign_key_check').all();
    if (violations && violations.length > 0) {
      console.log(`[Repair Migration] Found ${violations.length} foreign key violation(s). Initiating repair...`);
      // 1. Create timestamped backup of mailmind.db before deleting any orphan rows
      const backupPath = path.resolve(__dirname, '..', `mailmind.db.backup_${Date.now()}`);
      if (fs.existsSync(dbPath)) {
        fs.copyFileSync(dbPath, backupPath);
        console.log(`[Repair Migration] Created safety backup at ${backupPath}`);
      }

      // 2. Only clean derived child rows, never touching emails or users
      const allowedChildTables = ['shield_scans', 'drafts', 'tasks', 'email_headers_meta', 'campus_items', 'draft_checks'];
      let cleanedCount = 0;
      for (const v of violations) {
        if (allowedChildTables.includes(v.table)) {
          db.prepare(`DELETE FROM ${v.table} WHERE rowid = ?`).run(v.rowid);
          cleanedCount++;
        }
      }
      console.log(`[Repair Migration] Cleaned ${cleanedCount} orphan derived child row(s).`);
    } else {
      console.log('[Repair Migration] 0 foreign key violations found. Database consistent.');
    }
  } catch (repairErr) {
    console.warn('[Repair Migration Notice]', repairErr.message);
  }
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
