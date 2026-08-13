package com.ivi.app.shared.exception;

/**
 * Too many authentication attempts in the window.
 *
 * <p>Reported as 429 rather than disguised as a failed login. Concealing it would tell a
 * legitimate practitioner, who has simply mistyped a password five times, that their credentials
 * are wrong when in fact they are locked out — and it conceals little from an attacker, who can
 * infer throttling from the timing anyway.
 */
public class TooManyAttemptsException extends RuntimeException {

    public TooManyAttemptsException(String message) {
        super(message);
    }
}
