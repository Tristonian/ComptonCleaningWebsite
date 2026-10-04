-- 0012: Sam's calendar and when the public "Call me" button is offered (ADR 0011).
--
-- `call_hours` is the usual week: one row per window he takes calls (no row for a day = no calls that day,
-- which is how "never at weekends" works). Times are wall-clock Europe/London, so BST/GMT needs no care.
--
-- `schedule_entries` is the calendar on top of it, dated: a round he is working that day, an extra window
-- he will take calls ('callable'), or 'not_callable' that switches the whole day's calls off (a day off).
-- Overrides-only, like content: with no rows at all the week above is the whole story.

CREATE TABLE call_hours (
  weekday smallint NOT NULL CHECK (weekday BETWEEN 1 AND 7),   -- ISO: 1 = Monday ... 7 = Sunday
  opens   time     NOT NULL,
  closes  time     NOT NULL CHECK (closes > opens),
  PRIMARY KEY (weekday, opens)
);

CREATE TABLE schedule_entries (
  id       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  on_date  date   NOT NULL,
  kind     text   NOT NULL CHECK (kind IN ('round', 'callable', 'not_callable')),
  round_id bigint REFERENCES rounds (id) ON DELETE CASCADE,    -- only for kind = 'round'
  starts   time,                                               -- 'callable' needs both; 'round' may have a start only
  ends     time,
  note     text   NOT NULL DEFAULT '',
  CHECK (kind <> 'round' OR round_id IS NOT NULL),
  CHECK (kind <> 'callable' OR (starts IS NOT NULL AND ends IS NOT NULL AND ends > starts))
);
CREATE INDEX schedule_entries_date ON schedule_entries (on_date);

ALTER TABLE call_hours        ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_entries  ENABLE ROW LEVEL SECURITY;
