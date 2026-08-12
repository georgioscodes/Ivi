package com.ivi.app.shared.security;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

/**
 * The single supported way to learn which practitioner is making the current request.
 *
 * <p>The tenant id comes from the authenticated session and from nowhere else. It is never read
 * from a path variable, a query parameter or a request body, because any of those would let a
 * caller nominate the tenant whose data they wanted.
 */
public final class CurrentPractitioner {

    private CurrentPractitioner() {
        // Utility class — no instantiation
    }

    /**
     * @throws IllegalStateException if there is no authenticated practitioner. That is a
     *     programming error rather than a client error: the endpoint should have required
     *     authentication, so failing loudly is correct.
     */
    public static Long requireId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

        if (authentication == null || !authentication.isAuthenticated()) {
            throw new IllegalStateException("No authenticated practitioner in the security context");
        }

        if (!(authentication.getPrincipal() instanceof AuthenticatedPractitioner practitioner)) {
            throw new IllegalStateException(
                "Authenticated principal is not an AuthenticatedPractitioner: "
                    + authentication.getPrincipal().getClass().getName());
        }

        return practitioner.practitionerId();
    }
}
