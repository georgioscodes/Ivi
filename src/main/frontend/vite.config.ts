/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// The build output lands in the Gradle build directory, not in src/main/resources. Generated
// files under src/ get committed by accident and go stale; processResources copies them onto
// the classpath instead. See build.gradle.kts.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    outDir: fileURLToPath(new URL('../../../build/frontend', import.meta.url)),
    emptyOutDir: true,
    // Named for the compliance conversation rather than for debugging: source maps of an
    // Article 9 application are shipped to every browser that asks. Turn on locally if needed.
    sourcemap: false,
  },
  test: {
    // happy-dom rather than jsdom: these tests need document.cookie, fetch and URL, and it is
    // the faster of the two by a wide margin for that much.
    environment: 'happy-dom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
  server: {
    port: 5173,
    proxy: {
      // Dev server talks to the real Spring Boot application, so session cookies, CSRF and
      // the 401/403/409 handling are exercised the same way in development as in the jar.
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: false,
      },
    },
  },
});
