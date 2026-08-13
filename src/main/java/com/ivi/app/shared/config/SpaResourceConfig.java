package com.ivi.app.shared.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.resource.PathResourceResolver;

import java.io.IOException;
import java.time.Duration;

/**
 * Serves the compiled frontend from the same jar as the API, and makes deep links work.
 *
 * <p>The client routes on paths like {@code /client/42/plan/7}. Those paths mean nothing to
 * Spring — there is no controller behind them — so a reload or a pasted link would 404 without
 * this. The shell is returned instead and the router takes over in the browser.
 *
 * <p>The fallback is deliberately narrow. Two kinds of request must keep producing a real 404:
 *
 * <ul>
 *   <li><strong>Unmatched API paths.</strong> Returning HTML with a 200 to a client that asked
 *       for JSON turns a typo into a parse error somewhere far from the cause, and hides the
 *       404 handling that already exists.</li>
 *   <li><strong>Missing assets.</strong> A request for a script or image that is not there is a
 *       broken build. Answering it with the HTML shell produces a page that half-loads and a
 *       console error that says nothing useful.</li>
 * </ul>
 */
@Configuration
public class SpaResourceConfig implements WebMvcConfigurer {

    private static final String STATIC_ROOT = "classpath:/static/";

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // Vite fingerprints everything under /assets/, so the name changes whenever the content
        // does and the response can be cached indefinitely.
        registry.addResourceHandler("/assets/**")
            .addResourceLocations(STATIC_ROOT + "assets/")
            .setCacheControl(CacheControl.maxAge(Duration.ofDays(365)).immutable());

        // The shell is not fingerprinted — it is what points at the current asset names — so it
        // must be revalidated. A cached index.html is how a browser ends up asking for scripts
        // that the deployed version no longer contains.
        registry.addResourceHandler("/**")
            .addResourceLocations(STATIC_ROOT)
            .setCacheControl(CacheControl.noCache())
            .resourceChain(true)
            .addResolver(new SpaFallbackResolver());
    }

    /** Public so it can be unit-tested; nothing outside this class constructs one. */
    public static class SpaFallbackResolver extends PathResourceResolver {

        /** Widened from protected so the fallback rule can be asserted directly. */
        @Override
        public Resource getResource(String resourcePath, Resource location) throws IOException {
            Resource requested = location.createRelative(resourcePath);
            if (requested.exists() && requested.isReadable()) {
                return requested;
            }
            if (isApiPath(resourcePath) || looksLikeAnAsset(resourcePath)) {
                return null;
            }

            Resource shell = location.createRelative("index.html");
            return shell.exists() && shell.isReadable() ? shell : null;
        }

        /** Paths are relative to the handler, so there is no leading slash here. */
        private boolean isApiPath(String resourcePath) {
            return resourcePath.startsWith("api/") || resourcePath.startsWith("actuator/");
        }

        /**
         * A dot in the last segment means a filename. Client routes are made of identifiers and
         * numbers, so this does not collide with them.
         */
        private boolean looksLikeAnAsset(String resourcePath) {
            int lastSlash = resourcePath.lastIndexOf('/');
            return resourcePath.indexOf('.', lastSlash + 1) >= 0;
        }
    }
}
