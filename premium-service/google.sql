CREATE TABLE IF NOT EXISTS premium_google_accounts (
  account TEXT PRIMARY KEY REFERENCES premium_accounts(id),
  email TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS premium_google_sessions (
  token_hash TEXT PRIMARY KEY,
  account TEXT NOT NULL REFERENCES premium_google_accounts(account),
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS premium_google_sessions_exp ON premium_google_sessions(expires_at);
CREATE TABLE IF NOT EXISTS premium_google_challenges (
  proof_hash TEXT PRIMARY KEY,
  nonce TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS premium_google_challenges_exp ON premium_google_challenges(expires_at);
CREATE INDEX IF NOT EXISTS premium_legacy_mail_queue ON premium_orders(paid_at)
 WHERE mailed_at IS NULL AND (account IS NULL OR substr(account,1,7)<>'google:');

CREATE TABLE IF NOT EXISTS premium_full_library_grants (
  account TEXT PRIMARY KEY REFERENCES premium_google_accounts(account),
  granted_at INTEGER NOT NULL
);
