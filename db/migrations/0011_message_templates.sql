-- 0011: Templates screen. Sam can switch each text/email template off and edit its wording.
-- Overrides-only like content: no row = the default in code (message-templates.ts), switched on.
-- A NULL subject or body means "still the default", so changing one never freezes the other and
-- a later improvement to a default still reaches a template Sam only switched off.

CREATE TABLE message_templates (
  key        text        PRIMARY KEY,
  enabled    boolean     NOT NULL DEFAULT true,
  subject    text,
  body       text,
  updated_by text        NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
