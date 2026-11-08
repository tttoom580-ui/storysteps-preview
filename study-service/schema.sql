CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY, client TEXT NOT NULL, kind TEXT NOT NULL, book TEXT NOT NULL, chapter TEXT NOT NULL, created INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS events_client_time ON events(client,created);
CREATE INDEX IF NOT EXISTS events_time_kind ON events(created,kind,book);
CREATE TABLE IF NOT EXISTS feedback(id TEXT PRIMARY KEY, client TEXT NOT NULL, book TEXT NOT NULL, chapter TEXT NOT NULL, paragraph INTEGER NOT NULL, kind TEXT NOT NULL, message TEXT NOT NULL, created INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS feedback_client_time ON feedback(client,created);
