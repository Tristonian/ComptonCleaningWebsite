-- 0001: admin sessions, content overrides, audit log. Times are unix seconds (UTC).

-- Only the SHA-256 of the session token is stored (ADR 0003): a leaked database does not
-- hand out logins.
CREATE TABLE sessions (
  token_hash   TEXT    PRIMARY KEY,
  email        TEXT    NOT NULL,
  created_at   INTEGER NOT NULL,
  expires_at   INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL
);
CREATE INDEX sessions_expires_at ON sessions (expires_at);

-- Overrides-only content (ADR 0002, 0004): a row exists only where Sam changed the default.
-- Reverting is a DELETE. One row per (language, node id), so English and Welsh are edited
-- independently. `style` is a JSON blob of typography overrides (nullable).
-- `needs_review` marks wording that has not been checked by a fluent speaker (used for Welsh
-- drafts); the admin shows it and clears it on save.
CREATE TABLE content_overrides (
  locale       TEXT    NOT NULL CHECK (locale IN ('en', 'cy')),
  key          TEXT    NOT NULL,
  value        TEXT,
  style        TEXT,
  needs_review INTEGER NOT NULL DEFAULT 0,
  updated_by   TEXT    NOT NULL,
  updated_at   INTEGER NOT NULL,
  PRIMARY KEY (locale, key)
);

CREATE TABLE audit_log (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  at      INTEGER NOT NULL,
  email   TEXT    NOT NULL,
  action  TEXT    NOT NULL,
  detail  TEXT
);
CREATE INDEX audit_log_at ON audit_log (at);
