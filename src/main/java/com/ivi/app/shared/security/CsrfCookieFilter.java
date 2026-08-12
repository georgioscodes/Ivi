package com.ivi.app.shared.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Materialises the CSRF token so the cookie is actually written.
 *
 * <p>Spring Security 6 defers token generation: the value is only computed if something asks for
 * it, so with a cookie-based repository the {@code XSRF-TOKEN} cookie is never sent to a client
 * that has not yet triggered a lookup. An SPA would then have no token to echo and every
 * state-changing request would fail with 403.
 *
 * <p>Calling {@link CsrfToken#getToken()} here forces the value on every request, so the cookie is
 * always present and current.
 */
public class CsrfCookieFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        CsrfToken csrfToken = (CsrfToken) request.getAttribute(CsrfToken.class.getName());
        if (csrfToken != null) {
            csrfToken.getToken();
        }
        filterChain.doFilter(request, response);
    }
}
