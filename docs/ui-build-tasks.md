# Ivi UI — Build Tasks

The backend exposes 45 endpoints across 10 modules and every MVP feature has a working API behind
it. What follows is the work to put a usable interface on top, ordered so that each block ends
somewhere demonstrable.

The stack is settled: React + TypeScript + Vite under `src/main/frontend`, compiled into the Spring
Boot jar by `gradle-node-plugin`. See [`mvp-build-analysis.md`](./mvp-build-analysis.md) §4a.

---

## The three hard parts

Most of this is ordinary CRUD screens. Three pieces are not, and they should be scheduled with that
in mind rather than discovered late.

**1. Nutrient arithmetic exists twice.** The plan builder computes totals in the browser so the
progress bars respond instantly, and the server recomputes authoritatively on save. If the two
disagree by so much as a rounding step, the number visibly changes when the practitioner saves —
which destroys confidence in every other number on the screen. The Java side is
`shared/util/Nutrients.java`; the TypeScript must mirror it exactly, including "round only at
display". This needs a shared fixture set run against both implementations in CI, not a careful
reading.

**2. The plan builder is the product.** Day → meal → item, live totals, food search, quantity
edits, drag-and-drop reordering, debounced autosave, and 409 handling when the same plan is open on
a laptop and a tablet. It is the screen everything else exists to support and the one that will
take longest.

**3. Charts cannot use the brand palette.** [`ui-palette.md`](./ui-palette.md) measured it: sage
and sand differ by 1.01 in contrast, four of the five sit in one narrow luminance band. They are
fills, not a categorical scale. Measurement charts and the macro progress bars need a separate
scale designed for separation, plus a non-colour channel carrying the same information.

---

## Block 0 — Foundation

Nothing is visible at the end of this, but everything after it depends on it.

- [ ] Scaffold Vite + React + TypeScript under `src/main/frontend`
- [ ] Wire `gradle-node-plugin`: downloaded Node, `npm ci`, output copied to `static/` by
      `processResources`, `inputs`/`outputs` declared so unchanged frontends skip the build
- [ ] `WebMvcConfigurer` forwarding non-`/api`, non-asset paths to `index.html`, so browser routes
      survive a refresh
- [ ] Verify one deployable jar serves both API and UI
- [ ] Design tokens as CSS custom properties from `ui-palette.md`: brand fills, `--ink`,
      `--ink-muted`, `--surface`, semantic colours
- [ ] **Author the neutral grey scale** — warm-tinted, still missing from the palette doc
- [ ] Web font stack with full Greek coverage, including the tonos and dialytika forms. Separate
      question from the PDF font, and the same silent failure mode
- [ ] Decide: data fetching (TanStack Query or bespoke), forms, charts, component library or not

## Block 1 — The API boundary

- [ ] Typed API client. Generate types from the DTOs if practical; hand-write if not
- [ ] **CSRF handling**: read the `XSRF-TOKEN` cookie, echo it as `X-XSRF-TOKEN` on every
      state-changing request. Without this every write returns 403
- [ ] Session bootstrap: `GET /practitioner/me` on load to decide logged-in state
- [ ] Global 401 → redirect to login; 409 → conflict prompt; 429 → the rate-limit message
- [ ] Map the `ErrorResponse` envelope, including field-level `errors`, onto form fields
- [ ] Loading, empty and error states as shared components rather than per screen

## Block 2 — Authentication

- [ ] Login screen (`POST /auth/login`)
- [ ] Registration screen (`POST /practitioner/registration`)
- [ ] Logout (`POST /auth/logout`)
- [ ] Protected routes and a redirect-back-after-login flow
- [ ] Surface the 429 lockout distinctly from wrong credentials — the backend already
      distinguishes them and the message matters to a practitioner who has mistyped

## Block 3 — Clients

- [ ] Client list with search and pagination (`GET /client`)
- [ ] Create and edit forms (`POST`, `PUT /client/{id}`)
- [ ] Client detail shell with tabs: overview, measurements, plans, journal
- [ ] Delete with confirmation

## Block 4 — Measurements

- [ ] Types loaded from `GET /measurement/type`, grouped by category
- [ ] Single entry and **batch entry for a whole visit** (`POST /measurement/batch`) — the batch
      form is the one that saves real time
