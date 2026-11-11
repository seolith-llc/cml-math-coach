-- Feedback and suggestions sent from the app's Feedback button, triaged with the "Feedback" workflow.
-- Kept in D1 (private), not GitHub issues: this repository is public and messages can mention a child.
CREATE TABLE IF NOT EXISTS user_feedback (
  id         TEXT PRIMARY KEY,               -- "fb_" + random, shown in the email and the workflow
  ts         INTEGER NOT NULL,
  kind       TEXT NOT NULL CHECK (kind IN ('problem', 'idea')),
  message    TEXT NOT NULL,
  route      TEXT NOT NULL DEFAULT '',       -- the screen it was sent from, e.g. #/practice
  problem_id TEXT,                           -- the problem on screen, if any (topic:grade:level:seed)
  grade      INTEGER,
  device     TEXT NOT NULL DEFAULT '',       -- browser user agent, cut to 200 characters
  device_id  TEXT NOT NULL,                  -- random per install, only for rate limiting
  status     TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'triaged', 'done', 'wontfix')),
  note       TEXT NOT NULL DEFAULT '',       -- the owner's triage note
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS user_feedback_ts ON user_feedback (ts);
CREATE INDEX IF NOT EXISTS user_feedback_device ON user_feedback (device_id, ts);
CREATE INDEX IF NOT EXISTS user_feedback_status ON user_feedback (status, ts);
