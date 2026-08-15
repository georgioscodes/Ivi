package com.ivi.app.shared.integration;

import com.ivi.app.shared.security.LoginRateLimiter;
import com.ivi.app.shared.test.TestcontainersConfig;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The rate limiter used to count in a {@code ConcurrentHashMap}, which meant every instance
 * enforced its own private limit. These tests are written against the property that replaced it:
 * the counter lives in Postgres, so it is one counter no matter how many instances read it.
 *
 * <p>"Another instance" is simulated by writing the counter row directly. That is exactly what a
 * second process would leave behind, and it is a stronger test than constructing a second limiter
 * object — it proves this one reads state it did not write.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(TestcontainersConfig.class)
class LoginRateLimitIntegrationTest {

    private static final int EMAIL_LIMIT = 5;
    private static final int ADDRESS_LIMIT = 20;

    private static final String EMAIL = "locked@example.gr";
    private static final String ADDRESS = "203.0.113.7";

    @Autowired
    private LoginRateLimiter rateLimiter;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private TestRestTemplate restTemplate;

    @BeforeEach
    void setUp() {
        jdbcTemplate.update("DELETE FROM login_attempt");
    }

    @Test
    void shouldNotBlock_whenFailuresAreBelowTheEmailLimit() {
        // Given
        recordFailures(EMAIL_LIMIT - 1, EMAIL, ADDRESS);

        // When / Then
        assertThat(rateLimiter.isBlocked(EMAIL, ADDRESS)).isFalse();
    }

    @Test
    void shouldBlock_whenFailuresReachTheEmailLimit() {
        // Given
        recordFailures(EMAIL_LIMIT, EMAIL, ADDRESS);

        // When / Then
        assertThat(rateLimiter.isBlocked(EMAIL, ADDRESS)).isTrue();
    }

    @Test
    void shouldBlock_whenOneAddressSpraysManyDifferentAccounts() {
        // Given — each account stays well under its own limit
        for (int i = 0; i < ADDRESS_LIMIT; i++) {
            rateLimiter.recordFailure("victim-%d@example.gr".formatted(i), ADDRESS);
        }

        // When / Then — the address counter is what catches it
        assertThat(rateLimiter.isBlocked("victim-99@example.gr", ADDRESS)).isTrue();
        assertThat(attempts("ADDRESS", ADDRESS)).isEqualTo(ADDRESS_LIMIT);
    }

    @Test
    void shouldBlock_whenAnotherInstanceRecordedTheFailures() {
        // Given — a counter this process never wrote, exactly as a second instance would leave it
        jdbcTemplate.update("""
            INSERT INTO login_attempt (scope, principal, attempts, window_started_at)
            VALUES ('EMAIL', ?, ?, now())
            """, EMAIL, EMAIL_LIMIT);

        // When / Then
        assertThat(rateLimiter.isBlocked(EMAIL, ADDRESS)).isTrue();
    }

    @Test
    void shouldNotLoseFailures_whenRecordedConcurrently() throws Exception {
        // Given — the read-modify-write this replaced would lose most of these
        int threads = 32;
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        CountDownLatch startTogether = new CountDownLatch(1);
        CountDownLatch finished = new CountDownLatch(threads);
        AtomicInteger failures = new AtomicInteger();

        // When
        for (int i = 0; i < threads; i++) {
            pool.submit(() -> {
                try {
                    startTogether.await();
                    rateLimiter.recordFailure(EMAIL, ADDRESS);
                } catch (Exception e) {
                    failures.incrementAndGet();
                } finally {
                    finished.countDown();
                }
            });
        }
        startTogether.countDown();
        assertThat(finished.await(30, TimeUnit.SECONDS)).isTrue();
        pool.shutdown();

        // Then — every increment landed
        assertThat(failures).hasValue(0);
        assertThat(attempts("EMAIL", EMAIL)).isEqualTo(threads);
        assertThat(attempts("ADDRESS", ADDRESS)).isEqualTo(threads);
    }

    @Test
    void shouldStopBlocking_whenTheWindowHasExpired() {
        // Given
        recordFailures(EMAIL_LIMIT, EMAIL, ADDRESS);
        expireAllWindows();

        // When / Then
        assertThat(rateLimiter.isBlocked(EMAIL, ADDRESS)).isFalse();
    }

