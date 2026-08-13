package com.ivi.app.shared.security;

import com.ivi.app.shared.exception.ErrorResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfFilter;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import org.springframework.security.web.util.matcher.RequestMatcher;

import java.nio.charset.StandardCharsets;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final ObjectMapper objectMapper;

    /**
     * Any GET that is not an API or actuator call: the HTML shell, the fingerprinted bundles, the
     * fonts, and every client-side route that falls back to the shell.
     *
     * <p>Written as a rule rather than a list of paths on purpose. A list would have to be edited
     * every time the client gains a route, and the failure when someone forgets is a 401 JSON
     * body rendered as a blank page — which looks like a frontend bug and is not one.
     *
     * <p>The inversion is what keeps it safe: this permits by exclusion of {@code /api}, so a new
     * endpoint is authenticated by default and only static content can ever fall through here.
     *
     * <p>Public so the boundary it draws can be asserted directly in a unit test rather than
     * inferred from a filter chain that needs a database to start.
     */
    public static final RequestMatcher APP_SHELL = request ->
        isRead(request.getMethod())
            && !pathOf(request).startsWith("/api/")
            && !pathOf(request).startsWith("/actuator/");

    /**
     * HEAD as well as GET. Omitting it made every uptime check, proxy revalidation and link
     * checker receive a 401 for a page that is public — which reads as an outage rather than
     * as a configuration error, because the browser path kept working.
     */
    private static boolean isRead(String method) {
        return HttpMethod.GET.matches(method) || HttpMethod.HEAD.matches(method);
    }

    private static String pathOf(HttpServletRequest request) {
        String uri = request.getRequestURI();
        String contextPath = request.getContextPath();
        return contextPath.isEmpty() ? uri : uri.substring(contextPath.length());
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        // Cost 12. Deliberately above the default of 10: these hashes protect health records,
        // and roughly 250ms per verification is an acceptable price on a login-rate endpoint.
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        CsrfTokenRequestAttributeHandler csrfHandler = new CsrfTokenRequestAttributeHandler();
        csrfHandler.setCsrfRequestAttributeName(null);

        http
            // Session cookies are the authentication mechanism, so CSRF protection is required.
            // The token cookie is readable by JavaScript on purpose: the SPA reads XSRF-TOKEN
            // and echoes it in the X-XSRF-TOKEN header. The session cookie itself stays HttpOnly.
            .csrf(csrf -> csrf
                .csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
                .csrfTokenRequestHandler(csrfHandler)
            )

            .sessionManagement(session -> session
                .sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED)
                // A new session id is issued on login, so a pre-login id cannot be reused.
                .sessionFixation(fixation -> fixation.changeSessionId())
                // Concurrent-session limits are deliberately not configured here. They need a
                // SpringSessionBackedSessionRegistry to work with the JDBC session store, and a
                // limit that silently does nothing is worse than no limit at all.
            )

            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/v1/auth/**").permitAll()
                .requestMatchers("/api/v1/practitioner/registration").permitAll()
                .requestMatchers("/actuator/health", "/actuator/info").permitAll()
                // The compiled frontend. It has to be reachable before login, because it is what
                // renders the login form. It contains no client data — every value on screen is
                // fetched from an endpoint below, and those stay authenticated.
                .requestMatchers(APP_SHELL).permitAll()
                .anyRequest().authenticated()
            )

            // Return 401 as JSON rather than redirecting to a login page: the client is an API
            // consumer, and a 302 to HTML is useless to it.
            .exceptionHandling(handling -> handling
                .authenticationEntryPoint((request, response, ex) ->
                    writeError(response, HttpStatus.UNAUTHORIZED, "Authentication required"))
                .accessDeniedHandler((request, response, ex) ->
                    writeError(response, HttpStatus.FORBIDDEN, "Access denied"))
            )

            .logout(logout -> logout
                .logoutUrl("/api/v1/auth/logout")
                .deleteCookies("JSESSIONID")
                .invalidateHttpSession(true)
                .logoutSuccessHandler((request, response, authentication) ->
                    response.setStatus(HttpStatus.NO_CONTENT.value()))
            )

            // Runs after the CSRF filter so the token exists by the time it is materialised.
            .addFilterAfter(new CsrfCookieFilter(), CsrfFilter.class);

        return http.build();
    }

    /**
     * Exposed so the login endpoint can authenticate programmatically and return JSON.
     * Form login is not used: the client is an SPA, and a 302 to an HTML page is no use to it.
     */
    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration configuration)
            throws Exception {
        return configuration.getAuthenticationManager();
    }

    private void writeError(HttpServletResponse response, HttpStatus status, String message)
            throws java.io.IOException {
        response.setStatus(status.value());
        // Charset stated explicitly. Without it the servlet writer declares ISO-8859-1, which
        // cannot represent a single Greek character — and the messages this application returns
        // are read by Greek-speaking practitioners.
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        objectMapper.writeValue(
            response.getWriter(),
            new ErrorResponse(status.value(), message)
        );
    }
}
