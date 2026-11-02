CREATE TABLE IF NOT EXISTS records (
 key TEXT PRIMARY KEY,
 value TEXT NOT NULL CHECK (json_valid(value)),
 revision TEXT NOT NULL,
 expires_at INTEGER
);
CREATE INDEX IF NOT EXISTS records_expiry ON records(expires_at) WHERE expires_at IS NOT NULL;
