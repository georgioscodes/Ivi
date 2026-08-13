package com.ivi.app.shared.logging;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.List;

/**
 * Controls what the request/response filter records.
 *
 * <p>{@code includeBodies} defaults to <strong>false</strong> and that default is deliberate.
 * Request and response bodies here carry names, weights, blood markers and clinical notes —
 * special-category data under GDPR Article 9. Logging them copies the health record into a log
 * stream whose retention and access control differ from the database's, which is a disclosure in
 * its own right. Turn it on locally against fake data; think hard before turning it on anywhere
 * a real client's record exists.
 */
@ConfigurationProperties(prefix = "ivi.http-logging")
public record HttpLoggingProperties(
    boolean enabled,
    boolean includeBodies,
    int maxBodyChars,

    /** Paths whose bodies are never logged, whatever {@code includeBodies} says. */
    List<String> neverLogBodyPaths,

    /** Paths not logged at all, to keep health checks out of the stream. */
    List<String> excludePaths
) {

    public HttpLoggingProperties {
        if (maxBodyChars <= 0) {
            maxBodyChars = 2000;
        }
        if (neverLogBodyPaths == null || neverLogBodyPaths.isEmpty()) {
            // Credentials must never reach a log, so this holds even when bodies are enabled.
            neverLogBodyPaths = List.of(
                "/api/v1/auth",
                "/api/v1/practitioner/registration");
        }
        if (excludePaths == null) {
            excludePaths = List.of("/actuator");
        }
    }
}
