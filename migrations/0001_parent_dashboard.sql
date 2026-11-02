-- Parent dashboard storage (Cloudflare D1).
-- A "family" is identified by a random secret held by the child's device; only its SHA-256 is stored.
CREATE TABLE IF NOT EXISTS families (
  key             TEXT PRIMARY KEY,           -- sha256('family:' + familyId)
  pin_salt        TEXT NOT NULL,
  pin_hash        TEXT NOT NULL,              -- PBKDF2-SHA256, 100k iterations
  child_name      TEXT,
  grade           INTEGER,
  snapshot        TEXT,                       -- JSON: mastery per topic, meets, active days, review counts
  created_at      INTEGER NOT NULL,
  last_sync       INTEGER,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS attempts (
  family     TEXT NOT NULL,
  ts         INTEGER NOT NULL,                -- ms since epoch, from the device
  problem_id TEXT NOT NULL,                   -- topic:grade:level:seed (regenerates the exact problem)
  topic      TEXT NOT NULL,
  grade      INTEGER NOT NULL,
  level      INTEGER NOT NULL,
  correct    INTEGER NOT NULL,                -- solved in the end
  first_try  INTEGER NOT NULL,                -- solved first try, no hints
  skipped    INTEGER NOT NULL DEFAULT 0,
  hints      INTEGER NOT NULL DEFAULT 0,
  seconds    INTEGER NOT NULL DEFAULT 0,
  answer     TEXT,                            -- first wrong answer, if any
  mode       TEXT NOT NULL DEFAULT 'practice',-- practice | review | meet
  PRIMARY KEY (family, ts, problem_id)
);

CREATE INDEX IF NOT EXISTS attempts_family_ts ON attempts (family, ts);
