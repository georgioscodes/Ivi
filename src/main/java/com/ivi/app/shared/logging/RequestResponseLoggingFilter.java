package com.ivi.app.shared.logging;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.ContentCachingRequestWrapper;
import org.springframework.web.util.ContentCachingResponseWrapper;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;

/**
 * Logs every request and response at the boundary.
 *
 * <p>A filter is the right place for this: the clean-code skill forbids logging HTTP by hand in
 * controllers precisely so that it happens once, here, consistently.
 *
 * <p><strong>Bodies are a disclosure risk, not just noise.</strong> The bodies passing through
 * this application carry names, weights, blood markers and clinical notes — Article 9
 * special-category data — and, on the authentication endpoints, passwords. Writing them to a log
 * stream creates a second copy of the health record under different retention and access rules
 * from the database. Four defences apply, in order:
 *
 * <ol>
 *   <li>bodies are logged only when explicitly enabled, and the default is off;</li>
 *   <li>the authentication paths never log a body, whatever that setting says;</li>
 *   <li>{@link SensitiveDataMasker} strips credentials outright and replaces names, addresses,
 *       phone numbers and free clinical text inside any body that is logged;</li>
 *   <li>binary responses are described rather than dumped, so a PDF export does not put a
 *       client's whole diet plan into the logs as mangled bytes.</li>
 * </ol>
 *
 * <p>Metadata — method, path, status, duration — is always logged. It is the operationally useful
 * part and carries no clinical content.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class RequestResponseLoggingFilter extends OncePerRequestFilter {

    private static final List<String> TEXTUAL_CONTENT_TYPES =
        List.of("application/json", "application/xml", "text/");

    private final HttpLoggingProperties properties;
    private final SensitiveDataMasker masker;

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        if (!properties.enabled()) {
            return true;
        }
        return properties.excludePaths().stream()
            .anyMatch(excluded -> request.getRequestURI().startsWith(excluded));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        // Wrapping is only worth its memory cost when bodies are actually being logged: these
        // wrappers buffer the whole payload, and a large upload would otherwise be held twice.
        boolean captureBodies = properties.includeBodies() && bodyAllowedFor(request);

        if (!captureBodies) {
            long startedAt = System.currentTimeMillis();
            try {
                filterChain.doFilter(request, response);
            } finally {
                logExchange(request, response.getStatus(), startedAt, null, null);
            }
            return;
        }

        ContentCachingRequestWrapper cachedRequest = new ContentCachingRequestWrapper(request);
        ContentCachingResponseWrapper cachedResponse = new ContentCachingResponseWrapper(response);

        long startedAt = System.currentTimeMillis();
        try {
            filterChain.doFilter(cachedRequest, cachedResponse);
        } finally {
            String requestBody = bodyOf(cachedRequest.getContentAsByteArray(),
                cachedRequest.getContentType());
            String responseBody = bodyOf(cachedResponse.getContentAsByteArray(),
                cachedResponse.getContentType());

            logExchange(request, cachedResponse.getStatus(), startedAt, requestBody, responseBody);

            // Without this the client receives an empty body: the wrapper swallowed it.
            cachedResponse.copyBodyToResponse();
        }
    }

    private void logExchange(HttpServletRequest request, int status, long startedAt,
                             String requestBody, String responseBody) {
        long durationMs = System.currentTimeMillis() - startedAt;
        String query = request.getQueryString();

        // The correlation id is already on every line, put there by CorrelationIdFilter.
        if (requestBody == null && responseBody == null) {
            log.info("{} {}{} -> {} in {}ms",
                request.getMethod(), request.getRequestURI(),
                query == null ? "" : "?" + query, status, durationMs);
            return;
        }

        log.info("{} {}{} -> {} in {}ms | request: {} | response: {}",
            request.getMethod(), request.getRequestURI(),
            query == null ? "" : "?" + query, status, durationMs,
            requestBody == null ? "-" : requestBody,
            responseBody == null ? "-" : responseBody);
    }

    /** False for the paths that carry credentials, regardless of configuration. */
    private boolean bodyAllowedFor(HttpServletRequest request) {
        return properties.neverLogBodyPaths().stream()
            .noneMatch(path -> request.getRequestURI().startsWith(path));
    }

    private String bodyOf(byte[] content, String contentType) {
        if (content == null || content.length == 0) {
            return null;
        }

        if (!isTextual(contentType)) {
            // A PDF export is roughly 24 kB of binary. Describing it is useful; dumping it is not.
            return "[" + (contentType == null ? "binary" : contentType) + ", "
                + content.length + " bytes]";
        }

        // Masked before any length check, so truncation can never leave a half-masked value.
        String redacted = masker.mask(new String(content, StandardCharsets.UTF_8));

        if (redacted.length() > properties.maxBodyChars()) {
            return redacted.substring(0, properties.maxBodyChars())
                + "...[truncated, " + redacted.length() + " chars]";
        }
        return redacted;
    }

    private boolean isTextual(String contentType) {
        if (contentType == null) {
            return false;
        }
        String lower = contentType.toLowerCase(Locale.ROOT);
        return TEXTUAL_CONTENT_TYPES.stream().anyMatch(lower::startsWith);
    }
}
