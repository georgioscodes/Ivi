package com.ivi.app.shared.security;

/**
 * What a failed-login counter is keyed on.
 *
 * <p>The names are persisted in {@code login_attempt.scope} and constrained by a CHECK there, so
 * renaming a constant is a migration, not a refactor.
 */
enum LoginAttemptScope {

    /** The normalised email the caller tried to sign in as. */
    EMAIL,

    /** The address the attempt came from, as resolved by {@link ClientAddress}. */
    ADDRESS
}
