CREATE TABLE IF NOT EXISTS premium_drive_challenges (
  state TEXT PRIMARY KEY,
  account TEXT NOT NULL REFERENCES premium_google_accounts(account),
  verifier TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS premium_drive_challenges_exp ON premium_drive_challenges(expires_at);
CREATE TABLE IF NOT EXISTS premium_drive_connections (
  account TEXT PRIMARY KEY REFERENCES premium_google_accounts(account),
  refresh_token TEXT,
  file_id TEXT,
  saved_at INTEGER,
  revision INTEGER NOT NULL DEFAULT 0
);
