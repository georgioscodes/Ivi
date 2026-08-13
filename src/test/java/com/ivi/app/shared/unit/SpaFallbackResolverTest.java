package com.ivi.app.shared.unit;

import com.ivi.app.shared.config.SpaResourceConfig;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.core.io.AbstractResource;
import org.springframework.core.io.Resource;

import java.io.IOException;
import java.io.InputStream;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Which requests get the SPA shell and which get a 404.
 *
 * <p>The interesting cases are the ones that must <em>not</em> fall back: a mistyped API path
 * answered with HTML looks to the client like a JSON parse failure somewhere unrelated, and a
 * missing bundle answered with HTML produces a page that half-loads with nothing in the log to
 * say why.
 */
class SpaFallbackResolverTest {

    /** What the built frontend actually puts on the classpath. */
    private static final Set<String> ON_DISK =
        Set.of("index.html", "favicon.svg", "assets/index-abc123.js", "assets/index-abc123.css");

    private SpaResourceConfig.SpaFallbackResolver resolver;
    private Resource location;

    @BeforeEach
    void setUp() {
        resolver = new SpaResourceConfig.SpaFallbackResolver();
        location = new FakeStaticRoot("");
    }

    @ParameterizedTest(name = "{0}")
    @ValueSource(strings = {"index.html", "favicon.svg", "assets/index-abc123.js"})
    void shouldServeAFileThatExists(String path) throws IOException {
        // When
        Resource resolved = resolver.getResource(path, location);

        // Then
        assertThat(resolved).isNotNull();
        assertThat(resolved.getFilename()).isEqualTo(path.substring(path.lastIndexOf('/') + 1));
    }

    @ParameterizedTest(name = "{0}")
    @ValueSource(strings = {
        "client",
        "client/42",
        "client/42/plan/7",
        "plan/7/day/3/meal/breakfast",
        "login",
    })
    void shouldFallBackToTheShell_forClientRoutes(String path) throws IOException {
        // Given — no controller and no file behind any of these; the router owns them

        // When
        Resource resolved = resolver.getResource(path, location);

        // Then — a reload or a pasted link has to work
        assertThat(resolved).isNotNull();
        assertThat(resolved.getFilename()).isEqualTo("index.html");
    }

    @ParameterizedTest(name = "{0}")
    @ValueSource(strings = {"api/v1/client", "api/v1/typo", "actuator/metrics"})
    void shouldNotFallBack_forApiPaths(String path) throws IOException {
        // When / Then — HTML with a 200 would turn a wrong URL into a parse error far from
        // its cause, and would bypass the 404 handling that already exists
        assertThat(resolver.getResource(path, location)).isNull();
    }

    @ParameterizedTest(name = "{0}")
    @ValueSource(strings = {
        "assets/index-stale-hash.js",
        "assets/missing.css",
        "logo.png",
        "fonts/inter.woff2",
    })
    void shouldNotFallBack_forAMissingAsset(String path) throws IOException {
        // When / Then — a missing bundle is a broken build. Answering with the shell produces a
        // page that half-loads and a console message that explains nothing.
        assertThat(resolver.getResource(path, location)).isNull();
    }

    @Test
    void shouldTreatOnlyTheLastSegmentAsAFilename() throws IOException {
        // Given — a route segment can legitimately contain a dot; a filename is the last one
        // having an extension, not any dot anywhere in the path
        Resource resolved = resolver.getResource("client/v1.2/plan", location);

        // Then
        assertThat(resolved).isNotNull();
        assertThat(resolved.getFilename()).isEqualTo("index.html");
    }

    @Test
    void shouldReturnNothing_whenTheFrontendWasNeverBuilt() throws IOException {
        // Given — a jar built without the frontend, which is what a misconfigured
        // processResources produces
        Resource empty = new FakeStaticRoot("") {
            @Override
            public Resource createRelative(String relativePath) {
                return new FakeStaticRoot(relativePath) {
                    @Override
                    public boolean exists() {
                        return false;
                    }
                };
            }
        };

        // When / Then — a 404 rather than an exception on every page load
        assertThat(resolver.getResource("client/42", empty)).isNull();
    }

    /**
     * Stands in for {@code classpath:/static/}. A real ClassPathResource would need the built
     * frontend present, which would make this test pass or fail on whether Vite had run.
     *
     * <p>Only existence, readability and name matter here — the resolver decides what to return
     * and leaves opening it to the handler.
     */
    private static class FakeStaticRoot extends AbstractResource {

        private final String path;

        FakeStaticRoot(String path) {
            this.path = path;
        }

        @Override
        public Resource createRelative(String relativePath) {
            return new FakeStaticRoot(relativePath);
        }

        @Override
        public boolean exists() {
            return ON_DISK.contains(path);
        }

        @Override
        public String getFilename() {
            return path.substring(path.lastIndexOf('/') + 1);
        }

        @Override
        public String getDescription() {
            return "fake static root: " + path;
        }

        @Override
        public InputStream getInputStream() {
            throw new UnsupportedOperationException("The resolver never opens the resource");
        }
    }
}
