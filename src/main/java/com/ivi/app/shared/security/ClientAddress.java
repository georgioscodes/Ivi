package com.ivi.app.shared.security;

import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
 * but it is not what anyone would want, and it is invisible from the outside: the application
 * behaves normally and the limit is simply weaker than intended. So the effective value is logged
 * at startup rather than left to be discovered during an incident.
 */
@Component
public class ClientAddress {

    private static final Logger log = LoggerFactory.getLogger(ClientAddress.class);

    private final int trustedProxyCount;

    public ClientAddress(@Value("${ivi.security.trusted-proxy-count:0}") int trustedProxyCount) {
        this.trustedProxyCount = Math.max(0, trustedProxyCount);

        // INFO rather than WARN at zero: zero is correct for a local run and for anything reached
        // directly, and a warning on every developer start is a warning people learn to skip.
        log.info(
            "Client address resolution: trusting {} proxy hop(s); X-Forwarded-For is {}",
            this.trustedProxyCount,
            this.trustedProxyCount == 0 ? "ignored entirely" : "read from the right"
        );
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
