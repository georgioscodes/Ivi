package com.ivi.app.shared.security;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.util.Objects;

/**
 * The shared storage behind {@link LoginRateLimiter}. Holds the SQL and nothing else — the limits,
 * the window and which keys are counted are policy and live in the limiter.
 *
 * <p>Plain JDBC rather than JPA, deliberately. The increment has to be a single atomic statement:
 * a JPA read-modify-write would lose counts under exactly the concurrency this class exists to
 * survive, because two instances that both read {@code attempts = 4} would both write 5 and the
 * limit of 5 would let through six attempts. {@code INSERT … ON CONFLICT DO UPDATE … RETURNING}
 * takes a row lock and re-evaluates against the committed row, so concurrent failures serialise
 * and none is lost. Spring Session, on the same login path, is JDBC-backed for related reasons.
 *
 * <p>Every timestamp comparison uses the <em>database</em> clock. See the migration for why.
 *
 * <p>The class is package-private — nothing outside {@code shared.security} has any business
 * here — but its methods are {@code public} because {@code @Transactional} is silently dropped on
 * non-public methods: {@code AnnotationTransactionAttributeSource} filters them out before a
 * transaction attribute is ever computed, so a package-private annotated method runs with no
 * transaction and no warning.
 */
@Component
@RequiredArgsConstructor
class LoginAttemptStore {

    /**
     * How far back a still-live window may have started, as an interval to subtract from a
     * timestamp. Bound as a parameter rather than inlined so the window stays one Java constant.
     */
    private static final String CUTOFF =
        "CAST(:windowSeconds AS double precision) * INTERVAL '1 second'";

    /**
     * The column is {@code VARCHAR(320)} — the RFC 5321 maximum for an address. Longer input is
     * rejected by {@code LoginRequest} before it reaches here, but a value that overflowed the
     * column would raise a data-integrity error and turn the login endpoint into a 500, so the
     * limiter truncates rather than relying on that. Two distinct 320-character keys sharing a
     * counter is harmless: neither can ever authenticate.
     */
    static final int MAX_PRINCIPAL_LENGTH = 320;

    private final NamedParameterJdbcTemplate jdbc;

    /** How many failures stand against this key inside the live window. Zero if none, or expired. */
    public int attemptsWithin(LoginAttemptScope scope, String principal, Duration window) {
        Integer attempts = jdbc.query(
            """
            SELECT attempts
            FROM login_attempt
            WHERE scope = :scope
              AND principal = :principal
              AND window_started_at > now() - %s
            """.formatted(CUTOFF),
            parameters(scope, principal, window),
            resultSet -> resultSet.next() ? resultSet.getInt(1) : 0);

        return attempts == null ? 0 : attempts;
    }

    /**
     * Counts one failure and returns the resulting total.
     *
     * <p>{@code EXCLUDED.window_started_at} is the {@code now()} from the VALUES clause, so the
     * statement reads the clock once and both branches agree on it.
     *
     * <p>In its own transaction: the caller records the failure from a catch block and then
     * rethrows, and a counter that rolls back with the thing it was counting is not a counter.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public int recordFailure(LoginAttemptScope scope, String principal, Duration window) {
        return jdbc.queryForObject(
            """
            INSERT INTO login_attempt (scope, principal, attempts, window_started_at)
            VALUES (:scope, :principal, 1, now())
            ON CONFLICT (scope, principal) DO UPDATE
            SET attempts = CASE
                    WHEN login_attempt.window_started_at
                             > EXCLUDED.window_started_at - %1$s
                    THEN login_attempt.attempts + 1
                    ELSE 1
                END,
                window_started_at = CASE
                    WHEN login_attempt.window_started_at
                             > EXCLUDED.window_started_at - %1$s
                    THEN login_attempt.window_started_at
                    ELSE EXCLUDED.window_started_at
                END
            RETURNING attempts
            """.formatted(CUTOFF),
            parameters(scope, principal, window),
            Integer.class);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void clear(LoginAttemptScope scope, String principal) {
        jdbc.update(
            "DELETE FROM login_attempt WHERE scope = :scope AND principal = :principal",
            new MapSqlParameterSource()
                .addValue("scope", scope.name())
                .addValue("principal", truncate(principal)));
    }

    /**
     * Removes rows whose window has passed, and returns how many.
     *
     * <p>Expired rows are already ignored by every read, so this is housekeeping rather than
     * correctness — but without it a sustained attack grows the table without bound.
     *
     * <p>Safe to run from several instances at once: it is an idempotent delete of rows nothing
     * else is reading, so the worst case is one instance finding the work already done.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public int deleteExpired(Duration window) {
        return jdbc.update(
            "DELETE FROM login_attempt WHERE window_started_at <= now() - %s".formatted(CUTOFF),
            new MapSqlParameterSource().addValue("windowSeconds", window.toSeconds()));
    }

    private MapSqlParameterSource parameters(LoginAttemptScope scope, String principal, Duration window) {
        return new MapSqlParameterSource()
            .addValue("scope", scope.name())
            .addValue("principal", truncate(principal))
            .addValue("windowSeconds", window.toSeconds());
    }

    private String truncate(String principal) {
        Objects.requireNonNull(principal, "principal");
        return principal.length() <= MAX_PRINCIPAL_LENGTH
            ? principal
            : principal.substring(0, MAX_PRINCIPAL_LENGTH);
    }
}
