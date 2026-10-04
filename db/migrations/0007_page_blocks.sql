-- 0007: free-placement blocks (photos and text) that Sam adds and arranges from the pencil.
-- Photos share site_images / R2 with the logos (kind tells them apart; R2 prefix photo/ vs logo/).
-- A block lives in a named zone (code: blocks-shared.ts) at an order position. Text is stored per
-- language; Welsh falls back to English when empty. Overrides-only: no rows means nothing extra shows.

ALTER TABLE site_images ADD COLUMN kind text NOT NULL DEFAULT 'logo' CHECK (kind IN ('logo', 'photo'));

CREATE TABLE page_blocks (
  id         bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  zone       text        NOT NULL,
  position   integer     NOT NULL,
  kind       text        NOT NULL CHECK (kind IN ('image', 'text')),
  image_hash text        REFERENCES site_images (hash),
  text_en    text        NOT NULL DEFAULT '',
  text_cy    text        NOT NULL DEFAULT '',
  created_by text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((kind = 'image') = (image_hash IS NOT NULL))
);
CREATE INDEX page_blocks_zone_position ON page_blocks (zone, position);
ALTER TABLE page_blocks ENABLE ROW LEVEL SECURITY;
