-- step078: accounts, invite-only (docs/REDESIGN.md §3). Logic in server/accounts.ts.
-- Adults only: a child never has a row here. Tokens are stored hashed (sha256), never as sent.

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,                 -- random
  email         TEXT NOT NULL UNIQUE,             -- lower-case
  status        TEXT NOT NULL CHECK (status IN ('pending', 'active', 'denied', 'suspended')),
  is_admin      INTEGER NOT NULL DEFAULT 0,       -- super admin (ADMIN_EMAILS)
  invited_by    TEXT,                             -- users.id of the inviter (the invite tree)
  invites_left  INTEGER NOT NULL DEFAULT 3,       -- "another family" invites this person may still create
  terms_version TEXT,                             -- content/legal.ts TERMS_VERSION last accepted
  terms_at      INTEGER,                          -- when (ms); due again after 30 days
  created_at    INTEGER NOT NULL,
  last_seen     INTEGER
);

CREATE TABLE IF NOT EXISTS households (
  id         TEXT PRIMARY KEY,
  owner      TEXT NOT NULL,                       -- users.id
  family_key TEXT,                                -- families.key of the child's synced device (parent dashboard), once linked
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS members (
  household  TEXT NOT NULL,
  user       TEXT NOT NULL,
  role       TEXT NOT NULL CHECK (role IN ('owner', 'coparent', 'viewer')),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (household, user)
);
CREATE INDEX IF NOT EXISTS members_user ON members (user);

CREATE TABLE IF NOT EXISTS invites (
  id          TEXT PRIMARY KEY,                   -- sha256 of the link token
  kind        TEXT NOT NULL CHECK (kind IN ('family', 'join')),
  household   TEXT,                               -- join: the household to join
  role        TEXT,                               -- join: coparent | viewer
  created_by  TEXT NOT NULL,                      -- users.id
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  used_by     TEXT,
  used_at     INTEGER,
  revoked     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS invites_creator ON invites (created_by);

-- One-time email links: sign-in, and approve/deny for an inviter or admin.
CREATE TABLE IF NOT EXISTS auth_tokens (
  hash       TEXT PRIMARY KEY,
  purpose    TEXT NOT NULL CHECK (purpose IN ('signin', 'approve')),
  user       TEXT NOT NULL,                       -- signin: who signs in; approve: who is being approved
  actor      TEXT,                                -- approve: who may decide (users.id)
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at    INTEGER
);
CREATE INDEX IF NOT EXISTS auth_tokens_user ON auth_tokens (user, purpose);

CREATE TABLE IF NOT EXISTS sessions (
  hash       TEXT PRIMARY KEY,                    -- sha256 of the cookie value
  user       TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL                     -- slides forward on use (30 days)
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions (user);

-- A new family waiting for its inviter (or, after 72 hours, the super admin) to approve.
CREATE TABLE IF NOT EXISTS approvals (
  user         TEXT PRIMARY KEY,
  approver     TEXT NOT NULL,                     -- the inviter (users.id)
  created_at   INTEGER NOT NULL,
  escalated_at INTEGER,                           -- when it went to the super admin
  decided_at   INTEGER,
  decision     TEXT CHECK (decision IN ('approved', 'denied')),
  decided_by   TEXT
);
