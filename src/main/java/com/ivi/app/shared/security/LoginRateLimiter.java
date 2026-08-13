package com.ivi.app.shared.security;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Slows down credential guessing at the login endpoint.
 *
 * <p>Credential stuffing is the likeliest threat to this product and BCrypt at cost 12 does not
 * stop it, it only makes each attempt cost the server about a quarter of a second. Attempts are
 * counted per email and per source address separately: keying on email alone lets one address
 * spray many accounts, and keying on address alone lets a distributed attempt through.
 *
 * <p><strong>In-memory, therefore per-instance.</strong> That is honest for a single-instance
 * beta and wrong for anything scaled horizontally, where an attacker simply spreads attempts
 * across instances. Moving the counter into Postgres or accepting Cloud Armor's edge rate
 * limiting as the real control is the fix, and this class is not a substitute for either.
 */
@Slf4j
@Component
public class LoginRateLimiter {

    private static final int MAX_ATTEMPTS_PER_EMAIL = 5;
    private static final int MAX_ATTEMPTS_PER_ADDRESS = 20;
    private static final Duration WINDOW = Duration.ofMinutes(15);

    private final Map<String, Window> byEmail = new ConcurrentHashMap<>();
    private final Map<String, Window> byAddress = new ConcurrentHashMap<>();

    /** True when this attempt should be refused before the password is even checked. */
    public boolean isBlocked(String email, String ipAddress) {
        return exceeded(byEmail, normalise(email), MAX_ATTEMPTS_PER_EMAIL)
            || exceeded(byAddress, ipAddress, MAX_ATTEMPTS_PER_ADDRESS);
    }

    public void recordFailure(String email, String ipAddress) {
        increment(byEmail, normalise(email));
        increment(byAddress, ipAddress);
    }

    /**
     * Clears the counter for the email but deliberately not for the address: a successful login
     * to one account should not reset an address that has been failing against twenty others.
     */
    public void recordSuccess(String email) {
        byEmail.remove(normalise(email));
    }

    private boolean exceeded(Map<String, Window> counters, String key, int limit) {
        if (key == null) {
            return false;
        }
        Window window = counters.get(key);
        if (window == null || window.isExpired()) {
            counters.remove(key);
            return false;
        }
        return window.count.get() >= limit;
    }

    private void increment(Map<String, Window> counters, String key) {
        if (key == null) {
            return;
        }
        counters.compute(key, (ignored, existing) ->
            existing == null || existing.isExpired() ? new Window() : existing.increment());

        // Opportunistic cleanup. The maps are small in normal use; this stops a sustained attack
        // from growing them without bound.
        if (counters.size() > 10_000) {
            counters.entrySet().removeIf(entry -> entry.getValue().isExpired());
        }
    }

    private String normalise(String email) {
        return email == null ? null : email.trim().toLowerCase();
    }

    private static final class Window {
        private final Instant startedAt = Instant.now();
        private final AtomicInteger count = new AtomicInteger(1);

        boolean isExpired() {
            return startedAt.plus(WINDOW).isBefore(Instant.now());
        }

        Window increment() {
            count.incrementAndGet();
            return this;
        }
    }
}
