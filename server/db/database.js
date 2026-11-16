import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database file path
const dbPath = path.resolve(__dirname, '..', 'mailmind.db');

export const db = new DatabaseSync(dbPath);

/**
 * Initializes the SQLite database schema
 */
export function initDb() {
  try {
    // Enable Write-Ahead Logging for high concurrency and zero locking
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA synchronous = NORMAL;');

    const schemaPath = path.resolve(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    // Execute schema statements
    db.exec(schemaSql);
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
        'MAILMIND AI local database initialized with zero-retention privacy protocols.',
        JSON.stringify({ engine: 'node:sqlite', version: '1.0.0' })
      );
    }
  } catch (err) {
    console.error('[Database Error] Failed to initialize SQLite schema:', err);
    throw err;
  }
}

export default db;
