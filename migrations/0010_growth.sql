-- step085 (phase 5): invites that grow with practice. When the last extra family invite was given.
ALTER TABLE users ADD COLUMN invites_granted_at INTEGER;
