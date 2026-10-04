-- 0004: what the customer wants done, and how they found Sam. Stable keys (see
-- src/lib/enquiry-options.ts), '' for older rows and for "didn't say" on source.
ALTER TABLE enquiries ADD COLUMN service text NOT NULL DEFAULT '';
ALTER TABLE enquiries ADD COLUMN source  text NOT NULL DEFAULT '';
