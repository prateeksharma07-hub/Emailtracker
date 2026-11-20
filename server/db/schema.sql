-- MAILMIND AI — SQLite Relational Database Schema (Multi-User SaaS)

-- 1. Users Table (Multi-User Accounts)
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

-- 2. Sessions Table (Cookie-based Sessions)
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- 3. Synced Emails (Per-User Isolated)
CREATE TABLE IF NOT EXISTS emails (
  id TEXT PRIMARY KEY,                       -- Gmail Message ID
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
  is_sensitive INTEGER DEFAULT 0,            -- 1 if OTP, bank account, password, or medical detected
  sensitive_type TEXT,                       -- 'OTP', 'CREDIT_CARD', 'BANKING', 'PASSWORD', 'MEDICAL', 'LEGAL'
  category TEXT DEFAULT 'Other',             -- 'Urgent', 'Work', 'Meeting', 'Task', 'Personal', 'Newsletter', 'Other'
  priority_score INTEGER DEFAULT 3,          -- 1 (Low) to 5 (Critical)
  summary TEXT,
  ai_processed INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 4. Extracted Tasks & Deadlines (Per-User Isolated)
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  email_id TEXT NOT NULL,
  task_title TEXT NOT NULL,
  deadline_date TEXT,
  deadline_text TEXT,
  is_completed INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE CASCADE
);

-- 5. AI-Generated Reply Drafts (Human-in-the-Loop Approval Required, Per-User)
CREATE TABLE IF NOT EXISTS drafts (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  email_id TEXT NOT NULL,
  to_address TEXT NOT NULL,
  subject TEXT NOT NULL,
  reply_body TEXT NOT NULL,
  tone TEXT DEFAULT 'Professional',          -- 'Professional', 'Concise', 'Detailed'
  status TEXT DEFAULT 'PENDING_APPROVAL',    -- 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'REJECTED'
  approved_at DATETIME,
  sent_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE CASCADE
);

-- 6. Safety Audit & Operational Activity Logs (Per-User Isolated)
CREATE TABLE IF NOT EXISTS activity_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  event_type TEXT NOT NULL,                  -- 'OAUTH_CONNECTED', 'SYNC_COMPLETED', 'PII_PROTECTED', 'AI_CLASSIFIED', 'DRAFT_APPROVED', 'EMAIL_SENT'
  severity TEXT DEFAULT 'INFO',              -- 'INFO', 'WARNING', 'SECURITY', 'ERROR'
  message TEXT NOT NULL,
  metadata TEXT,                             -- JSON encoded metadata
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 7. User Preferences & Settings
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 8. OAuth 2.0 CSRF Protection States
CREATE TABLE IF NOT EXISTS oauth_states (
  state TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL
);