    @Test
    void shouldOpenAFreshWindow_whenCountingAfterExpiry() {
        // Given
        recordFailures(EMAIL_LIMIT, EMAIL, ADDRESS);
        expireAllWindows();

        // When
        rateLimiter.recordFailure(EMAIL, ADDRESS);

        // Then — the stale count is replaced, not added to
        assertThat(attempts("EMAIL", EMAIL)).isEqualTo(1);
        assertThat(rateLimiter.isBlocked(EMAIL, ADDRESS)).isFalse();
    }

    @Test
    void shouldClearTheEmailCounterButNotTheAddress_whenLoginSucceeds() {
        // Given
        recordFailures(EMAIL_LIMIT, EMAIL, ADDRESS);

        // When
        rateLimiter.recordSuccess(EMAIL);

        // Then — one account signing in must not absolve an address that failed against others
        assertThat(attempts("EMAIL", EMAIL)).isZero();
        assertThat(attempts("ADDRESS", ADDRESS)).isEqualTo(EMAIL_LIMIT);
    }

    @Test
    void shouldShareOneCounter_whenTheEmailDiffersOnlyByCaseOrSpacing() {
        // Given — varying the capitalisation must not buy a fresh allowance
        for (int i = 0; i < EMAIL_LIMIT; i++) {
            rateLimiter.recordFailure("  LOCKED@Example.GR  ", ADDRESS);
        }

        // When / Then
        assertThat(rateLimiter.isBlocked(EMAIL, ADDRESS)).isTrue();
        assertThat(attempts("EMAIL", EMAIL)).isEqualTo(EMAIL_LIMIT);
    }

    @Test
    void shouldDeleteExpiredRows_whenSwept() {
        // Given
        recordFailures(2, EMAIL, ADDRESS);
        rateLimiter.recordFailure("still-live@example.gr", "198.51.100.4");
        expireWindowsFor(EMAIL, ADDRESS);

        // When
        rateLimiter.sweepExpiredAttempts();

        // Then — only the expired rows go
        assertThat(rowCount()).isEqualTo(2);
        assertThat(attempts("EMAIL", "still-live@example.gr")).isEqualTo(1);
    }

    @Test
    void shouldReturn429_whenSignInIsRetriedPastTheLimit() {
        // Given — no account needs to exist; the limiter runs before authentication
        String email = "nobody@example.gr";
        for (int i = 0; i < EMAIL_LIMIT; i++) {
            assertThat(attemptLogin(email).getStatusCode().value())
                .as("attempt %d", i + 1)
                .isEqualTo(401);
        }

        // When
        ResponseEntity<String> blocked = attemptLogin(email);

        // Then
        assertThat(blocked.getStatusCode().value()).isEqualTo(429);
        assertThat(blocked.getBody()).contains("Too many sign-in attempts");
    }

    private ResponseEntity<String> attemptLogin(String email) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        return restTemplate.postForEntity("/api/v1/auth/login",
            new HttpEntity<>("""
                {"email":"%s","password":"wrong-password"}
                """.formatted(email), headers),
            String.class);
    }

    private void recordFailures(int times, String email, String address) {
        for (int i = 0; i < times; i++) {
            rateLimiter.recordFailure(email, address);
        }
    }

    private int attempts(String scope, String principal) {
        Integer attempts = jdbcTemplate.queryForObject("""
            SELECT COALESCE(SUM(attempts), 0) FROM login_attempt
            WHERE scope = ? AND principal = ?
            """, Integer.class, scope, principal);
        return attempts == null ? 0 : attempts;
    }

    private int rowCount() {
        Integer count = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM login_attempt", Integer.class);
        return count == null ? 0 : count;
    }

    /** Back-dates every window past the 15-minute limit, rather than waiting for one. */
    private void expireAllWindows() {
        jdbcTemplate.update(
            "UPDATE login_attempt SET window_started_at = now() - INTERVAL '16 minutes'");
    }

    private void expireWindowsFor(String email, String address) {
        jdbcTemplate.update("""
            UPDATE login_attempt SET window_started_at = now() - INTERVAL '16 minutes'
            WHERE principal IN (?, ?)
            """, email, address);
    }
}
