-- step080: moving to the new address. The old address puts a device's progress here under a one-time code,
-- the new address takes it (and the row is deleted). Rows expire after 30 minutes (deleted hourly).
CREATE TABLE IF NOT EXISTS handoffs (
  code_hash  TEXT PRIMARY KEY,
  state      TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
