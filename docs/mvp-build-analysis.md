# Ivi MVP — Backend Build Analysis

Scope: the 10 MVP features in [`ivi-feature-roadmap.md`](./ivi-feature-roadmap.md), on a Java
Spring Boot monolith.

Conventions are fixed by the two skills in `.claude/skills/`: feature-based modules with six
internal layers, record DTOs, manual static mappers, entities never leaving their module,
inter-module calls through services only, centralized exception handling, paginated collections —
and a three-layer test pyramid. Everything below assumes those and does not restate them.

---

## 1. The three decisions that shape everything else

Most of this build is ordinary CRUD. Three decisions are not, and getting them wrong is expensive
to reverse. Settle these before writing the first module.

### 1.1 Real-time progress bars are a frontend computation, not an API call

Feature #5 updates energy and macro totals as the practitioner adds foods and adjusts quantities.
This is the product's core interaction and its stated competitive wedge — it has to feel instant.

A server round-trip per quantity change will not. A plan edit session involves hundreds of small
adjustments; at 50–150 ms per call the builder feels like wading.

**Recommendation.** When a food is added to a plan, the API returns that food's full nutrient
vector per 100 g along with its portion definitions. The browser holds the working plan in memory
and recomputes totals locally on every change. Persistence is debounced (~1 s) or explicit.
The server recomputes authoritatively on save and returns the canonical totals.

Consequences to accept up front:
- Nutrient arithmetic exists **twice** — TypeScript and Java. Rounding must agree exactly.
  Pin the rules once (below) and write the same fixture set against both.
- The `PlanItem` payload carries nutrients, so it is fatter than a normal reference DTO. Fine.
- The server is the source of truth. The client's number is a preview; a mismatch on save is a bug
  to surface, not to silently reconcile.

### 1.2 Split the nutrient model: macros as columns, micronutrients as rows

Food data arrives from several sources — an exchange table, a national composition table, USDA —
with different nutrient coverage per source. Two obvious models, both wrong on their own:

| Model | Problem |
|---|---|
| One wide column per nutrient (~40 columns) | Rigid. Every new nutrient is a migration, and most are null for most foods. |
| Fully EAV (`food_nutrient` rows for everything) | Every progress-bar recompute becomes a multi-row join over the hottest path in the product. |

**Recommendation — hybrid.** The four values needed on every single interaction (energy, protein,
carbohydrate, fat) are columns on `food`. Everything else lives in `food_nutrient` as
`(food_id, nutrient_id, amount_per_100g)`.

