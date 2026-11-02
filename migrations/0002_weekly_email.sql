-- Weekly progress email (Amazon SES). Applied once; tracked in the _migrations table.
ALTER TABLE families ADD COLUMN email TEXT;
ALTER TABLE families ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0;
ALTER TABLE families ADD COLUMN email_token TEXT;          -- sha256 of the pending confirmation token
ALTER TABLE families ADD COLUMN email_token_expires INTEGER;
ALTER TABLE families ADD COLUMN unsub_token TEXT;          -- random; only allows unsubscribing
ALTER TABLE families ADD COLUMN email_last_week TEXT;      -- week key of the last weekly email sent
ALTER TABLE families ADD COLUMN email_quota TEXT;          -- "YYYY-MM-DD:n", caps confirmation and test emails per day
CREATE INDEX IF NOT EXISTS families_unsub ON families (unsub_token);
CREATE INDEX IF NOT EXISTS families_email_token ON families (email_token);
