CREATE TABLE IF NOT EXISTS sync_accounts (
  id TEXT PRIMARY KEY,
  key_hash TEXT NOT NULL UNIQUE,
  snapshot TEXT NOT NULL DEFAULT '{"version":1,"records":{}}',
  revision INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sync_accounts_updated_at ON sync_accounts(updated_at);
