-- 0004: postcode as its own field (Sam works by postcode area: BS16, BS5, NP...).
-- Normalised upper-case with one space, e.g. "BS16 1AA". Older rows keep '' (they put it in `address`).
ALTER TABLE enquiries ADD COLUMN postcode TEXT NOT NULL DEFAULT '';
