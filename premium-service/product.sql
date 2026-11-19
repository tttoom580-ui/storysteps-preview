CREATE TABLE IF NOT EXISTS product_admins(account TEXT PRIMARY KEY REFERENCES premium_google_accounts(account));
CREATE TABLE IF NOT EXISTS product_events(id TEXT PRIMARY KEY,client TEXT NOT NULL,kind TEXT NOT NULL,book TEXT NOT NULL,chapter TEXT NOT NULL,variant TEXT NOT NULL,source TEXT NOT NULL,created INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS product_events_client ON product_events(client,created);
CREATE INDEX IF NOT EXISTS product_events_time ON product_events(created,kind,book);
CREATE TABLE IF NOT EXISTS product_feedback(id TEXT PRIMARY KEY,client TEXT NOT NULL,book TEXT NOT NULL,chapter TEXT NOT NULL,kind TEXT NOT NULL,message TEXT NOT NULL,created INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS product_feedback_client ON product_feedback(client,created);
