CREATE TABLE IF NOT EXISTS premium_learning (
 account TEXT PRIMARY KEY REFERENCES premium_google_accounts(account),
 revision INTEGER NOT NULL DEFAULT 0,
 snapshot TEXT NOT NULL CHECK(json_valid(snapshot)),
 saved_at INTEGER NOT NULL
);
