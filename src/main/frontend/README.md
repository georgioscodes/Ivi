# Ivi frontend

React + TypeScript + Vite. Compiled into the Spring Boot jar rather than deployed separately, so
the UI and the API it talks to are always the same version.

## Working on it

Two processes. The backend first:

```
./gradlew bootRun          # http://localhost:8080
```

then the Vite dev server, which proxies `/api` to it:

```
cd src/main/frontend
npm install
npm run dev                # http://localhost:5173
```

Use `:5173` while developing — it has hot module replacement, and because `/api` is proxied to the
real backend on the same origin, session cookies and CSRF behave exactly as they do in the jar.

## Building

`./gradlew build` compiles the frontend as part of the normal build; there is nothing extra to run.
Node is downloaded and pinned by `gradle-node-plugin`, so the version on your PATH is irrelevant.
The Vite output lands in `build/frontend` and `processResources` copies it to `static/` on the
classpath. An unchanged frontend is skipped, so backend-only builds do not pay for it.

`./gradlew check` runs `tsc --noEmit`. Vite strips types without checking them, so nothing else
would catch a type error before it reached a browser.

## Two rules worth knowing before you write anything

**Every number on screen comes from the server.** Not a total, not a percentage, not an average.
The browser renders what the API returned and computes nothing. Nutrient arithmetic exists once,
in Java. See `docs/mvp-build-analysis.md` §1.1 for why, and `docs/ui-build-tasks.md` for what
follows from it.

**The brand colours are fills, never ink, and never a way to encode a category.** Sage and sand
differ by 1.01 in contrast. `docs/ui-palette.md` has the measurements; `src/styles/tokens.css` has
the tokens that respect them.
