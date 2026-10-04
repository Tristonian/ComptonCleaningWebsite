-- 0008: services Sam adds himself (e.g. Pressure washing). Each shows as a card after the built-in
-- ones and owns a block zone named 'svc-<id>' for its photos and text (ADR 0006). Welsh falls back
-- to English while empty. Overrides-only: no rows, nothing extra on the page.

CREATE TABLE custom_services (
  id         bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  position   integer     NOT NULL,
  title_en   text        NOT NULL,
  title_cy   text        NOT NULL DEFAULT '',
  body_en    text        NOT NULL DEFAULT '',
  body_cy    text        NOT NULL DEFAULT '',
  created_by text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE custom_services ENABLE ROW LEVEL SECURITY;