This is not a compromise, it is a read-pattern match: MVP touches only the four columns, and
Phase 2 micronutrient tracking (#28) reads the row table for a *selected handful* of nutrients —
never all of them at once. Both paths stay fast, and adding a nutrient stays a data change.

### 1.3 Multi-tenancy on day one, enforced structurally

Every practitioner sees only their own clients. Retrofitting isolation onto a schema that assumed a
single tenant is one of the more painful migrations in this kind of product, and the failure mode
is leaking one practitioner's client health records to another.

**Recommendation.** `practitioner_id` on every tenant-owned table. Do **not** rely on Hibernate
filters alone — a filter that is silently not applied fails open. Instead:

- Every repository method that reads tenant data takes `practitionerId` explicitly. No
  `findById(id)` on tenant-owned entities; only `findByIdAndPractitionerId(id, practitionerId)`.
- The tenant id comes from the security context in the service layer, never from the request body
  or a path variable.
- Add an ArchUnit test asserting that no repository on a tenant-owned entity exposes a finder
  lacking a `practitionerId` parameter. This is the enforcement that survives new developers.

Failing closed is worth the verbosity here.

---

## 2. Module map

Nine modules plus `shared`. Feature-based, per the clean-code skill.

| Module | Owns | Notes |
|---|---|---|
| `practitioner` | Account, credentials, practice profile, logo | The tenant root. |
| `client` | Client record, tags, goals, contact details | Feature #6. |
| `measurement` | Anthropometric entries, value history | Feature #7. |
| `food` | Foods, nutrients, portions, source tables | Feature #2. Read-heavy, effectively reference data. |
| `nutrition` | BMR equations, activity multipliers, macro splits | Features #3, #4. **Service + DTO only** — no entity, no repository. Pure calculation. |
| `plan` | Plan, days, meals, items, targets | Features #1, #4, #5. The largest and most complex module. |
| `journal` | Session notes per client | Feature #10. Genuinely small. |
| `export` | PDF rendering | Feature #8. Consumes plan and practitioner DTOs. |
| `shared` | Config, security, exception handling, `PagedResponse`, correlation-id filter | Per the skill. |

Two things worth noting about this map:

**`nutrition` has no persistence layer.** The clean-code skill says omit layers a module does not
need. Energy calculation is a pure function of inputs; the *results* are persisted by `plan` as
targets. Keeping the equations in their own module makes them trivially unit-testable and keeps
`plan` from swelling further.

**`export` is a module, not a utility.** It has real logic — template selection, layout, shopping
list derivation — and Phase 1 #26 grows it substantially. Starting it as a helper class in `plan`
guarantees a painful extraction later.

---

## 3. Data model — the parts that need thought

Standard CRUD tables (`practitioner`, `client`, `journal_entry`) are omitted; they are unremarkable.

### 3.1 Food, portions, nutrients

```
food                  id, source_table, name_el, name_en, category,
                      energy_kcal, protein_g, carbohydrate_g, fat_g   -- per 100g
food_portion          id, food_id, label_el, grams, is_default
nutrient              id, code, name_el, unit, display_order
food_nutrient         food_id, nutrient_id, amount_per_100g
```

**`food_portion` is the piece most likely to be missed.** Practitioners work in natural units —
one egg, three crackers, a slice — not grams. Without a portion table the builder either forces
gram entry (unusable) or hardcodes conversions (unmaintainable). Every food needs at least one
portion, and `grams` is what the arithmetic actually runs on.

`source_table` matters because the same food appears in multiple sources with different values.
The practitioner chooses a source; the plan must record which one was used, or a plan's numbers
become unreproducible.

### 3.2 Plan aggregate

```
plan                  id, client_id, practitioner_id, name, status,
                      target_kcal, target_protein_g, target_carb_g, target_fat_g,
                      bmr_equation, activity_factor, version
plan_day              id, plan_id, day_index, label_override
plan_meal             id, plan_day_id, meal_type, sort_order, time_label
plan_item             id, plan_meal_id, food_id, portion_id, quantity,
                      name_override, sort_order,
                      energy_kcal, protein_g, carbohydrate_g, fat_g   -- snapshot
```

Two deliberate choices:

**Nutrients are snapshotted onto `plan_item`.** A plan issued to a client is a clinical document.
If the food database is corrected next month, last month's plan must not silently change. Storing
computed values at insert time makes plans immutable records rather than live queries. The cost is
denormalization; the benefit is that a printed PDF always matches what the system shows.

**`version` for optimistic locking.** The builder is a long editing session, and the same
practitioner may have it open on a laptop and a tablet — explicitly supported by feature #9.
Last-write-wins silently discards work here.

**Loading a full week is an N+1 trap.** Plan → 7 days → ~5 meals → ~4 items is ~140 rows across
four levels. Use an `@EntityGraph` or an explicit fetch join; verify with a query-count assertion
in the `@DataJpaTest` layer so a lazy-loading regression fails a test rather than a demo.

### 3.3 Rounding, fixed once

`BigDecimal` throughout — never `double`. Floating-point drift across hundreds of additions is
visible to the user and destroys trust in the totals.

- Nutrient amounts stored at 2 decimal places, `HALF_UP`.
- Energy displayed as a whole number; macros to 1 decimal.
- Round **only at display**, never between accumulation steps.

Write this set of rules into a single `shared` utility and mirror it exactly in the frontend.
This is the contract that keeps §1.1's two implementations agreeing.

---

## 4. Cross-cutting concerns

### 4.1 This is special-category health data

Client records hold weight, body composition, blood markers and clinical notes. Under GDPR
Article 9 that is special-category personal data, and the practitioner is the controller. This is a
legal requirement, not a hardening nicety, and it constrains the MVP:

- TLS in transit; encryption at rest at minimum at the volume level.
- Audit trail of access to client records — who read what, when.
- Export and erasure per client, since data-subject requests land on the practitioner who then
  needs the software to answer them.
- Backups encrypted, with a stated retention period.
- If hosting is outside the practitioner's jurisdiction, that needs saying in the contract.

Deferring erasure and export to a later phase is defensible only if the MVP is a closed pilot with
an agreement in place. Say so explicitly if that is the plan.

### 4.2 Authentication

Session cookies over JWT for the MVP. A single-audience browser client gains nothing from bearer
tokens, and server-side sessions are revocable immediately — which matters when the thing being
protected is health data on a shared or hotel computer, an access pattern feature #9 explicitly
invites. `HttpOnly`, `Secure`, `SameSite=Lax`, short idle timeout.

### 4.3 PDF generation and Greek text

Use HTML → PDF via **openhtmltopdf** with Thymeleaf templates, not programmatic drawing.

Phase 1 #26 turns the print layout into a user-configurable artifact — colors, fonts, borders,
toggled sections, renamed labels. Parameterizing a Thymeleaf template is straightforward;
parameterizing imperative PDF drawing code is not. Choosing the templating route now is what makes
that feature affordable later.

**Embed a font with full Greek coverage** (DejaVu Sans, Noto Sans) and register it explicitly. The
PDF base-14 fonts do not cover Greek, and the failure mode is silent — blank glyphs or mojibake in
the client-facing deliverable, often noticed only in production.

### 4.4 Reference data loading

The food tables are bulk reference data, not user data. Load via a Flyway repeatable migration or a
startup importer reading a versioned CSV, with the source and its version recorded. Nutrition data
gets corrected over time and you need to know which revision a given plan was built against.

**USDA FoodData Central: download, do not scrape.** FDC publishes full bulk exports in CSV and JSON
and a free REST API. The data is US Government work in the public domain (CC0 1.0). Scraping would
be slower, more fragile and would gain nothing.

| Dataset | Take it? | Why |
|---|---|---|
| **SR Legacy** | Yes | Generic whole foods with broad nutrient coverage. Final release 2018 — stable, which is a virtue for reference data. |
| **Foundation Foods** | Yes | Actively maintained, updated roughly semi-annually, with sampling provenance. |
| **FNDDS (Survey)** | Maybe | Mixed dishes as consumed. Useful for composite foods; US recipes. |
| **Branded** | No | ~600k manufacturer products, US retail, label-derived and noisy. It is also the one dataset sourced through a manufacturer partnership rather than authored by USDA, so its terms deserve a closer read if it is ever wanted. |

Use the **bulk download for ingestion**; the API is rate-limited and intended for lookup, not for
loading a database.

Two integration notes: FDC nutrients carry their own identifiers and units, so an explicit mapping
into the local `nutrient` table is required rather than a direct import; and portion data
(`food_portion`) is present but uneven, so expect to author portions for high-traffic foods by hand.

**This does not close the food data risk.** USDA supplies a nutrient backbone in English for US
foods. It does not supply Greek foods, Greek names, or the exchange-list groupings the builder
categorizes by. That localized layer remains the product's real asset and still has to be sourced
or authored. Treat USDA as the substrate, not the solution.

---

## 4a. Frontend stack and single-artifact packaging

Requirement: frontend and backend ship as one deployable. Constraint: §1.1 puts real nutrient
arithmetic in the browser, so the plan builder needs genuine client-side state.

**Recommendation: React + TypeScript + Vite, compiled into the Spring Boot jar.**

The frontend build runs as part of the Maven build (`frontend-maven-plugin`, or
`gradle-node-plugin` on Gradle): `npm ci && npm run build`, with Vite's output written to
`target/classes/static/`. Spring Boot serves it from the same jar. One artifact, one version, one
deploy.

Two pieces of wiring are needed:

- **SPA fallback routing.** A `WebMvcConfigurer` forwards any non-`/api`, non-asset path to
  `index.html` so browser-side routes survive a page refresh. Keep the API under a distinct prefix
  so the rule stays unambiguous.
- **A build profile.** Put the npm steps behind a Maven profile so an ordinary backend compile does
  not pay for a frontend build. Enable it in CI and for release builds.

In development, run the Vite dev server with a proxy to `:8080` — hot reload while developing, a
single bundled artifact when packaging.

**This choice reinforces §4.2.** Serving the UI from the same origin as the API means session
cookies work with no CORS configuration and no token sitting in `localStorage` — a real security
gain when the payload is health data.

Accept one tradeoff knowingly: a frontend-only fix requires redeploying the whole application. For
a single-team product this is a fair price for never having a version skew between UI and API.

### Alternatives considered

| Option | Verdict |
|---|---|
| **Thymeleaf + HTMX** | Strong for the CRUD screens — clients, measurements, journal — and pleasant in a Java-centric team. Poor for the plan builder, which is the one screen needing local state and per-interaction recompute. A hybrid (Thymeleaf everywhere, a JS island for the builder) is defensible if frontend capacity is scarce, at the cost of two paradigms and two build paths. |
| **Vaadin** | Java-only and genuinely single-artifact, but every interaction round-trips to the server. That is precisely what §1.1 exists to avoid. Rejected on the product's core interaction. |
| **Separate frontend deployment** (static host or nginx, API separate) | The conventional split, and ruled out by the single-artifact requirement. Worth revisiting only if the client mobile app (#27) later makes the API a genuinely public interface. |

---

## 5. Suggested build order

Each step ends somewhere demonstrable.

| Step | Delivers | Depends on |
|---|---|---|
| 0 | Project skeleton, Postgres + Flyway, Testcontainers config, `shared` (exception handler, `PagedResponse`, correlation filter), CI | — |
| 1 | `practitioner` + authentication + tenant plumbing and its ArchUnit guard | 0 |
| 2 | `client` CRUD, tags, list and search | 1 |
| 3 | `food`: schema, importer, search endpoint, portions | 0 |
| 4 | `nutrition`: BMR equations, activity factors, macro split — pure unit-tested logic | — |
| 5 | `plan`: aggregate, targets from step 4, item add/remove/reorder, server-side totals | 2, 3, 4 |
| 6 | `measurement`: entries, history, change series | 2 |
| 7 | `journal` | 2 |
| 8 | `export`: Thymeleaf → PDF with embedded Greek font | 5, 1 |
| 9 | Hardening: audit logging, erasure/export endpoints, rate limiting, backups | all |

Steps 3 and 4 are independent of the client/plan chain and can run in parallel if there is a second
pair of hands. Step 4 is the easiest thing here and the most valuable to get exactly right — it is
pure functions with published reference values, so it should reach near-100% branch coverage.

---

## 6. Risks, ordered by how much they can hurt

| Risk | Impact | Mitigation |
|---|---|---|
| **Greek food data acquisition** | Blocks the entire product | The largest non-engineering risk in the MVP. USDA is settled and free (§4.4), which removes the *nutrient backbone* from the risk but not the Greek layer: localized names, national composition values and exchange-list groupings. Those are separately licensed or must be authored. Resolve **before** step 3. Treat it as a project, not a task. |
| **Dual nutrient arithmetic drifting** | Visible wrong numbers, trust damage | Shared fixture set run against both implementations in CI. |
| **Plan aggregate performance** | Builder feels slow, the one thing that must not | Query-count assertions in `@DataJpaTest`; fetch plans by graph. |
| **Greek font handling in PDF** | Broken client-facing output | Assert on extracted PDF text in an integration test, not visual inspection. |
| **GDPR obligations arriving late** | Legal exposure; possible rework of storage | Decide the posture in step 0; implement in step 9. |
| **Scope drift from Phase 1 into MVP** | Slipped delivery | Template meals (#11) in particular will feel essential while building #1. It is not — it is the Phase 1 opener. Hold the line. |

---

## 7. Effort

Rough order of magnitude for **one experienced Spring developer**, backend only — no frontend, no
food-data sourcing, no design:

| Block | Weeks |
|---|---|
| Steps 0–2 (skeleton, auth, tenancy, clients) | 2–3 |
| Steps 3–4 (food, nutrition calculations) | 2–3 |
| Step 5 (plan aggregate — the hard one) | 3–4 |
| Steps 6–7 (measurements, journal) | 1–2 |
| Step 8 (PDF export) | 1–2 |
| Step 9 (compliance, hardening) | 1–2 |
| **Total** | **10–16 weeks** |

Assumes food data is licensed and available in usable form. If it must be sourced, negotiated or
cleaned, add substantially and treat it as the critical path — this estimate covers loading it,
not obtaining it.

The frontend is a comparable body of work and is not costed here. The plan builder in particular is
the most demanding UI in the product, and §1.1 puts real nutrient arithmetic on that side of the
wire.

---

## 8. Open questions

1. **Greek food data** — which national composition table and which exchange list, under what
   licence? USDA is resolved (§4.4); this is the part that still gates step 3 and the schedule.
2. **Client-facing scope in MVP** — the roadmap's MVP is practitioner-only; the client mobile app
   is #27. Confirm no client-facing surface is expected at launch, since it changes auth
   substantially.
3. **Deployment target and jurisdiction** — drives the GDPR posture in §4.1.
