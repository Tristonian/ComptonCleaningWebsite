-- 0001 (Postgres, ADR 0005): admin sessions, content overrides, audit log, enquiries.
-- Replaces D1 migrations 0001-0004 (pre-launch, so consolidated). Times are timestamptz (UTC).

-- Only the SHA-256 of the session token is stored (ADR 0003): a leaked database does not
-- hand out logins.
CREATE TABLE sessions (
  token_hash   text        PRIMARY KEY,
  email        text        NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_expires_at ON sessions (expires_at);

-- Overrides-only content (ADR 0002/0004): a row exists only where Sam changed the default.
-- Reverting is a DELETE. One row per (language, node id). `style` is a JSON blob of typography
-- overrides (nullable). `needs_review` marks wording not yet checked by a fluent speaker.
CREATE TABLE content_overrides (
  locale       text        NOT NULL CHECK (locale IN ('en', 'cy')),
  key          text        NOT NULL,
  value        text,
  style        text,
  needs_review boolean     NOT NULL DEFAULT false,
  updated_by   text        NOT NULL,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (locale, key)
);

CREATE TABLE audit_log (
  id     bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at     timestamptz NOT NULL DEFAULT now(),
  email  text        NOT NULL,
  action text        NOT NULL,
  detail text
);
CREATE INDEX audit_log_at ON audit_log (at);

-- Contact-form enquiries: stored first, emailed second, so a mail failure never loses one.
-- `ip_hash` is a salted hash of the sender's IP, used only for rate limiting (never the raw IP).
CREATE TABLE enquiries (
  id         bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  name       text        NOT NULL,
  address    text        NOT NULL,
  postcode   text        NOT NULL DEFAULT '',
  contact    text        NOT NULL,
  notes      text        NOT NULL DEFAULT '',
  locale     text        NOT NULL,
  ip_hash    text,
  emailed_at timestamptz
);
CREATE INDEX enquiries_created_at ON enquiries (created_at);
CREATE INDEX enquiries_ip_created ON enquiries (ip_hash, created_at);

-- Row-level security on every table (ADR 0005). Neon's `ensure_rls` event trigger also does this
-- for any future table; stating it here keeps it true on a fresh database and in tests. The app
-- connects as the table owner, which bypasses RLS; any other role gets nothing without a policy.
ALTER TABLE sessions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log         ENABLE ROW LEVEL SECURITY;
ALTER TABLE enquiries         ENABLE ROW LEVEL SECURITY;
