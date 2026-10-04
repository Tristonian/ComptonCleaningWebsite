-- 0003: optional customer notes, and a salted hash of the sender's IP for rate limiting the form.
-- Only the hash is kept (never the raw IP), matching how sessions are stored (ADR 0003).
ALTER TABLE enquiries ADD COLUMN notes   TEXT NOT NULL DEFAULT '';
ALTER TABLE enquiries ADD COLUMN ip_hash TEXT;
CREATE INDEX enquiries_ip_created ON enquiries (ip_hash, created_at);