- [ ] History table (`GET /measurement`)
- [ ] Change chart per type from `GET /measurement/series`, which already returns the deltas
- [ ] Summary card with derived BMI (`GET /measurement/summary`), showing nothing rather than a
      guess when height is unknown
- [ ] Out-of-range indication that is not colour alone

## Block 5 — Nutrition targets

- [ ] Calculator supporting all three entry paths the API accepts: equation, known basal rate, or
      a stated target
- [ ] Activity factor picker seeded from `GET /nutrition/activity-level`, still accepting any value
      in range — practitioners work between the presets
- [ ] Weight-goal input, with the sign convention made obvious in the UI so nobody has to guess
      whether −1.5 means losing
- [ ] Macro split, percentage or per-kilogram coefficients
- [ ] Show the working — basal rate, maintenance, adjustment, target — because the API returns it
      and a practitioner has to explain it to a client

## Block 6 — Food catalogue

- [ ] Browse and search (`GET /food`), filtered by category
- [ ] Custom food form (`POST /food`)
- [ ] **Override editor**: editing a catalogue food creates a private override. The UI must make
      clear that a food is overridden, and offer revert (`DELETE /food/{id}/override`)
- [ ] Suggestion form (`POST /food/{id}/suggestion`) and the practitioner's own suggestions list
- [ ] Portion editor

## Block 7 — The plan builder

The big one. Worth breaking down further before starting.

- [ ] Create plan from a client and a set of targets
- [ ] Day / meal / item tree
- [ ] Food search with debounce, portion picker, quantity
- [ ] Add, edit quantity, rename for print, remove
- [ ] Drag-and-drop reordering (`PUT /plan/{id}/meal/{mealId}/order`)
- [ ] **Live progress bars** — the client-side arithmetic from the top of this document
- [ ] **Shared fixture tests** proving the TypeScript agrees with `Nutrients.java` digit for digit
- [ ] Debounced autosave, with a visible saved/saving state
- [ ] **409 conflict UX**: reload and reapply, not silent overwrite
- [ ] Clear day, plan status transitions
- [ ] Analysis panel: per-day totals, percentage of target, weekly average

## Block 8 — Journal and export

- [ ] Journal list per client, newest first, with content search
- [ ] Entry form, with the entry date defaulting to today but editable for a session written up
      later
- [ ] Amend and delete
- [ ] PDF download (`GET /export/plan/{planId}`), handling the `Content-Disposition` filename

## Block 9 — Quality

- [ ] Vitest for the arithmetic parity fixtures — the highest-value tests in the frontend
- [ ] Component tests for the builder interactions
- [ ] Playwright end-to-end over the real stack. Chromium is already available in the dev
      environment
- [ ] **Greek rendering check in the browser**, mirroring what the PDF work does: assert the text
      is right rather than glance at it
- [ ] Keyboard navigation and focus management, particularly in the builder
- [ ] Contrast verification against the tokens, since the palette fails as text on white
- [ ] Tablet layout — an explicitly supported way of working, not an afterthought

---

## Decisions needed before Block 0 ends

1. **Charting library** — needs to render a time series and small progress bars, and let the
   palette be supplied rather than imposing its own.
2. **Data fetching** — TanStack Query buys caching, retries and invalidation; bespoke keeps the
   dependency list short. The plan builder's autosave makes a real difference here.
3. **Greek copy** — hardcoded now, or an i18n layer from the start? The UI is Greek throughout and
   nothing suggests a second language, but the labels are currently split between the backend
   (`labelEl` on measurement types, Greek meal names in the export service) and the frontend.
   Worth deciding where Greek strings live before they are scattered.
4. **Component library** — bespoke gives full control over a palette that has unusual constraints;
   a library is faster but most ship a colour system this palette does not fit.

---

## Still deferred, still owed

Not UI work, but not finished either, and both were deliberately deferred rather than dismissed:

- **MFA.** Optional MFA reaches roughly a tenth of users; for Article 9 health data it should be
  required. Nothing in the product currently stops a stolen password.
- **Erasure and export per client.** A subject access request or a deletion request currently has
  no answer in the software, and the practitioner is the data controller who has to give one.

Both should land before real client data enters the system, which is to say before the beta takes
its first real practitioner rather than after.
