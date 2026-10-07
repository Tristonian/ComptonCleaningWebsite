-- 0014: temporary rounds. A round built on the fly from who is due is a one-off plan, not a standing round:
-- it carries an expiry 48 hours after it was built and is hidden, then removed, once that passes. Saving it as
-- a round clears the expiry. NULL (every existing round) means permanent.

ALTER TABLE rounds ADD COLUMN expires_at timestamptz;
