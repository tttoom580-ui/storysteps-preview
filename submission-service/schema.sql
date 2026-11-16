CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  email TEXT,
  manuscript TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined'))
);
CREATE INDEX IF NOT EXISTS submissions_created_at ON submissions(created_at);
