package com.ivi.app.shared.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Puts a correlation id on every request so a single request can be traced across
 * all of the log entries it produces. Cleared in a finally block because the thread
 * is returned to the pool and would otherwise carry the id into an unrelated request.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class CorrelationIdFilter extends OncePerRequestFilter {

    private static final String CORRELATION_ID_HEADER = "X-Correlation-Id";
    private static final String CORRELATION_ID_MDC_KEY = "correlationId";

    /**
     * Matches {@code audit_log.correlation_id VARCHAR(64)}, which is where this value ends up.
     *
     * <p>The header is client-supplied and was taken as given. A longer one made the audit insert
     * fail, and because that insert runs in its own transaction the failure surfaced at commit —
     * after the defensive {@code try/catch} in {@code AuditService.record} had already returned.
     * The result, measured: {@code GET /api/v1/client/{id}} answered <b>500</b> and no audit row
     * was written. A client-controlled header could break every audited read in the application.
     *
     * <p>Truncated rather than rejected. The value is a debugging aid; refusing the request over
     * it would turn a caller's cosmetic mistake into an outage, and a clipped id still correlates.
     */
    private static final int MAX_LENGTH = 64;

    /**
     * Control characters would reach the response header and the log. Kept deliberately narrow —
     * this is an identifier, and anything outside it is not one.
     */
    private static final Pattern SAFE = Pattern.compile("[A-Za-z0-9._:-]+");

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        try {
            String correlationId = sanitise(request.getHeader(CORRELATION_ID_HEADER));
            if (correlationId == null) {
                correlationId = UUID.randomUUID().toString();
            }
            MDC.put(CORRELATION_ID_MDC_KEY, correlationId);
            response.setHeader(CORRELATION_ID_HEADER, correlationId);
            filterChain.doFilter(request, response);
        } finally {
            MDC.remove(CORRELATION_ID_MDC_KEY);
        }
    }

    /** Null when there is nothing usable, so the caller generates one instead. */
    private static String sanitise(String supplied) {
        if (supplied == null || supplied.isBlank()) {
            return null;
        }
        String trimmed = supplied.strip();
        if (trimmed.length() > MAX_LENGTH) {
            trimmed = trimmed.substring(0, MAX_LENGTH);
        }
        return SAFE.matcher(trimmed).matches() ? trimmed : null;
    }
}
