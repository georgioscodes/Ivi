package com.ivi.app.shared.security;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Locale;

/**
 * Slows down credential guessing at the login endpoint.
 *
 * <p>Credential stuffing is the likeliest threat to this product and BCrypt at cost 12 does not
 * stop it, it only makes each attempt cost the server about a quarter of a second. Attempts are
 * counted per email and per source address separately: keying on email alone lets one address
 * spray many accounts, and keying on address alone lets a distributed attempt through.
 *
 * <p><strong>Counters are held in Postgres, so the limit is the same limit on every instance.</strong>
 * They used to be an in-memory map, which made each instance enforce its own private limit —
 * behind a load balancer that multiplies the allowance by the instance count and lets an attacker
 * who spreads attempts across instances through entirely, and a restart or rolling deploy cleared
 * every lockout. The database was already on this path for the credential lookup, so the shared
 * counter costs one round trip and no new infrastructure.
 *
 * <p>The class holds no state of its own. Two instances of it, in one process or twenty, see the
 * same counters, because the counters are not here.
 *
 * <p>This is still application-level throttling and it still runs after the request has reached
 * the application. Edge rate limiting at Cloud Armor is the control that keeps volume off the
 * service in the first place, and remains worth having; this one is what makes a limit per account
 * meaningful, which an edge limit keyed on address cannot do.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class LoginRateLimiter {

    private static final int MAX_ATTEMPTS_PER_EMAIL = 5;
    private static final int MAX_ATTEMPTS_PER_ADDRESS = 20;
    private static final Duration WINDOW = Duration.ofMinutes(15);

    private final LoginAttemptStore attemptStore;

    /** True when this attempt should be refused before the password is even checked. */
    public boolean isBlocked(String email, String ipAddress) {
        return exceeded(LoginAttemptScope.EMAIL, normalise(email), MAX_ATTEMPTS_PER_EMAIL)
            || exceeded(LoginAttemptScope.ADDRESS, ipAddress, MAX_ATTEMPTS_PER_ADDRESS);
    }

    public void recordFailure(String email, String ipAddress) {
        count(LoginAttemptScope.EMAIL, normalise(email));
        count(LoginAttemptScope.ADDRESS, ipAddress);
    }

    /**
     * Clears the counter for the email but deliberately not for the address: a successful login
     * to one account should not reset an address that has been failing against twenty others.
     */
    public void recordSuccess(String email) {
        String key = normalise(email);
        if (key != null) {
            attemptStore.clear(LoginAttemptScope.EMAIL, key);
        }
    }

    /**
     * Sweeps expired rows. Runs less often than the window is long, because expired rows are
     * already invisible to every read — this only stops the table growing under a sustained
     * attack, and does not need to be prompt. The first run is deferred by the same interval so
     * it never competes with application startup.
     */
    @Scheduled(fixedDelayString = "PT30M", initialDelayString = "PT30M")
    public void sweepExpiredAttempts() {
        int removed = attemptStore.deleteExpired(WINDOW);
        if (removed > 0) {
            log.debug("Swept {} expired login-attempt counters", removed);
        }
    }

    private boolean exceeded(LoginAttemptScope scope, String key, int limit) {
        return key != null && attemptStore.attemptsWithin(scope, key, WINDOW) >= limit;
    }

    private void count(LoginAttemptScope scope, String key) {
        if (key != null) {
            attemptStore.recordFailure(scope, key, WINDOW);
        }
    }

    /**
     * Case and surrounding space are not part of an identity, so {@code Alice@Example.gr } and
     * {@code alice@example.gr} must share a counter — otherwise the limit is bypassed by varying
     * the capitalisation. Matches how {@code PractitionerUserDetailsService} looks accounts up.
     *
     * <p>Truncated to what the column holds. Input longer than that is rejected by validation
     * before it reaches the limiter; this is the second line, so that no request shape can turn
     * the login endpoint into a 500.
     */
    private String normalise(String email) {
        if (email == null) {
            return null;
        }
        String normalised = email.trim().toLowerCase(Locale.ROOT);
        return normalised.length() <= LoginAttemptStore.MAX_PRINCIPAL_LENGTH
            ? normalised
            : normalised.substring(0, LoginAttemptStore.MAX_PRINCIPAL_LENGTH);
    }
}
