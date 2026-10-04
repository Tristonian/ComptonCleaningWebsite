-- 0002: the pin a customer confirmed on the map (or their detected location), for Sam's email and
-- later his calendar. Both nullable: the form works without them. WGS84 degrees.
ALTER TABLE enquiries ADD COLUMN lat double precision;
ALTER TABLE enquiries ADD COLUMN lng double precision;
