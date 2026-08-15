package com.ivi.app.client.integration;

import com.ivi.app.practitioner.dto.PractitionerRegisterRequest;
import com.ivi.app.practitioner.repository.PractitionerRepository;
import com.ivi.app.practitioner.service.PractitionerService;
import com.ivi.app.shared.test.CsrfTokens;
import com.ivi.app.shared.test.TestcontainersConfig;
import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The suite that matters most in this codebase.
 *
 * <p>Tenant isolation is the one failure with catastrophic consequences: leaking one
 * practitioner's client health records to another. These tests exist to attempt exactly that,
 * from the outside, over HTTP, as a second practitioner would.
 *
 * <p>Every cross-tenant attempt must produce <strong>404, not 403</strong>. A 403 confirms the
 * record exists, which lets a caller enumerate another practice's clients by probing ids.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(TestcontainersConfig.class)
class ClientTenantIsolationTest {

    private static final String PASSWORD = "a-sufficiently-long-password";

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private PractitionerService practitionerService;

    @Autowired
    private PractitionerRepository practitionerRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private HttpHeaders alice;
    private HttpHeaders bob;
    private Long aliceClientId;

    /**
     * Clears the tenant root and everything hanging off it.
     *
     * <p>{@code practitionerRepository.deleteAll()} on its own is not enough and fails outright:
     * the clients these tests create, and the audit rows their reads produce, both reference the
     * practitioner, so the second test in the class hits a foreign key violation before it starts.
     * CASCADE follows those references wherever they lead, which keeps this correct as modules are
     * added rather than needing a delete order maintained by hand.
     */
    @BeforeEach
    void setUp() {
        jdbcTemplate.execute("TRUNCATE TABLE practitioner CASCADE");

        practitionerService.register(new PractitionerRegisterRequest(
            "alice@example.gr", PASSWORD, "Alice", "Alice Nutrition"));
        practitionerService.register(new PractitionerRegisterRequest(
            "bob@example.gr", PASSWORD, "Bob", "Bob Nutrition"));

        alice = login("alice@example.gr");
        bob = login("bob@example.gr");

        aliceClientId = createClient(alice, "Maria Papadopoulou");
    }

    @Test
    void shouldReturn404_whenReadingAnotherPractitionersClient() {
        // When — Bob asks for a client id that exists, but belongs to Alice
        ResponseEntity<String> response = restTemplate.exchange(
            "/api/v1/client/" + aliceClientId, HttpMethod.GET, new HttpEntity<>(bob), String.class);

        // Then — indistinguishable from an id that does not exist at all
        assertThat(response.getStatusCode().value()).isEqualTo(404);
        assertThat(response.getBody()).doesNotContain("Maria");
    }

    @Test
    void shouldReturn404_whenUpdatingAnotherPractitionersClient() {
        // Given
        String body = """
            {"fullName":"Renamed By Bob"}
            """;

        // When
        ResponseEntity<String> response = restTemplate.exchange(
            "/api/v1/client/" + aliceClientId, HttpMethod.PUT,
            new HttpEntity<>(body, json(bob)), String.class);

        // Then
        assertThat(response.getStatusCode().value()).isEqualTo(404);

        // And the record is untouched
        ResponseEntity<JsonNode> asAlice = restTemplate.exchange(
            "/api/v1/client/" + aliceClientId, HttpMethod.GET,
            new HttpEntity<>(alice), JsonNode.class);
        assertThat(asAlice.getBody().get("fullName").asText()).isEqualTo("Maria Papadopoulou");
    }

