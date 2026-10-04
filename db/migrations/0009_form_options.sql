-- 0009: the contact form's two drop-downs ("What service" and "Where did you hear about us") become
-- editable by Sam: add, remove, rename, reorder. Overrides-only like content: while a list has NO rows
-- the defaults in code (enquiry-options.ts) apply; the first save writes the whole list. "Reset" deletes
-- the rows. `value` is a stable key; renaming never changes it. Enquiries store a snapshot of the English
-- label (`custom:<label>`) once a list has been edited, so history survives later renames and removals.

CREATE TABLE form_options (
  id         bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  list       text        NOT NULL CHECK (list IN ('service', 'source')),
  value      text        NOT NULL,
  label_en   text        NOT NULL,
  label_cy   text        NOT NULL DEFAULT '',
  position   integer     NOT NULL,
  updated_by text        NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (list, value)
);
ALTER TABLE form_options ENABLE ROW LEVEL SECURITY;
