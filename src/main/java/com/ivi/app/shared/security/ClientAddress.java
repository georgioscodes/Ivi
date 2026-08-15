package com.ivi.app.shared.security;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Who a request came from, for rate limiting and the audit trail.
 *
 * <p>{@code X-Forwarded-For} is a list a client can start and every proxy appends to. Both callers
 * used to take its <em>leftmost</em> entry, which is the part the client writes — so the per-address
 * login limit could be sidestepped by sending a different value each attempt, and the address in
 * the audit log was whatever the caller chose to claim.
 *
 * <p>How many entries can be believed depends entirely on what sits in front of the application,
 * and nothing in the code can know that. So it is configuration:
 *
 * <ul>
 *   <li>{@code 0} (the default) — the header is not trusted at all and the socket address is used.
 *       Right for local runs and for anything reached directly.</li>
 *   <li>{@code n} — the rightmost {@code n} entries were appended by proxies under our control,
 *       and the one before them is the client. Behind a single load balancer, that is {@code 1}.</li>
 * </ul>
 *
 * <p><b>A deployment behind a proxy must set this.</b> Left at zero, every request appears to come
 * from the load balancer, and the per-address limit stops distinguishing callers. That degrades
 * safely — the per-email limit is unaffected and is the one that actually protects an account —
 * but it is not what anyone would want, so {@code IviApplication} logs the effective value at
 * startup rather than leaving it to be discovered.
 */
@Component
public class ClientAddress {

    private final int trustedProxyCount;

    public ClientAddress(@Value("${ivi.security.trusted-proxy-count:0}") int trustedProxyCount) {
        this.trustedProxyCount = Math.max(0, trustedProxyCount);
    }

    public int trustedProxyCount() {
        return trustedProxyCount;
    }

    /** Never null for a real request: falls back to the socket address whenever the header cannot be believed. */
    public String of(HttpServletRequest request) {
        if (trustedProxyCount == 0) {
            return request.getRemoteAddr();
        }

        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded == null || forwarded.isBlank()) {
            return request.getRemoteAddr();
        }

        String[] hops = forwarded.split(",");
        int clientIndex = hops.length - trustedProxyCount;

        // Fewer entries than there are proxies in front of us means the header did not come the
        // way we expect. Trusting it here is exactly the mistake this class exists to avoid.
        if (clientIndex < 0 || clientIndex >= hops.length) {
            return request.getRemoteAddr();
        }

        String candidate = hops[clientIndex].trim();
        return candidate.isEmpty() ? request.getRemoteAddr() : candidate;
    }
}
