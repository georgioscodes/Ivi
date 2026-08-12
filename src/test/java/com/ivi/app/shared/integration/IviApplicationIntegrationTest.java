package com.ivi.app.shared.integration;

import com.ivi.app.shared.test.TestcontainersConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.context.annotation.Import;
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

    @Test
    void shouldReturn404_whenThePathMatchesNoHandler() {
        // When
        ResponseEntity<String> response = restTemplate.getForEntity("/no-such-path", String.class);

        // Then
        assertThat(response.getStatusCode().value()).isEqualTo(404);
        assertThat(response.getBody()).contains("Resource not found");
    }

    @Test
    void shouldReturn405_whenTheMethodIsNotSupported() {
        // When
        ResponseEntity<String> response =
            restTemplate.postForEntity("/actuator/health", "{}", String.class);

        // Then
        assertThat(response.getStatusCode().value()).isEqualTo(405);
    }
}
