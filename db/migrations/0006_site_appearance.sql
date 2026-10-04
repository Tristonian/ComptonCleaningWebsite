-- 0006: site appearance. Uploaded logos (bytes live in R2 under their content hash, ADR 0002) and
-- single-value settings (which logo is active, the hero colour). Overrides-only like content: no
-- row means the default shipped in code.

CREATE TABLE site_images (
  hash         text        PRIMARY KEY CHECK (hash ~ '^[0-9a-f]{64}$'),
  content_type text        NOT NULL,
  width        integer     NOT NULL,
  height       integer     NOT NULL,
  label        text        NOT NULL DEFAULT '',
  uploaded_by  text        NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE site_settings (
  key        text        PRIMARY KEY,
  value      text        NOT NULL,
  updated_by text        NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE site_images   ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
