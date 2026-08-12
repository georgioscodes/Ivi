-- Baseline. Extensions only; feature tables arrive with their modules.
--
-- citext gives case-insensitive comparison for email addresses, so that a
-- practitioner cannot register the same address twice in different cases.
CREATE EXTENSION IF NOT EXISTS citext;
