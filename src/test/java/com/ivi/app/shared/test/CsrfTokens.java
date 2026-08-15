package com.ivi.app.shared.test;

import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.Optional;

/**
 * Obtains CSRF tokens the way the browser client does.
 *
 * <p>Session cookies are the credential here, so every state-changing request is CSRF-protected —
 * including login itself. A test that posts without a token gets 403 from the filter chain and
 * never reaches the controller it meant to exercise, which reads as a broken endpoint rather than
 * a test that skipped a step.
 *
 * <p>Spring Security 6 defers token generation until something asks for it, so the cookie does not
 * exist until the server has answered at least one request. {@link #prime} performs that first
 * request against a public endpoint — the same dance {@code api/http.ts} does in
 * {@code ensureCsrfToken}.
 *
 * <p>A helper rather than a base class: the testing conventions here prefer composition, and this
 * needs to serve tests that otherwise have nothing in common.
 */
public final class CsrfTokens {

    /** Spring's defaults: the cookie it writes, and the header it expects back. */
    public static final String COOKIE_NAME = "XSRF-TOKEN";
    public static final String HEADER_NAME = "X-XSRF-TOKEN";

    private CsrfTokens() {
        // Utility class — no instantiation
    }

    /** Materialises a token and returns it. */
    public static String prime(TestRestTemplate restTemplate) {
        ResponseEntity<Void> response = restTemplate.getForEntity("/actuator/health", Void.class);
        return issuedBy(response)
            .orElseThrow(() -> new AssertionError(
                "No " + COOKIE_NAME + " cookie was issued by the priming request"));
    }

    /** The token a response set, if it set one. Login may rotate it. */
    public static Optional<String> issuedBy(ResponseEntity<?> response) {
        List<String> cookies = response.getHeaders().get(HttpHeaders.SET_COOKIE);
        if (cookies == null) {
            return Optional.empty();
        }

        String prefix = COOKIE_NAME + "=";
        return cookies.stream()
            .filter(cookie -> cookie.startsWith(prefix))
            .map(cookie -> cookie.substring(prefix.length()).split(";", 2)[0])
            .filter(value -> !value.isEmpty())
            .findFirst();
    }

    /** Headers carrying the token in both places Spring's double-submit check compares. */
    public static HttpHeaders headersFor(String token) {
        HttpHeaders headers = new HttpHeaders();
        headers.add(HttpHeaders.COOKIE, COOKIE_NAME + "=" + token);
        headers.add(HEADER_NAME, token);
        return headers;
    }
}
