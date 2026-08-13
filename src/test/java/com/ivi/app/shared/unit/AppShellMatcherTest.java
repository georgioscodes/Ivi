package com.ivi.app.shared.unit;

import com.ivi.app.shared.security.SecurityConfig;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The rule that decides what may be fetched without a session.
 *
 * <p>It is written as an exclusion — anything read-only that is not {@code /api} or
 * {@code /actuator} — so getting it wrong in the permissive direction would expose client data.
 * These tests exist to hold that boundary rather than to document the paths.
 */
class AppShellMatcherTest {

    @ParameterizedTest(name = "GET {0}")
    @ValueSource(strings = {
        "/",
        "/index.html",
        "/favicon.svg",
        "/assets/index-abc123.js",
        "/assets/inter-greek-wght-normal.woff2",
        "/login",
        "/client/42/plan/7",
    })
    void shouldAllowTheShellAndItsAssets_withoutASession(String path) {
        // Given — the shell is what renders the login form, so it cannot require a login

        // When / Then
        assertThat(matches("GET", path)).isTrue();
    }

    @ParameterizedTest(name = "HEAD {0}")
    @ValueSource(strings = {"/", "/index.html", "/assets/index-abc123.js"})
    void shouldAllowHead_becauseUptimeChecksAndProxiesUseIt(String path) {
        // Given — an earlier version matched GET only. Browsers kept working, so the 401 that
        // every uptime check, proxy revalidation and link checker received read as an outage
        // rather than as a configuration error.

        // When / Then
        assertThat(matches("HEAD", path)).isTrue();
    }

    @ParameterizedTest(name = "{0} {1}")
    @CsvSource({
        "GET,  /api/v1/client",
        "GET,  /api/v1/plan/7",
        "HEAD, /api/v1/client",
        "GET,  /api/v1/does-not-exist",
        "GET,  /actuator/metrics",
        "HEAD, /actuator/env",
    })
    void shouldNotAllowApiOrActuatorPaths(String method, String path) {
        // Given — every value the UI displays comes from one of these, and they hold
        // Article 9 data

        // When / Then
        assertThat(matches(method, path)).isFalse();
    }

    @ParameterizedTest(name = "{0} /")
    @ValueSource(strings = {"POST", "PUT", "PATCH", "DELETE"})
    void shouldNotAllowWrites_evenToShellPaths(String method) {
        // Given — nothing under the shell is writable, and a permissive matcher here would
        // exempt writes from CSRF and authentication both

        // When / Then
        assertThat(matches(method, "/")).isFalse();
    }

    @Test
    void shouldStripTheContextPath_whenTheAppIsNotDeployedAtTheRoot() {
        // Given — under a context path the request URI carries a prefix, and matching the raw
        // URI would make /ivi/api/v1/client look like a client route and serve it unauthenticated
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/ivi/api/v1/client");
        request.setContextPath("/ivi");

        // When / Then
        assertThat(SecurityConfig.APP_SHELL.matches(request)).isFalse();
    }

    private boolean matches(String method, String path) {
        return SecurityConfig.APP_SHELL.matches(new MockHttpServletRequest(method.trim(), path));
    }
}
