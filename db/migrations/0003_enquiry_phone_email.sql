-- 0003: phone and email as separate, validated fields. `phone` is stored in international form
-- (+447700900123), `email` lower-cased; either may be '' but not both. `contact` stays as a human
-- readable join of the two ("07700 900123 / jo@example.com") so older rows and quick queries still
-- read well.
ALTER TABLE enquiries ADD COLUMN phone text NOT NULL DEFAULT '';
ALTER TABLE enquiries ADD COLUMN email text NOT NULL DEFAULT '';
ALTER TABLE enquiries ADD CONSTRAINT enquiries_has_contact CHECK (contact <> '' OR phone <> '' OR email <> '');
