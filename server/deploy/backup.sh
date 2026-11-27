#!/usr/bin/env bash
# ==============================================================================
# MailMind AI — Automated SQLite Backup Script for Oracle Cloud VM
# ==============================================================================
set -euo pipefail

# Configuration
APP_DIR="${APP_DIR:-/opt/mailmind/server}"
DB_PATH="${DB_PATH:-$APP_DIR/mailmind.db}"
BACKUP_DIR="${BACKUP_DIR:-$APP_DIR/backups}"
RETENTION_DAYS=14
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/mailmind_backup_${TIMESTAMP}.db"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting SQLite backup..."

if [ ! -f "$DB_PATH" ]; then
    echo "Error: Database file does not exist at $DB_PATH" >&2
    exit 1
fi

# 1. Perform clean online backup using sqlite3 CLI (safely checkpoints WAL without locking writers)
if command -v sqlite3 >/dev/null 2>&1; then
    sqlite3 "$DB_PATH" ".backup '$BACKUP_FILE'"
else
    # Fallback copy if sqlite3 CLI is not installed
    cp "$DB_PATH" "$BACKUP_FILE"
fi

# 2. Compress backup to save disk space
gzip -f "$BACKUP_FILE"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup successfully created: ${BACKUP_FILE}.gz"

# 3. Prune old backups older than $RETENTION_DAYS days
find "$BACKUP_DIR" -name "mailmind_backup_*.db.gz" -type f -mtime +"$RETENTION_DAYS" -delete
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Pruned backups older than $RETENTION_DAYS days."

# 4. Show current backup list and disk usage
ls -lh "$BACKUP_DIR"/mailmind_backup_*.db.gz | tail -n 5
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup routine finished successfully."
