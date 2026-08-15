package com.ivi.app.shared.integration;

import com.ivi.app.shared.test.CsrfTokens;
import com.ivi.app.shared.test.TestcontainersConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(TestcontainersConfig.class)
class IviApplicationIntegrationTest {

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private DataSource dataSource;

    @LocalServerPort
    private int port;

    @Test
    void shouldReportHealthy_whenTheApplicationIsRunning() {
        // When
        ResponseEntity<String> response = restTemplate.getForEntity("/actuator/health", String.class);

        // Then
        assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
        assertThat(response.getBody()).contains("UP");
    }

    @Test
    void shouldHaveAppliedMigrations_whenTheContextStarts() throws Exception {
        // Given / When
        try (Connection connection = dataSource.getConnection();
             Statement statement = connection.createStatement();
             ResultSet rs = statement.executeQuery(
                 "SELECT COUNT(*) FROM flyway_schema_history WHERE success = true")) {

            // Then
            assertThat(rs.next()).isTrue();
            assertThat(rs.getInt(1)).isPositive();
        }
    }

    @Test
    void shouldReturnACorrelationId_whenNoneIsSupplied() {
        // When
        ResponseEntity<String> response = restTemplate.getForEntity("/actuator/health", String.class);

        // Then
        assertThat(response.getHeaders().getFirst("X-Correlation-Id")).isNotBlank();
    }

    @Test
    void shouldEchoTheSuppliedCorrelationId_whenOneIsProvided() {
        // Given
        String supplied = "test-correlation-id";

        // When
        ResponseEntity<String> response = restTemplate.exchange(
            org.springframework.http.RequestEntity
                .get("http://localhost:" + port + "/actuator/health")
                .header("X-Correlation-Id", supplied)
                .build(),
            String.class);

        // Then
        assertThat(response.getHeaders().getFirst("X-Correlation-Id")).isEqualTo(supplied);
    }

    /**
     * An unknown path with no file extension is a client route, not a missing page: the router
     * runs in the browser, so the server cannot know whether {@code /client/42/plan/7} is real.
     * The shell is returned and the client decides. This test asserted a 404 here, which described
     * the application before {@code SpaResourceConfig} existed.
     */
    @Test
    void shouldServeTheAppShell_whenThePathIsAClientRoute() {
        // When
        ResponseEntity<String> response = restTemplate.getForEntity("/no-such-path", String.class);

        // Then
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).contains("<div id=\"root\">");
    }

    /**
     * The fallback deliberately excludes {@code /api}, and authentication is checked before
     * routing — so an unknown endpoint answers 401 rather than disclosing whether it exists. What
     * matters here is the negative: it is never the HTML shell, which would turn a typo into a
     * parse error far from its cause. The resolver's own rules are covered by
     * {@code SpaFallbackResolverTest}; this asserts the wiring end to end.
     */
    @Test
    void shouldNotServeTheAppShell_whenAnApiPathMatchesNoHandler() {
        // When
        ResponseEntity<String> response =
            restTemplate.getForEntity("/api/v1/no-such-endpoint", String.class);

        // Then
        assertThat(response.getStatusCode().value()).isEqualTo(401);
        assertThat(response.getBody()).doesNotContain("<div id=\"root\">");
    }

    @Test
    void shouldReturn404_whenAnAssetIsMissing() {
        // When — a dot in the last segment means a filename, and a missing file is a broken build
        ResponseEntity<String> response =
            restTemplate.getForEntity("/no-such-bundle.js", String.class);

        // Then
        assertThat(response.getStatusCode().value()).isEqualTo(404);
    }

    /**
     * CSRF protection runs in the filter chain, ahead of the dispatcher, so a token is needed
     * before the request gets far enough to be rejected for its <em>method</em>. Without one this
     * asserts 403 and proves nothing about 405 handling.
     */
    @Test
    void shouldReturn405_whenTheMethodIsNotSupported() {
        // Given
        HttpHeaders headers = CsrfTokens.headersFor(CsrfTokens.prime(restTemplate));
        headers.setContentType(MediaType.APPLICATION_JSON);

        // When
        ResponseEntity<String> response = restTemplate.exchange(
            "/actuator/health", HttpMethod.POST, new HttpEntity<>("{}", headers), String.class);

        // Then
        assertThat(response.getStatusCode().value()).isEqualTo(405);
    }

    @Test
    void shouldReturn403_whenAWriteCarriesNoCsrfToken() {
        // When
        ResponseEntity<String> response =
            restTemplate.postForEntity("/actuator/health", "{}", String.class);

        // Then — the protection that made the previous test's original form misleading
        assertThat(response.getStatusCode().value()).isEqualTo(403);
    }
}
