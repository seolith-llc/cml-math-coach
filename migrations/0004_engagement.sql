-- Engagement: parent email preferences, inactivity nudges, device push reminders.
ALTER TABLE families ADD COLUMN email_weekly INTEGER NOT NULL DEFAULT 1;   -- Sunday summary on/off
ALTER TABLE families ADD COLUMN email_nudges INTEGER NOT NULL DEFAULT 1;   -- "a quick round today?" on/off
ALTER TABLE families ADD COLUMN nudges_sent INTEGER NOT NULL DEFAULT 0;    -- in the current break; reset by new practice
ALTER TABLE families ADD COLUMN nudged_day TEXT;                           -- local day of the last nudge

CREATE TABLE IF NOT EXISTS push_subs (
  id              TEXT PRIMARY KEY,          -- sha256 of the endpoint
  endpoint        TEXT NOT NULL,
  p256dh          TEXT NOT NULL,
  auth            TEXT NOT NULL,
  tz              TEXT NOT NULL,             -- IANA time zone of the device
  hour            INTEGER NOT NULL,          -- local hour for the reminder
  name            TEXT,
  goal            INTEGER NOT NULL DEFAULT 10,
  last_active_day TEXT,                      -- local day of the last practice
  last_sent_day   TEXT,
  failures        INTEGER NOT NULL DEFAULT 0,
  created_at      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL);  -- server-generated VAPID key pair
