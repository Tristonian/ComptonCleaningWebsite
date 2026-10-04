-- 0013: when a visit was paid, so the Earnings reports count money in the period it was received.
-- A visit paid on the day is paid on its visit date; a debt cleared later is paid on the day it was marked
-- paid (done in code). Existing paid visits are backfilled to their visit date, the best we can know. Reports read
-- coalesce(paid_on, done_on), so a row written without it (the demo seed) still counts.

ALTER TABLE jobs ADD COLUMN paid_on date;
UPDATE jobs SET paid_on = done_on WHERE paid;
CREATE INDEX jobs_paid_on ON jobs (paid_on) WHERE paid;
