-- Failed sign-in counters, shared by every application instance.
--
-- These lived in a ConcurrentHashMap, which meant each instance counted only the attempts it
-- happened to serve. Behind a load balancer that is not a rate limit: two instances allow twice
-- the configured attempts, and an attacker spreading a credential-stuffing run across them is
-- never blocked at all. A restart also wiped the counters, so a rolling deploy reset every lockout.
--
-- Postgres is already on the login path — the credential lookup goes there — so a shared counter
-- costs one extra round trip and no new infrastructure.
CREATE TABLE login_attempt (
    -- What the counter is keyed on. Email and address are counted separately on purpose: keying
    -- on email alone lets one address spray many accounts, and keying on address alone lets a
    -- distributed attempt through.
    scope             VARCHAR(8)   NOT NULL,

    -- The normalised email, or the caller's address.
    --
    -- Stored as given rather than hashed. Hashing an email is weak pseudonymisation — anyone
    -- holding this table can confirm a guessed address in one hash — and the practitioner table
    -- beside it already holds the same addresses in clear. Being able to see which account is
    -- under attack is worth more than that thin gain. Retention is the control instead: rows are
    -- swept once their window has passed.
    principal         VARCHAR(320) NOT NULL,

    attempts          INT          NOT NULL,

    -- When the current counting window opened.
    --
    -- Always written from the database clock, never the application's. Instance clocks drift, and
    -- a window opened against a fast clock and read against a slow one either expires early or
    -- never expires. One clock is the only way a shared counter agrees with itself.
    window_started_at TIMESTAMPTZ  NOT NULL,

    CONSTRAINT login_attempt_pk PRIMARY KEY (scope, principal),
    CONSTRAINT login_attempt_scope CHECK (scope IN ('EMAIL', 'ADDRESS'))
);

-- The sweep is the only access that is not by primary key.
CREATE INDEX login_attempt_window_idx ON login_attempt (window_started_at);
