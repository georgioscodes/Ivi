package com.ivi.app.shared.unit;

import com.ivi.app.shared.logging.HttpLoggingProperties;
import com.ivi.app.shared.logging.RequestResponseLoggingFilter;
import com.ivi.app.shared.logging.SensitiveDataMasker;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.util.ReflectionTestUtils;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Filter-level behaviour: which requests are logged at all, whether bodies are captured, how
 * binary and oversized payloads are handled.
 *
 * <p>What masking does to a given field is proven in {@code SensitiveDataMaskerTest}. What this
 * asserts is that the filter routes bodies through the masker at all, and that the structural
 * defences around it hold.
 */
class HttpLoggingRedactionTest {

    private RequestResponseLoggingFilter filter;

    @BeforeEach
    void setUp() {
        filter = new RequestResponseLoggingFilter(
            new HttpLoggingProperties(true, true, 2000, null, null),
            new SensitiveDataMasker());
    }

    @Test
    void shouldApplyTheMasker_toBodiesItLogs() {
        // Given — the per-key rules are proven in SensitiveDataMaskerTest; this checks only
        // that the filter actually routes bodies through it rather than logging them raw.
        String body = "{\"fullName\":\"Ελένη\",\"password\":\"secret-value\"}";

        // When
        String logged = bodyOf(body, "application/json");

        // Then
        assertThat(logged)
            .doesNotContain("Ελένη")
            .doesNotContain("secret-value")
            .contains("[REDACTED]");
    }

    @Test
    void shouldDescribeRatherThanDump_whenTheResponseIsBinary() {
        // Given — a PDF export is around 20 kB of binary
        byte[] pdf = new byte[20_163];

        // When
        String logged = bodyOf(pdf, "application/pdf");

        // Then
        assertThat(logged).isEqualTo("[application/pdf, 20163 bytes]");
    }

    @Test
    void shouldTruncate_whenTheBodyIsLargerThanTheLimit() {
        // Given — a full week's plan response runs to tens of kilobytes of JSON
        String body = "{\"data\":\"" + "x".repeat(5000) + "\"}";

        // When
        String logged = bodyOf(body, "application/json");

        // Then
        assertThat(logged).hasSizeLessThan(2200);
        assertThat(logged).contains("[truncated");
    }

    @Test
    void shouldReturnNothing_whenThereIsNoBody() {
        assertThat(bodyOf(new byte[0], "application/json")).isNull();
        assertThat(bodyOf((byte[]) null, "application/json")).isNull();
    }

    @Test
    void shouldSkipExcludedPaths_soHealthChecksStayOutOfTheStream() {
        // Given
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/actuator/health");

        // When / Then
        assertThat(shouldNotFilter(request)).isTrue();
        assertThat(shouldNotFilter(new MockHttpServletRequest("GET", "/api/v1/client"))).isFalse();
    }

    @Test
    void shouldFilterNothing_whenLoggingIsDisabled() {
        // Given
        RequestResponseLoggingFilter disabled = new RequestResponseLoggingFilter(
            new HttpLoggingProperties(false, false, 2000, null, null),
            new SensitiveDataMasker());

        // When / Then
        assertThat((Boolean) ReflectionTestUtils.invokeMethod(
            disabled, "shouldNotFilter", new MockHttpServletRequest("GET", "/api/v1/client")))
            .isTrue();
    }

    @Test
    void shouldNeverLogAuthBodies_evenWhenBodiesAreEnabled() {
        // Given — bodies are on, which is the dangerous configuration
        MockHttpServletRequest login = new MockHttpServletRequest("POST", "/api/v1/auth/login");
        MockHttpServletRequest registration =
            new MockHttpServletRequest("POST", "/api/v1/practitioner/registration");
        MockHttpServletRequest client = new MockHttpServletRequest("POST", "/api/v1/client");

        // When / Then
        assertThat(bodyAllowedFor(login)).isFalse();
        assertThat(bodyAllowedFor(registration)).isFalse();
        assertThat(bodyAllowedFor(client)).isTrue();
    }

    private String bodyOf(String body, String contentType) {
        return bodyOf(body.getBytes(StandardCharsets.UTF_8), contentType);
    }

    private String bodyOf(byte[] content, String contentType) {
        return ReflectionTestUtils.invokeMethod(filter, "bodyOf", content, contentType);
    }

    private boolean bodyAllowedFor(MockHttpServletRequest request) {
        return Boolean.TRUE.equals(
            ReflectionTestUtils.invokeMethod(filter, "bodyAllowedFor", request));
    }

    private boolean shouldNotFilter(MockHttpServletRequest request) {
        return Boolean.TRUE.equals(
            ReflectionTestUtils.invokeMethod(filter, "shouldNotFilter", request));
    }
}
