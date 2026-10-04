-- 0005: the admin enquiry inbox (ADR 0005). Status and Sam's own notes on each enquiry, read/unread,
-- a log of replies sent from the admin, and a first, small customers table ("add as customer").
-- The customers table is the seed of the tracker/planner (rounds, jobs, payments come later).

CREATE TABLE customers (
  id                   bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at           timestamptz NOT NULL DEFAULT now(),
  name                 text        NOT NULL,
  phone                text        NOT NULL DEFAULT '',
  email                text        NOT NULL DEFAULT '',
  address              text        NOT NULL,
  postcode             text        NOT NULL DEFAULT '',
  lat                  double precision,
  lng                  double precision,
  notes                text        NOT NULL DEFAULT '',
  -- How they found Sam (a key from src/lib/enquiry-options.ts), copied from the enquiry.
  source               text        NOT NULL DEFAULT '',
  created_from_enquiry bigint
);

ALTER TABLE enquiries ADD COLUMN status      text        NOT NULL DEFAULT 'new'
  CHECK (status IN ('new', 'contacted', 'quoted', 'booked', 'lost'));
ALTER TABLE enquiries ADD COLUMN admin_notes text        NOT NULL DEFAULT '';
ALTER TABLE enquiries ADD COLUMN read_at     timestamptz;
ALTER TABLE enquiries ADD COLUMN updated_at  timestamptz NOT NULL DEFAULT now();
ALTER TABLE enquiries ADD COLUMN customer_id bigint REFERENCES customers (id) ON DELETE SET NULL;
CREATE INDEX enquiries_status_created ON enquiries (status, created_at DESC);

-- Every reply sent from the admin, so the thread is on the enquiry even though the email went out
-- through Resend and not through Sam's Gmail.
CREATE TABLE enquiry_replies (
  id         bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  enquiry_id bigint      NOT NULL REFERENCES enquiries (id) ON DELETE CASCADE,
  sent_at    timestamptz NOT NULL DEFAULT now(),
  sent_by    text        NOT NULL,
  to_email   text        NOT NULL,
  subject    text        NOT NULL,
  body       text        NOT NULL
);
CREATE INDEX enquiry_replies_enquiry ON enquiry_replies (enquiry_id, sent_at);

-- RLS on every table (ADR 0005); the app connects as the owner, anything else gets nothing.
ALTER TABLE customers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE enquiry_replies ENABLE ROW LEVEL SECURITY;
