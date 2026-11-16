-- MAILMIND AI — SQLite Relational Database Schema

-- 1. Connected Gmail Accounts via OAuth 2.0
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  picture TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expiry INTEGER,
  scope TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_synced_at DATETIME
);

-- 2. Synced Emails
CREATE TABLE IF NOT EXISTS emails (
  id TEXT PRIMARY KEY,                       -- Gmail Message ID
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
  is_sensitive INTEGER DEFAULT 0,            -- 1 if OTP, bank account, password, or medical detected
  sensitive_type TEXT,                       -- 'OTP', 'CREDIT_CARD', 'BANKING', 'PASSWORD', 'MEDICAL', 'LEGAL'
  category TEXT DEFAULT 'Other',             -- 'Urgent', 'Work', 'Meeting', 'Task', 'Personal', 'Newsletter', 'Other'
  priority_score INTEGER DEFAULT 3,          -- 1 (Low) to 5 (Critical)
  summary TEXT,
  ai_processed INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

-- Index for high-velocity queries
CREATE INDEX IF NOT EXISTS idx_emails_date ON emails(date_received DESC);
CREATE INDEX IF NOT EXISTS idx_emails_category ON emails(category);
CREATE INDEX IF NOT EXISTS idx_emails_priority ON emails(priority_score);
CREATE INDEX IF NOT EXISTS idx_emails_sensitive ON emails(is_sensitive);

-- 3. Extracted Tasks & Deadlines
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  email_id TEXT NOT NULL,
  task_title TEXT NOT NULL,
  deadline_date TEXT,
  deadline_text TEXT,
  is_completed INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tasks_email ON tasks(email_id);

-- 4. AI-Generated Reply Drafts (Human-in-the-Loop Approval Required)
CREATE TABLE IF NOT EXISTS drafts (
  id TEXT PRIMARY KEY,
  email_id TEXT NOT NULL,
  to_address TEXT NOT NULL,
  subject TEXT NOT NULL,
  reply_body TEXT NOT NULL,
  tone TEXT DEFAULT 'Professional',          -- 'Professional', 'Concise', 'Detailed'
  status TEXT DEFAULT 'PENDING_APPROVAL',    -- 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'REJECTED'
  approved_at DATETIME,
  sent_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_drafts_status ON drafts(status);

-- 5. Safety Audit & Operational Activity Logs
CREATE TABLE IF NOT EXISTS activity_logs (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,                  -- 'OAUTH_CONNECTED', 'SYNC_COMPLETED', 'PII_PROTECTED', 'AI_CLASSIFIED', 'DRAFT_APPROVED', 'EMAIL_SENT'
  severity TEXT DEFAULT 'INFO',              -- 'INFO', 'WARNING', 'SECURITY', 'ERROR'
  message TEXT NOT NULL,
  metadata TEXT,                             -- JSON encoded metadata
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_logs_created ON activity_logs(created_at DESC);

-- 6. User Preferences & Settings
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
