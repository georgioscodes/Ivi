package com.ivi.app.shared.unit;

import com.ivi.app.shared.security.ClientAddress;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Who the request came from.
 *
 * <p>This decides the key the login rate limiter counts against and the address written to the
 * audit trail, so a caller who can choose it can both evade the limit and forge the trail. The
 * previous implementation took the leftmost {@code X-Forwarded-For} entry — the one the client
 * writes.
 */
class ClientAddressTest {

    @Test
    void shouldIgnoreTheHeaderEntirely_whenNoProxyIsTrusted() {
        // Given — the default. Nothing in front of the application, so the socket is the truth
        // and a supplied header is a caller trying to be somebody else.
        MockHttpServletRequest request = request("203.0.113.9");
        request.addHeader("X-Forwarded-For", "1.2.3.4");

        assertThat(new ClientAddress(0).of(request)).isEqualTo("203.0.113.9");
    }

    @Test
    void shouldTakeTheClientFromBehindOneTrustedProxy() {
        // Given — a single load balancer, which appends the address it saw
        MockHttpServletRequest request = request("10.0.0.1");
        request.addHeader("X-Forwarded-For", "198.51.100.7");

        assertThat(new ClientAddress(1).of(request)).isEqualTo("198.51.100.7");
    }

    @Test
    void shouldNotBeFooledByAPrependedAddress() {
        // Given — the bypass. The caller writes an address of their own; the trusted proxy appends
        // what it actually saw. Counting from the right is what makes the appended one win.
        MockHttpServletRequest request = request("10.0.0.1");
        request.addHeader("X-Forwarded-For", "1.1.1.1, 198.51.100.7");

        assertThat(new ClientAddress(1).of(request)).isEqualTo("198.51.100.7");
    }

    @Test
    void shouldCountFromTheRightThroughSeveralProxies() {
        MockHttpServletRequest request = request("10.0.0.1");
        request.addHeader("X-Forwarded-For", "spoofed, 198.51.100.7, 10.0.0.9");

        assertThat(new ClientAddress(2).of(request)).isEqualTo("198.51.100.7");
    }

    @Test
    void shouldFallBackToTheSocket_whenTheHeaderIsShorterThanExpected() {
        // Given — fewer hops than there are proxies in front means the header did not arrive the
        // way this deployment is configured to expect, so it cannot be believed
        MockHttpServletRequest request = request("10.0.0.1");
        request.addHeader("X-Forwarded-For", "198.51.100.7");

        assertThat(new ClientAddress(3).of(request)).isEqualTo("10.0.0.1");
    }

    @Test
    void shouldFallBackToTheSocket_whenThereIsNoHeaderAtAll() {
        assertThat(new ClientAddress(1).of(request("10.0.0.1"))).isEqualTo("10.0.0.1");
    }

    @Test
    void shouldFallBackToTheSocket_whenTheChosenEntryIsEmpty() {
        MockHttpServletRequest request = request("10.0.0.1");
        request.addHeader("X-Forwarded-For", "   , 198.51.100.7");

        assertThat(new ClientAddress(2).of(request)).isEqualTo("10.0.0.1");
    }

    @Test
    void shouldTreatANegativeSettingAsNoTrust() {
        // Given — a misconfiguration should fail closed, not index backwards through the list
        MockHttpServletRequest request = request("10.0.0.1");
        request.addHeader("X-Forwarded-For", "1.2.3.4");

        assertThat(new ClientAddress(-2).of(request)).isEqualTo("10.0.0.1");
    }

    private MockHttpServletRequest request(String remoteAddress) {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/auth/login");
        request.setRemoteAddr(remoteAddress);
        return request;
    }
}
