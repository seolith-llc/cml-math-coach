-- step080: a 6-digit sign-in code in every sign-in email, for the iPad Home Screen app (its storage is separate
-- from Safari's, so a link opened from Mail signs in Safari, not the app). Hashed; 15 minutes; 5 tries.
CREATE TABLE IF NOT EXISTS signin_codes (
  user       TEXT PRIMARY KEY,                    -- one live code per person (a new email replaces it)
  code_hash  TEXT NOT NULL,                       -- sha256(user id + ':' + code)
  expires_at INTEGER NOT NULL,
  tries      INTEGER NOT NULL DEFAULT 0
);
