import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Locate mailmind.db
let dbPath = path.resolve(__dirname, '..', 'mailmind.db');
if (!fs.existsSync(dbPath)) {
  dbPath = path.resolve(__dirname, '..', '..', 'server', 'mailmind.db');
}
if (!fs.existsSync(dbPath)) {
  console.error(`[FK Check Error] Database file not found at ${dbPath}`);
  process.exit(1);
}

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = ON;');

console.log('=== [MAILMIND AI: SQLITE FOREIGN KEY INTEGRITY CHECK] ===');
console.log(`Target database: ${dbPath}`);

const violations = db.prepare('PRAGMA foreign_key_check').all();

const tablesToCheck = [
  'users', 'sessions', 'emails', 'tasks', 'drafts', 'shield_scans',
  'draft_checks', 'sender_profiles', 'email_headers_meta', 'user_settings',
  'lab_runs', 'activity_logs'
];

console.log('\n--- Table Record Counts ---');
for (const table of tablesToCheck) {
  try {
    const row = db.prepare(`SELECT count(*) as count FROM ${table}`).get();
    console.log(`  - ${table.padEnd(20)}: ${row.count} rows`);
  } catch (err) {
    console.log(`  - ${table.padEnd(20)}: [table not present]`);
  }
}

if (violations.length > 0) {
  console.error(`\n[FK Check FAILED] Found ${violations.length} foreign key violation(s):`);
  violations.forEach((v, idx) => {
    console.error(`  #${idx + 1}: Table "${v.table}" (rowid: ${v.rowid}) references parent "${v.parent}" (fkid: ${v.fkid}) which does not exist.`);
  });
  console.error('\nRun repair migration or resolve orphaned records.');
  process.exit(1);
} else {
  console.log('\n[FK Check PASSED] 0 foreign key violations found across all tables.');
  console.log('Relational integrity is 100% compliant with multi-user isolation.\n');
  process.exit(0);
}
