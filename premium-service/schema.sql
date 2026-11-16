CREATE TABLE IF NOT EXISTS premium_catalog (
  id INTEGER PRIMARY KEY CHECK(id=1),
  books TEXT NOT NULL CHECK(json_valid(books)),
  amount INTEGER NOT NULL CHECK(amount>0),
  paid_chapters INTEGER NOT NULL CHECK(paid_chapters>0)
);
CREATE TABLE IF NOT EXISTS premium_chapters (
  book TEXT NOT NULL,
  id TEXT NOT NULL,
  body TEXT NOT NULL CHECK(json_valid(body)),
  PRIMARY KEY(book,id)
);
CREATE TABLE IF NOT EXISTS premium_accounts (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS premium_orders (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  amount INTEGER NOT NULL,
  books TEXT NOT NULL CHECK(json_valid(books)),
  created_at INTEGER NOT NULL,
  trade_no TEXT UNIQUE,
  paid_at INTEGER,
  mailed_at INTEGER,
  account TEXT REFERENCES premium_accounts(id),
  revoked_at INTEGER
);
CREATE INDEX IF NOT EXISTS premium_orders_account ON premium_orders(account);
CREATE INDEX IF NOT EXISTS premium_mail_queue ON premium_orders(paid_at) WHERE mailed_at IS NULL;
