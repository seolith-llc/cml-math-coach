-- Every email the app tries to send (confirmation, test, weekly), for troubleshooting. Addresses are not stored here.
CREATE TABLE IF NOT EXISTS email_log (
  ts       INTEGER NOT NULL,
  family   TEXT NOT NULL,
  kind     TEXT NOT NULL,   -- confirm | test | weekly
  ok       INTEGER NOT NULL,
  detail   TEXT             -- SES MessageId, or the error message
);
CREATE INDEX IF NOT EXISTS email_log_ts ON email_log (ts);
