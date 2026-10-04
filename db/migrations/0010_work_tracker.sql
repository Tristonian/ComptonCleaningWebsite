-- 0010: the work tracker (ADR 0008). Sam's customers become a working list: a price and a frequency,
-- rounds (named areas he works on a weekday; a customer can be in several), and one `jobs` row per
-- clean he marks Done or Missed. Money is integer pence.
--
-- "Due" is never stored: it is last done + frequency, worked out when asked, so it cannot drift.
-- "Owing" is never stored either: it is the done jobs not yet marked paid (a debt is just "no payment
-- was made", e.g. the customer was out), plus their extras.

ALTER TABLE customers
  ADD COLUMN squeegee_ref      text UNIQUE,                       -- "Cust Ref" from the Squeegee export; makes a re-import an update
  ADD COLUMN price_pence       integer CHECK (price_pence >= 0),
  ADD COLUMN frequency_weeks   integer CHECK (frequency_weeks BETWEEN 1 AND 52),  -- NULL = one-off / ad hoc
  ADD COLUMN preferred_payment text    NOT NULL DEFAULT '',       -- a payment_methods.key, or ''
  ADD COLUMN baseline_done_on  date;                              -- last clean from before the tracker (set by hand or import)

CREATE TABLE rounds (
  id       bigint   GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name     text     NOT NULL UNIQUE,
  weekday  smallint CHECK (weekday BETWEEN 1 AND 7),             -- ISO: 1 = Monday ... 7 = Sunday; NULL = no fixed day
  position integer  NOT NULL DEFAULT 0
);

-- Many to many: rounds overlap. `position` is the customer's place in that round (drag to reorder).
CREATE TABLE customer_rounds (
  customer_id bigint  NOT NULL REFERENCES customers (id) ON DELETE CASCADE,
  round_id    bigint  NOT NULL REFERENCES rounds (id)    ON DELETE CASCADE,
  position    integer NOT NULL DEFAULT 0,
  PRIMARY KEY (customer_id, round_id)
);
CREATE INDEX customer_rounds_round ON customer_rounds (round_id, position);

-- Sam can add to this list; the three seeds are the ones he named.
CREATE TABLE payment_methods (
  key      text    PRIMARY KEY,
  label    text    NOT NULL,
  position integer NOT NULL DEFAULT 0
);
INSERT INTO payment_methods (key, label, position) VALUES
  ('transfer', 'Bank transfer', 1),
  ('cash',     'Cash',          2),
  ('card',     'Card',          3);

-- One row per visit. Deleting a customer removes their jobs (a person who asks to be deleted is gone).
CREATE TABLE jobs (
  id             bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id    bigint      NOT NULL REFERENCES customers (id) ON DELETE CASCADE,
  status         text        NOT NULL CHECK (status IN ('done', 'missed')),
  done_on        date        NOT NULL,                           -- never in the future (checked in code too)
  price_pence    integer     NOT NULL DEFAULT 0 CHECK (price_pence >= 0),
  payment_method text        NOT NULL DEFAULT '',                -- a payment_methods.key, or '' while unpaid
  paid           boolean     NOT NULL DEFAULT false,
  notes          text        NOT NULL DEFAULT '',
  created_by     text        NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX jobs_customer_date ON jobs (customer_id, done_on DESC);
CREATE INDEX jobs_unpaid ON jobs (customer_id) WHERE status = 'done' AND NOT paid;

-- Squeegee "worksheets": extra work on a visit (conservatory, gutters...) with its own price.
CREATE TABLE job_extras (
  id          bigint  GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_id      bigint  NOT NULL REFERENCES jobs (id) ON DELETE CASCADE,
  label       text    NOT NULL,
  price_pence integer NOT NULL DEFAULT 0 CHECK (price_pence >= 0)
);

-- Photos of a clean. The bytes live in R2 under `photo/<hash>` like page photos (ADR 0002/0006).
CREATE TABLE job_photos (
  id       bigint  GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_id   bigint  NOT NULL REFERENCES jobs (id) ON DELETE CASCADE,
  hash     text    NOT NULL CHECK (hash ~ '^[0-9a-f]{64}$'),
  width    integer,
  height   integer,
  position integer NOT NULL DEFAULT 0
);

ALTER TABLE rounds           ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_rounds  ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods  ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_extras       ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_photos       ENABLE ROW LEVEL SECURITY;