    @Test
    void shouldReturn404_whenDeletingAnotherPractitionersClient() {
        // When
        ResponseEntity<String> response = restTemplate.exchange(
            "/api/v1/client/" + aliceClientId, HttpMethod.DELETE,
            new HttpEntity<>(bob), String.class);

        // Then
        assertThat(response.getStatusCode().value()).isEqualTo(404);

        // And the record still exists for its owner
        ResponseEntity<String> asAlice = restTemplate.exchange(
            "/api/v1/client/" + aliceClientId, HttpMethod.GET,
            new HttpEntity<>(alice), String.class);
        assertThat(asAlice.getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void shouldNotListAnotherPractitionersClients_whenListing() {
        // Given
        createClient(bob, "Bob Own Client");

        // When
        ResponseEntity<JsonNode> response = restTemplate.exchange(
            "/api/v1/client", HttpMethod.GET, new HttpEntity<>(bob), JsonNode.class);

        // Then
        JsonNode content = response.getBody().get("content");
        assertThat(content).hasSize(1);
        assertThat(content.get(0).get("fullName").asText()).isEqualTo("Bob Own Client");
    }

    @Test
    void shouldNotFindAnotherPractitionersClients_whenSearchingByName() {
        // When — Bob searches for a name only Alice's client has
        ResponseEntity<JsonNode> response = restTemplate.exchange(
            "/api/v1/client?name=Maria", HttpMethod.GET, new HttpEntity<>(bob), JsonNode.class);

        // Then
        assertThat(response.getBody().get("content")).isEmpty();
    }

    @Test
    void shouldRejectTheRequest_whenNotAuthenticated() {
        // When
        ResponseEntity<String> response =
            restTemplate.getForEntity("/api/v1/client/" + aliceClientId, String.class);

        // Then
        assertThat(response.getStatusCode().value()).isEqualTo(401);
    }

    @Test
    void shouldIgnoreAPractitionerIdSuppliedInTheRequestBody_whenCreating() {
        // Given — a caller attempting to plant a client in Alice's account
        Long aliceId = practitionerRepository.findByEmail("alice@example.gr").orElseThrow().getId();
        String body = """
            {"fullName":"Planted","practitionerId":%d}
            """.formatted(aliceId);

        // When — sent by Bob
        restTemplate.exchange("/api/v1/client", HttpMethod.POST,
            new HttpEntity<>(body, json(bob)), String.class);

        // Then — it landed in Bob's account, because the tenant comes from the session only
        ResponseEntity<JsonNode> asAlice = restTemplate.exchange(
            "/api/v1/client", HttpMethod.GET, new HttpEntity<>(alice), JsonNode.class);
        assertThat(asAlice.getBody().get("content")).hasSize(1);
        assertThat(asAlice.getBody().get("content").get(0).get("fullName").asText())
            .isEqualTo("Maria Papadopoulou");
    }

    /**
     * Signs in and returns everything a subsequent request needs: the session cookie, and the CSRF
     * token in both places Spring compares it.
     *
     * <p>Login is itself a state-changing POST, so it needs a token of its own before it will be
     * accepted — hence the priming request. The token is re-read from the login response in case
     * it was rotated, rather than assumed to survive.
     */
    private HttpHeaders login(String email) {
        String csrfToken = CsrfTokens.prime(restTemplate);

        HttpHeaders headers = CsrfTokens.headersFor(csrfToken);
        headers.setContentType(MediaType.APPLICATION_JSON);

        ResponseEntity<String> response = restTemplate.postForEntity(
            "/api/v1/auth/login",
            new HttpEntity<>("""
                {"email":"%s","password":"%s"}
                """.formatted(email, PASSWORD), headers),
            String.class);

        assertThat(response.getStatusCode().value())
            .as("login for %s", email)
            .isEqualTo(200);

        List<String> cookies = response.getHeaders().get(HttpHeaders.SET_COOKIE);
        assertThat(cookies).isNotNull();

        String currentToken = CsrfTokens.issuedBy(response).orElse(csrfToken);

        HttpHeaders authenticated = new HttpHeaders();
        cookies.stream()
            .map(cookie -> cookie.split(";", 2)[0])
            .filter(cookie -> !cookie.startsWith(CsrfTokens.COOKIE_NAME + "="))
            .forEach(cookie -> authenticated.add(HttpHeaders.COOKIE, cookie));

        authenticated.add(HttpHeaders.COOKIE, CsrfTokens.COOKIE_NAME + "=" + currentToken);
        authenticated.add(CsrfTokens.HEADER_NAME, currentToken);
        return authenticated;
    }

    private HttpHeaders json(HttpHeaders base) {
        HttpHeaders headers = new HttpHeaders();
        headers.addAll(base);
        headers.setContentType(MediaType.APPLICATION_JSON);
        return headers;
    }

    private Long createClient(HttpHeaders headers, String fullName) {
        ResponseEntity<JsonNode> response = restTemplate.exchange(
            "/api/v1/client", HttpMethod.POST,
            new HttpEntity<>("""
                {"fullName":"%s"}
                """.formatted(fullName), json(headers)),
            JsonNode.class);

        assertThat(response.getStatusCode().value()).isEqualTo(201);
        return response.getBody().get("id").asLong();
    }
}
