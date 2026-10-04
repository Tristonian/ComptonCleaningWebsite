-- 0002: contact-form enquiries. Stored first, emailed second, so a mail failure never loses one.
-- Times are unix seconds (UTC). `emailed_at` stays NULL until a notification was accepted.
CREATE TABLE enquiries (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at INTEGER NOT NULL,
  name       TEXT    NOT NULL,
  address    TEXT    NOT NULL,
  contact    TEXT    NOT NULL,
  locale     TEXT    NOT NULL,
  emailed_at INTEGER
);
CREATE INDEX enquiries_created_at ON enquiries (created_at);
