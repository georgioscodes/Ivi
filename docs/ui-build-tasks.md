# Ivi UI — Build Tasks

The backend exposes 45 endpoints across 10 modules and every MVP feature has a working API behind
it. What follows is the work to put a usable interface on top, ordered so that each block ends
somewhere demonstrable.

Stack: React + TypeScript + Vite under `src/main/frontend`, compiled into the Spring Boot jar by
`gradle-node-plugin`. See [`mvp-build-analysis.md`](./mvp-build-analysis.md) §4a.

---

## The governing constraint

**Every number and every piece of data on screen comes from the backend.** The browser computes
nothing: not a total, not a percentage, not an average, not a derived BMI. It renders what the API
returned.

This is what makes the frontend tractable. It removes the worst hazard the earlier draft carried —
nutrient arithmetic existing in both TypeScript and Java, where a single rounding disagreement
means the total visibly changes the moment a practitioner saves. There is now one implementation
and it cannot disagree with itself. See `mvp-build-analysis.md` §1.1, which was revised for this.

Three consequences run through everything below:

1. **No optimistic UI for values.** A pending edit shows as pending. It never shows a guessed
   number that might be corrected a moment later.
2. **Mutations return the whole plan** and the client replaces its state with it. Adding one food
   moves four different totals; anything less would leave the client deriving the rest.
3. **Responsiveness is a UX problem, not a computation problem.** Debounce input, commit on pause
   or blur, show pending state honestly. That is the work.

## What remains genuinely hard

- **The plan builder.** Still the largest piece by a distance, even without the arithmetic.
- **Charts cannot use the brand palette.** [`ui-palette.md`](./ui-palette.md) measured it: sage and
  sand differ by 1.01 in contrast and four of the five sit in one narrow luminance band. They are
  fills. Measurement charts need a separate categorical scale plus a non-colour channel.
- **Latency has to feel intentional.** Every committed edit is a round trip. Done well that reads
  as solidity; done badly it reads as lag. Skeletons, pending states and disabled-while-saving
  controls are the difference.

---

## Decisions, made

Improvised rather than deferred; revisit any of them if they prove wrong in practice.

| Decision | Choice | Why |
|---|---|---|
| **Data fetching** | TanStack Query | Server-authoritative state is exactly its model: mutations return canonical data, the cache is replaced, invalidation is declarative. Also gives dedup, retry and stale handling that would otherwise be hand-rolled. |
| **Charts** | Recharts for the measurement series; plain CSS for progress bars | Progress bars need no library — they are a div with a width from a server-supplied percentage. Recharts is React-shaped and lets the palette be supplied rather than imposing one. |
| **Greek copy** | Hardcoded Greek, centralised in one `strings.ts`; no i18n library | Data-driven labels already arrive from the API (`labelEl` on measurement types, categories, meal names), so only UI chrome lives in the frontend. One module keeps it collectable if a second language ever appears. |
| **Components** | Bespoke, on Radix primitives for dialogs, tabs, popovers, selects | The palette has constraints most component libraries' colour systems will not accommodate. Radix ships behaviour and accessibility with no styling, which is the part worth not writing. |
| **Forms** | React Hook Form + Zod | The server already returns field-level errors in `ErrorResponse.errors`; RHF maps them onto fields directly. Zod gives client-side shape checking without duplicating business rules, which stay server-side. |

---

## Block 0 — Foundation ✅

- [x] Scaffold Vite + React + TypeScript under `src/main/frontend`
- [x] Wire `gradle-node-plugin`: downloaded Node pinned to 22.14.0, `npm ci`, Vite output copied
      to `static/` by `processResources`, with `inputs`/`outputs` declared so unchanged frontends
      skip the build. `check` runs `tsc --noEmit`, since Vite strips types without checking them
- [x] `WebMvcConfigurer` serving `index.html` for client routes — and deliberately *not* for
      unmatched `/api` paths or missing assets, both of which stay 404
- [x] Verify one jar serves both API and UI
- [x] Design tokens as CSS custom properties from `ui-palette.md`
- [x] **Author the neutral grey scale** — warm-tinted, eight steps. Two carry a requirement:
      `--grey-400` at 3.07 for control boundaries, `--grey-500` at 4.61 for placeholder text
- [x] Web font with verified Greek coverage including tonos and dialytika forms — Inter Variable,
      self-hosted via npm rather than a font CDN, which would send every practitioner's IP to a
      third party on each page load
- [x] Vite dev proxy to `:8080`

Verified against the running jar rather than by inspection: deep links, HEAD, cache headers
(`immutable` on fingerprinted assets, `no-cache` on the shell), unauthenticated `/api` still 401,
missing assets still 404, and a browser check that Greek tonos and dialytika render in Inter and
not a fallback face. Block 9 makes that last check permanent.

Two things this turned up. Permitting only `GET` on the shell gave every uptime check and proxy a
401 while browsers kept working — the kind of failure that reads as an outage. And the security
entry point declared `ISO-8859-1`, which cannot represent a single Greek character; the messages
are ASCII today, so nothing had broken yet.

## Block 1 — The API boundary ✅

- [x] Typed API client mirrored against the DTOs — see the drift note below
- [x] **CSRF**: read `XSRF-TOKEN`, echo as `X-XSRF-TOKEN` on every write. Spring Security 6 defers
      token generation, so a first write after a hard reload can find no cookie; the client mints
      one with a cheap GET rather than failing
- [x] TanStack Query setup: query keys per resource, `staleTime: 0` because caching a nutrient
      total reintroduces exactly the disagreement this architecture exists to prevent
- [x] Session bootstrap via `GET /practitioner/me`, where a 401 means "nobody" rather than a failure
- [x] Global handling: 401 → session cleared and cache emptied, 409 → conflict, 429 → lockout,
      5xx → error state with the server's text discarded
- [x] `ErrorResponse.errors` mapped onto form fields
- [x] Shared loading, skeleton, empty and error components

Covered by 24 frontend unit tests, wired into `gradle check` alongside `tsc --noEmit`. Verified
against the running jar in a browser: signed-out and signed-in states, a write rejected without a
CSRF token and accepted with one, and per-field validation messages arriving in the shape a form
needs.

One defect found. `POST /practitioner/registration` returns the new practitioner but establishes
no session, so writing its response into the session cache produced a signed-in shell whose every
request would 401. Registration now signs in as a second step, using the password already in hand.

**Known drift risk.** The TypeScript types are hand-written against the Java records. Generating
them needs an OpenAPI document, and producing one needs the application booted against Postgres,
which would make the frontend build depend on a database. Worth revisiting if the types start
disagreeing with the server in practice.

## Block 2 — Authentication ✅

- [x] Login, registration, logout
- [x] Protected routes with redirect-back
- [x] 429 lockout surfaced distinctly from wrong credentials — amber rather than red, its own
      wording, and the submit button disabled, because the form should stop inviting the action
      that caused it

Verified in a browser against the running jar: a turned-away link resumes after sign-in, a
signed-in practitioner is kept off `/login`, and five wrong passwords produce a wrong-password
message where the sixth produces the lockout.

Two things this turned up.

**Two redirects raced.** The login page navigated to the intended destination on success while
`GuestOnlyRoute` redirected to `/` as soon as the session landed in the cache. The second usually
won, so a practitioner who followed a link signed in and arrived somewhere else — silently, and
only sometimes. `GuestOnlyRoute` is now the only thing that decides where sign-in lands.

**The catch-all route ran before authentication.** `*` redirecting to `/` meant an unknown path
was rewritten before `ProtectedRoute` ever saw it, so the destination was gone by the time anyone
signed in. It now lives inside the protected tree and renders a not-found screen, which keeps the
URL.

### Owed: the server speaks English

There are 140 bean-validation messages in the Java code and they are all English — as are
"Invalid email or password" and the lockout text. They reach a Greek-speaking practitioner
unchanged.

Block 2 covers the auth paths specifically: sign-in maps 401 and 429 to Greek itself, and the
registration form mirrors the server's shape rules in Greek so the practitioner sees Greek for
everything they are realistically going to hit. That is a patch over the auth screens, not a fix.

**Decided: mirror each form's rules in Zod**, as the registration and client forms do, and accept
English on the paths a practitioner will not realistically reach. No backend change.

The cost is duplication, and duplication drifts. Each schema names the Java record it mirrors and
its tests assert the specific limits, so a server-side change that is not mirrored fails a test
rather than reaching a practitioner as an English sentence. The two alternatives — translating the
server's messages, or adding a stable `code` to `ErrorResponse` and letting the client own all
copy — remain open if this gets unwieldy.

## Block 3 — Clients ✅

- [x] List with search and pagination — search term and page live in the URL, so a result list
      can be linked, bookmarked and returned to with the back button
- [x] Create and edit forms, sharing one component so the fields and rules cannot drift apart
- [x] Detail shell with tabs: overview, measurements, plans, journal. Routed links rather than
      ARIA tabs — each panel is a route, so the URL is the state
- [x] Delete with confirmation that names what goes with the client rather than asking "are you
      sure", with the cancel button focused so Enter does not delete anybody

Search is debounced at 300ms. Per-keystroke queries return out of order, so the list can settle
on the results for "Ελ" after the results for "Ελένη" have already been shown.

Blank optional fields are sent as absent rather than as `""`. The difference is visible in the
record: an empty string overwrites a stored value, where omitting the key leaves it alone.

The confirm dialog is the native `<dialog>` element rather than Radix, which the decisions table
above names. `showModal()` brings focus trapping, Escape, the backdrop and page inertness with it,
which is most of what a dialog library is for. Radix can still earn its place in the plan builder,
where comboboxes and popovers need behaviour the platform has no answer for.

Verified in a browser end to end: empty state, client-side validation in Greek, create, routed
tabs, edit round trip, debounced search reflected in the URL, and delete with confirmation.

## Block 4 — Measurements ✅

- [x] Types from `GET /measurement/type`, grouped by category
- [x] Single entry, and **batch entry for a whole visit** — one date, one pass down the list, one
      request. Empty inputs are not sent: a measurement that was not taken has no value, and
      0 kg of muscle mass is not the same statement as silence
- [x] History table
- [x] Change chart from `GET /measurement/series`, which already returns the deltas
- [x] Summary card with the server-derived BMI, showing nothing when it is null rather than
      computing a fallback
- [x] Out-of-range indication that is not colour alone — symbol, word, then colour

The chart uses a validated categorical scale, not the brand five. Colour was run through the
lightness-band, chroma-floor, protan/deutan, normal-vision and contrast checks against `--surface`;
slots 3 and 4 fall below 3:1, which obliges a visible label wherever they carry meaning. One
series, so no legend — the heading names it. The y-axis is not zero-based: a weight series runs
78–84 kg and anchoring at zero flattens exactly the change the chart exists to show.

Three defects found while verifying.

**`bmiCategory` was rendered raw.** The server sends stable codes — `UNDERWEIGHT`, `OVERWEIGHT` —
which is the right thing for it to send and the wrong thing to put on screen. A practitioner
reading "OVERWEIGHT" off a Greek interface with the client beside them is a defect. Now mapped,
and an unknown band shows nothing rather than the code.

**A stale figure was visible after saving.** The entry form closed as soon as the write returned,
over a summary still showing pre-save values — a BMI of 28,3 on screen for a client the server
already had at 27,7. That is the exact disagreement between screen and server that making the
server authoritative was meant to eliminate. The invalidation promise is now returned from
`onSuccess`, so the mutation stays pending until the refreshed figures have arrived.

**History rows within a visit came back in arbitrary order.** The server sorts by date and
nothing else, so weight sat above height on one date and below it on the next, which defeats
comparing a measurement across visits by eye. Ordered within the page by the sequence
`GET /measurement/type` returns.

## Block 5 — Nutrition targets ✅

- [x] Calculator across all three entry paths the API accepts — anthropometrics, a stated basal
      rate, or a stated target. A radio group, because the server takes exactly one and assembling
      an invalid combination then reading about it is a worse way to find out
- [x] Activity factor from `GET /nutrition/activity-level`, still accepting any value in range —
      the endpoint offers suggestions, and reducing that to a six-item menu would take a judgement
      away from the practitioner
- [x] Weight-goal input with the sign convention made obvious
- [x] Macro split by percentage or per-kilogram coefficients
- [x] Show the working — laid out as a derivation, one line per step, so it reads the way it would
      be explained across a desk

Weight, height and age are seeded from the client's own record, once, and only into fields the
practitioner has not touched. **Sex is not on the client record** and cannot be prefilled, so it is
asked every time — all three equations are sex-specific and there is no default that would not be
a guess about a person. Worth adding to the client record if this proves annoying.

The coefficient path produces its own energy total, which can differ from the target derived
above. The UI says so rather than hiding it: the practitioner chose to prescribe grams, and the
two numbers answer different questions.

**Added a clinical-safety notice.** A plausible-looking goal — −4 kg over 20 days — silently
produced a 470 kcal/day target. The arithmetic is correct and the server accepts anything above
zero. It now says when the target has fallen below the client's own basal rate. It does not block
or disable: the practitioner is the clinician, and there are legitimate supervised reasons to go
there. The alternative was software handing over a very-low-calorie target with the same blank
face it uses for 2.100.

Two defects found by looking at the rendered screen.

**The activity factor rendered as `1.375`.** In Greek a full stop is the thousands separator, so
the multiplier read as one thousand three hundred and seventy-five to anyone saying it out loud.

**The derivation printed the same figure twice** in consecutive rows — the activity step showed
the product, and the maintenance line below it showed the same product again, which reads as a
repetition rather than a step. The activity row now shows the multiplier.

## Block 6 — Food catalogue ✅

- [x] Browse and search, filtered by category — term, category and page all in the URL
- [x] Custom food form
- [x] **Override editor** — editing a catalogue food creates a private override. The edit screen
      says so *before* the practitioner types, the submit button says "save my version", and both
      the list and the detail page badge the result with revert offered next to it
- [x] Suggestion form and the practitioner's own suggestions list
- [x] Portion editor, with the default enforced as a radio group — two defaults would leave the
      plan builder picking arbitrarily between them

Categories are **not** colour-coded. The roadmap wants colour here eventually and the palette
cannot supply it: five reliably distinguishable hues need a scale designed for it plus a
non-colour channel carrying the same information. Text does that job today at no cost.

Adds top-level navigation to the shell — clients and foods — which had none before.

Three defects found while verifying.

**A practitioner could not report a wrong default once they had corrected it.**
`POST /food/{id}/suggestion` resolves its id against the shared catalogue only, and after an
override `food.id` is the override's own id, so the suggestion was rejected outright. The person
most likely to notice a bad catalogue value — the one who already fixed it for themselves — was
the one who could not tell anyone. Now posts `overridesFoodId`.

**Pagination said "34 πελάτες" under a table of cheeses.** The component was written for the
client list with the noun hardcoded. It is now a required prop rather than a default, so the next
screen to reuse it cannot repeat this.

**The override detail page contradicted itself** — badged "Τροποποιημένο" while the source line
read "Καταχωρήθηκε από εσάς", because an override's `source` is `PRACTITIONER`. They did not enter
it; they changed a catalogue entry.

One rough edge accepted: `FoodSuggestionResponse` carries only `foodId`, and the entity holds a
soft reference with no relation, so the server cannot cheaply resolve a name either. The
suggestions list resolves names client-side, deduplicated and cached under the same key the detail
page uses, falling back to the id. Adding the name to the response would be the cleaner fix.

---

## Block 7 — The plan builder, broken down

The largest block. Sequenced so each step is usable before the next begins.

### 7a. Read-only plan view ✅

- [x] Route `/client/{clientId}/plan/{planId}`, fetch `GET /plan/{id}`
- [x] Day → meal → item tree from the response
- [x] Day labels: practitioner override, else weekday name, else "Ημέρα N" — mirroring the export,
      including the rule that stops naming weekdays past day seven rather than producing a second
      Δευτέρα halfway through a fortnight
- [x] Meal labels in Greek, asserted equal to `PlanExportService.MEAL_LABELS`
- [x] Item row: name, portion label, quantity, grams, kcal — all as returned
- [x] Meal totals, day totals, day percentage of target, plan daily average — all as returned
- [x] Empty meal and empty plan states
- [x] Plan list per client, and creation from a client plus targets

Verified against the running application: a seeded day's energy on screen matches the figure the
server returned for it exactly. Not one number in this view is computed client-side.

The five meal slots render even on a day with nothing in them — they are the shape of the day and
the place food gets added, so collapsing them would leave a new plan with nowhere to start. (The
server scaffolds five; `EVENING_SNACK` exists as a type but is not created.)

Two layout defects, both found by looking at the render rather than the DOM.

**Meal separators bled through empty grid tracks.** Drawing them as a 1px gap over a coloured
container background is tidier to write and wrong here: with `auto-fill` the track count comes
from the available width, so five meals in a four-column row leave three empty tracks whose
background shows as blank slabs. Now a border per meal.

**An unscoped `section + section` rule in `measurement.css` reached the plan builder**, adding
32px above four of the five meals and leaving the first hanging above the row it belonged to. A
global adjacent-sibling selector in a feature stylesheet is a trap for whatever gets built next;
it is now scoped to its own tab.

Targets are entered when a plan is created rather than carried over from the Στόχοι calculator.
The calculator produces a recommendation; a plan records what the practitioner decided, and the
two are allowed to differ. Carrying the values across is a real convenience and belongs with the
rest of the builder work.

### 7b. Progress bars ✅

- [x] Bar component taking a server-supplied percentage; no arithmetic. A test feeds it totals and
      percentages that disagree and asserts the server's figure is the one drawn
- [x] Four bars per day: energy, protein, carbohydrate, fat
- [x] Over-target state using the semantic error token, **plus** a text label and `aria-valuetext`
      — colour is never the only carrier
- [x] Numeric value beside every bar, with its target alongside
- [x] Categorical colours for the four macros from the validated chart scale, not the brand five

No chart library: a bar is a div with a width, and Recharts would add a hundred kilobytes to draw
a rectangle.

The fill is capped at 100% while the number is not. A 180% day drawn at 180% paints over the
layout beside it; the figure and the "πάνω από τον στόχο" label carry the excess instead.

### 7c. Adding food ✅

- [x] Food search panel with debounced query against `GET /food`
- [x] Category filter
- [x] Result row showing per-100g composition
- [x] Portion picker defaulting to the food's default portion
- [x] Quantity input
- [x] `POST /plan/{planId}/meal/{mealId}/item`, replacing plan state from the response
- [x] Pending state on the target meal while in flight
- [x] Overridden foods visibly marked in results, since the practitioner's values are what will be
      used

The response is written into the cache with `setQueryData`, not followed by an invalidation: the
server has just sent the canonical plan, so re-fetching it would be a round trip to learn what we
already have. Verified against the running application that the meal total and the day's energy
bar both equal the figures the server returned.

**A defect caught before it shipped.** The portion picker offered a "Γραμμάρια" option that sent
no `portionId`. Omitting it does not mean grams to this API — `PlanService.choosePortion` falls
back to the food's *default portion* — so choosing grams and typing 150 would have recorded
"150 × κεσεδάκι", a wrong prescription arrived at without a single error message. The picker now
offers only real portions, and the one case where quantity genuinely is a multiple of weight (a
food with no portions, where the server synthesises a 100 g unit) says so on the field label. A
test asserts no option can ever carry an empty portion id.

The dialog closes on success only. A failed add keeps it open with the message, so the
practitioner does not have to find the food again to retry.

### 7d. Editing items ✅

- [x] Quantity edit, debounced at 600ms, committed on pause, on blur, or on Enter — not per
      keystroke. Longer than the 300ms used for search: a search firing early is a wasted request,
      where a quantity firing early writes a value into a plan and moves four totals
- [x] Pending indicator on the row being saved; the old number stays until the new one arrives
- [x] Name override for print
- [x] Remove item, with the whole plan replaced from the response
- [x] **Decided: a confirmation, not an undo.** An undo here could only re-add the food, which
      takes a *fresh* composition snapshot from the catalogue — so if the practitioner had
      overridden that food in between, the restored line would carry different numbers from the
      one they removed. An undo that silently substitutes values is worse than a prompt

A blank or zero quantity is not a request to set the quantity to zero: the field restores the
last confirmed value and sends nothing. An unchanged value sends nothing either, so tabbing
through a row does not write to the plan.

**A gap worth closing in the API.** `PlanItemResponse.name` is the *resolved* display name, and
neither the original food name nor the override is exposed separately — so the rename dialog
cannot say "currently overridden from X", only offer to restore. Adding `nameOverride` to the DTO
would let that be stated rather than implied.

### 7e. Reordering ✅

- [x] Drag and drop within a meal (`dnd-kit`), confined to the vertical axis and to the meal —
      the API reorders *within* a meal and has no concept of moving an item to another one, so a
      drag that looks like it will cross columns and then silently does not would be worse than
      one that never suggests it
- [x] **Keyboard reordering** as a first-class path — explicit move-up and move-down buttons,
      always visible. dnd-kit's keyboard mode works (space to lift, arrows, space to drop) but
      nothing on screen announces it; two buttons need no explaining and are what a switch user,
      a screen-reader user, or anyone with three items in a narrow column will reach for
- [x] `PUT /plan/{planId}/meal/{mealId}/order` with the full ordered id list
- [x] Optimistic ordering, rolled back if the request fails

Ordering is the **one** plan mutation that updates optimistically, and the reason is precise: a
position is not a nutrient value. Reordering changes no total, no percentage and no average, so
showing the new order before the server confirms it cannot put a number on screen that the server
would contradict — which is the entire basis of the no-optimistic-UI rule. Drag-and-drop that
waits for a round trip before the row moves feels broken, so here the trade is worth making.

**A server defect this uncovered.** The reorder endpoint's response listed items in their *old*
order while carrying the *new* `sortOrder` values; a subsequent read returned them correctly. So
the practitioner dragged a row, the server stored the move, and the screen snapped back.

`@OrderBy` on the collection applies when Hibernate **loads** it. Reordering mutates `sortOrder`
on entities already in the persistence context, and the in-memory list keeps its original
sequence. The client replaces its whole state from a mutation response precisely so screen and
server cannot drift apart, which makes a response that contradicts the next read a failure at the
foundation rather than a cosmetic one.

Fixed in `PlanMapper.toDto(PlanMealEntity)` rather than in `reorderItems`, so every response is
ordered the same way whichever operation produced it, with a Java test covering it.

### 7f. Concurrency and persistence ✅

- [x] Surface `version` from the plan response — used to detect that a re-read moved the plan on,
      not shown to the practitioner, for whom a version counter means nothing
- [x] **409 handling**: never silently overwrite. Automatic single retry first; a conflict that
      survives it is reported and offers reload
- [x] Saved / saving / conflict / failed indicator for the plan as a whole
- [x] Retry on transient failure, with the edit preserved

**What the locking actually does — measured, not assumed.** Before building any of this I fired
concurrent requests at the running server:

| Case | Result |
|---|---|
| Two clients holding a stale version, editing **sequentially** | Both succeed. No conflict — the API takes deltas, not whole documents, so a laptop and a tablet editing different things both apply |
| Simultaneous edits to the **same item** | 2 of 6 succeeded, 4 rejected with 409 |
| Simultaneous adds to **four different meals** | 1 of 4 succeeded — **three legitimate items were lost** |

The third row is the problem. `@Version` sits on the plan aggregate and every item operation
bumps it, so edits that conflict over nothing in common still collide. The task list's premise —
"tell the practitioner the plan changed elsewhere" — describes the second row; the third is more
likely and is not a conflict in any sense a practitioner would recognise.

So every plan mutation now retries once on 409, re-reading the plan first. This is safe precisely
because a 409 from optimistic locking means the transaction **rolled back**: the change did not
apply, so re-sending it cannot duplicate anything. A network failure carries no such guarantee,
which is why the global mutation retry stays off and this is scoped to 409 alone. Re-running the
four-way burst through the retry: 4 × 200, nothing lost.

The conflict message says the change did not save and offers reload. It deliberately does **not**
say somebody else changed the plan — the likeliest cause is the practitioner's own two actions
sharing a version counter, and naming a culprit who may not exist is worse than saying nothing.

A conflict offers no retry button: it would conflict again. A server fault does, because it might
pass — and never automatically, since a timed-out request may already have been applied.

**Worth fixing server-side eventually.** Locking at the plan level makes independent meal edits
collide. Finer-grained versioning, or a retry inside the service, would remove the need for the
client to compensate.

### 7g. Day operations and status ✅

- [x] Clear day (`DELETE /plan/{planId}/day/{dayIndex}/item`) with confirmation, offered only on
      a day that has something in it. It empties the day and keeps its meals, so the confirmation
      says that rather than implying the day is being removed
- [x] Status transitions draft → issued → archived (`PATCH /plan/{id}/status`)
- [x] Delete plan

The server permits **any** status transition in any direction — these are labels on a document,
not a workflow with gates. So the UI offers the one step that follows naturally from where the
plan is, and describes what it means rather than only naming it: "Έκδοση πλάνου" alone does not
answer the question a practitioner actually has, which is whether the plan stays editable. An
archived plan can be reopened, because a practitioner may have archived the wrong one.

Archived plans stay editable, as the server allows. They carry a notice saying the plan is part
of the client's record — blocking client-side what the server permits would be inventing a
constraint, but changing an archived plan silently is not the same act as editing a draft.

**A backend fix.** `updateStatus` was the only mutation that did not call `plan.touch()`, so
issuing or archiving a plan left "last updated" showing whenever the *contents* were last edited
— stale at exactly the moment a practitioner looks at it, which is after handing the plan over.

**A Greek grammar defect, caught by reading the rendered dialog.** Interpolating the day label
after a preposition produced "Όλα τα τρόφιμα **της Δευτέρα**" — the label is nominative and the
sentence wanted a genitive. Weekday names could be given genitive forms; a practitioner's own
label ("Ημέρα προπόνησης") could not. The sentence now places the label in apposition after
«ημέρας», where it holds any label without being declined.

### 7h. Analysis panel ✅

- [x] Per-day totals against targets, as one table with every day on adjacent rows
- [x] Weekly average, as returned — now the table's last row
- [x] Plan notes, editable, printed in the client's PDF
- [x] PDF export button (`GET /export/plan/{planId}`), handling the `Content-Disposition` filename

The per-day bars already answer whether *a* day works. What they cannot show is the shape of the
week — which day is the light one, whether protein sags on the days without a snack. That needs
the days on adjacent rows, so the panel is a table: targets, then a row per day, then the average.

The daily average moved out of the header and into that table as its final row. An average is only
readable against the days it averages, and two copies of the same four numbers on one screen
invite the question of why they differ — which, the moment one is stale, they will.

Nothing here is derived. The values are the day totals, the percentages are `targetPercent`, and
the average row is `dailyAverage`. Verified against the running server rather than asserted: all
sixteen percentages on screen were compared against the API response, and the fixtures in the
component test give a day whose percentage deliberately does not follow from its totals.

**Three backend gaps, all found by wiring the UI to what was actually there.**

`PlanExportService.fileNameFor` had built a proper name from the client and the plan since the
export was written, and the controller ignored it — every download arrived as `plan-42.pdf`. A
practitioner exporting for three clients in a row got three files they could only tell apart by
opening them, which is how a plan for the wrong person ends up attached to an email. The service
now returns a `PlanExport` carrying content and name together, since only it has the client's
name. Nothing caught this because the export module had **no tests at all**; it has six now.

`PlanResponse` carried `dailyAverage` but no percentage for it, so the average row could show
figures and no progress — the one row that answers whether the week works. `dailyAveragePercent`
is computed server-side from the unrounded mean, for the same reason `targetPercent` is: rounding
before dividing is how a figure that has plainly hit target ends up beside a percentage saying 99.

`notes` was on the entity, on the response, and printed by the PDF template — and **nothing could
ever write it**. Not on `PlanCreateRequest`, no update endpoint. The Σημειώσεις section of the
export was unreachable code. `PATCH /plan/{id}/notes` fixes that, and the exported PDF was then
checked for the Greek text rather than assumed to contain it.

Notes save on a button, unlike every other edit in the builder. The rest commits as you go because
each change is a discrete act — a quantity, a food, an order. Prose is not: a half-typed sentence
auto-saving into the document a client receives is not a saved draft, it is a published mistake.
The draft also stops re-syncing from the server while the editor is open, because every other edit
on the page replaces the whole cached plan and would otherwise wipe a sentence mid-word.

**The PDF is fetched, not linked.** A plain `<a href>` to the export would be simpler, and a
control experiment showed exactly what it costs: pointed at a plan that does not exist, the
browser cheerfully saved the 404 JSON body as a `.pdf`. Fetching means a failure surfaces as a
message instead. The cost is that the filename must be applied client-side from
`Content-Disposition`, which is the `filename*` parsing written back in Block 1 and never once run
against a real download until now.

**An environment trap worth recording.** That download check failed the first time: Chromium
reported the file as `download`, discarding the Greek name. It reproduced with a bare blob and no
application code involved, and the cause was the container's `POSIX` locale — under `C.UTF-8` the
name comes through intact. Not a product defect, but it is exactly the shape of thing that gets
"fixed" in the wrong place.

**Left alone, for Block 9.** At phone widths the page scrolls sideways by 25px. Measured with the
analysis panel hidden: the overflow is unchanged, and comes from `.shell__account` in the app
shell. Pre-existing, and layout is Block 9's business.

---

## Block 8 — Journal ✅

- [x] List per client, newest first, with search over title and content
- [x] Entry form, date defaulting to today but editable for a session written up later
- [x] Amend and delete

The consultation record: what the client reported, what was agreed, what to watch. The sharp
difference from the plan notes built in 7h is the audience — **none of this is ever shown to the
client**, where plan notes exist precisely to be printed and handed over.

Entries render as cards in an ordered list rather than table rows. An entry is prose of no fixed
length, and the date it belongs to is its heading rather than a column beside it. Text is held to
about 75 characters a line: clinical notes are read, not scanned.

**The search was broken for Greek, and quietly.** Two entries both containing the word "διατροφή",
one lowercase and one in a capitalised heading — and no search term found both. Every term found
exactly one. Greek is written *without* accents in capitals, so lowercasing a heading gives
"διατροφη" and the accented word never matches it. Searching "προσοχή", spelling the word
correctly, returned nothing at all. Search still returned *some* rows, which is what makes this
the bad kind of defect: it looks like it works until an entry the practitioner is certain they
wrote cannot be found. Both sides are folded now — `GreekText` for the term, `translate()` for the
stored text — and the browser check drives it both ways round.

Three more, from the same query:

- The **title was never searched**, so an entry titled "Επανέλεγχος" could not be found by its
  own title.
- The list ordered by `entry_date` alone. Dates repeat, and an unstable sort under pagination can
  show one entry twice and omit another. Tie-broken on id.
- Replacing the derived `Containing` finder **lost its wildcard escaping** — my own regression,
  caught by re-running the probe. A typed `%` would have matched every entry. Not injection, but
  a search box that means something other than what was typed.

**Search is debounced, and the usual reason is the lesser one here.** Every list read writes a row
to the audit log, because reading someone's clinical notes is an access that has to be recorded.
One request per keystroke would put eight rows in that log for one word typed, burying the real
accesses under a trail of half-typed prefixes. Verified in the browser: one read per settled term.

**Two date traps, both about time zones rather than formatting.** `toISOString().slice(0, 10)` is
the obvious way to default the date field and is wrong — it converts to UTC first, so a
consultation written up at 01:00 in Athens would default to *yesterday*. And `new Date('2026-08-01')`
parses as UTC midnight, which renders as 31 July anywhere west of Greenwich. Both are built from
local parts instead, with the Athens case pinned in a test that sets `TZ`.

**A native date input ignores the page's language.** It renders in the *browser's* locale, so on
an en-US browser the field reads `08/07/2026` — July or August depending on who is reading. Seen
in a screenshot rather than reasoned about. Nothing in the page can change that rendering, so the
date is echoed underneath in words: "Παρασκευή, 14 Αυγούστου 2026".

Amended entries are marked. A journal is a clinical record, and that an entry was changed after it
was first written is part of it.

**Recorded, not fixed.** The journal *list* endpoint answers a cross-tenant read with 400 "No such
client" where this project's rule is 404. It is not a disclosure — measured side by side, a real
client belonging to another practitioner and a client id that does not exist return byte-identical
responses, and the single-entry and delete paths both correctly return 404. It is a consistency
defect in one endpoint's status code, and changing it touches the create path too, so it wants its
own change rather than a quiet edit here.

**Also recorded:** the food catalogue search has both defects this block fixed — the accent folding
and the unescaped wildcard — in a surface used far more often than this one.

## Block 9 — Quality ✅

- [x] Component tests for the builder interactions
- [x] Playwright end-to-end over the real stack, committed to the repository
- [x] **Greek rendering asserted in the browser**, as the PDF work does: check the text, do not
      glance at it
- [x] Keyboard navigation and focus management, particularly in the builder
- [x] Contrast verification against the tokens
- [x] Tablet layout — an explicitly supported way of working

The throwaway Playwright scripts that verified every previous block are now a committed suite:
41 tests in `src/main/frontend/e2e`, run with `./gradlew e2e` against an application that is
already up. See [`e2e/README.md`](../src/main/frontend/e2e/README.md).

Deliberately **not** part of `check`. These need a server and a database, and a check that fails
for reasons unrelated to the change is a check people learn to skip. `IVI_CHROMIUM` points at a
browser the machine already has instead of downloading one, which is what makes it runnable in a
container with a prebuilt Chromium.

### What the suite found

**A screen reader was told the wrong thing before a destructive action.** `ConfirmDialog`
hardcoded `id="confirm-title"`, and the plan page renders three of them at once. `aria-labelledby`
resolves against the first match in the document, so opening «Διαγραφή πλάνου» announced
«Καθαρισμός ημέρας». Measured, not deduced: the browser really did resolve the accessible name to
another dialog's title. Generated ids fix it, and the test deliberately opens the *second* dialog
on the page — checking the first would have passed while every other dialog on it lied.

**Focus was stranded by a delete.** The journal's delete button lives inside the entry it removes,
so the browser's usual focus restore had nowhere to put it and focus fell to `<body>` — a keyboard
user silently returned to the top of the page with no indication the delete had worked. Focus now
moves to the first surviving entry, or to «Νέα καταχώρηση» when the list empties.

**There was no skip link.** Every page repeats the brand, two nav links and the account block, so
reaching the content meant tabbing past all of them, on every page.

**Every page was titled "Ivi".** WCAG 2.4.2, and it makes the back button, a row of tabs and the
history list equally useless. Titles name the *kind* of page — «Καρτέλα πελάτη · Ivi» — and
deliberately **never the client**: a document title reaches browser history, the OS window title
and the task switcher, so naming the person would write Article 9 data into places this
application neither controls nor can erase.

**Text was using a boundary colour.** `--grey-400` is documented in the palette as a control
boundary at 3.07:1, which is right for WCAG 1.4.11 and wrong for text. Three rules used it as text
at 3.16:1 — under the 4.5:1 body threshold. The palette table was correct all along; what was
missing was a check that the *pages* honoured it, which is what measuring computed styles adds.

**A one-pixel invisible element made the page scroll sideways on a tablet.** The best find of the
block. The food catalogue overflowed by 11px, and nothing visible stuck out. It was the
visually-hidden «Ενέργειες» column label: `position: absolute` resolves against the nearest
*positioned* ancestor, and `.table-scroll` was not positioned — so `overflow-x: auto` never
clipped it and it dragged the document 11px wider. Scroll containers holding visually-hidden text
now establish a containing block.

### Two of my own mistakes, worth recording

**A test that asserted a browser quirk.** The focus-trap check required focus to be inside the
dialog after every Tab, and failed. Probed against a bare native `<dialog>` with no application
code at all, Chromium cycles A → B → body → A: focus passes through the body while wrapping. The
dialog was behaving correctly and the assertion was wrong. It now checks the property that
actually matters — that focus never reaches anything *behind* the modal.

**A test that skipped itself.** The keyboard-reorder test needed a meal with two items, and the
fixture seeded them into two different meals, so `test.skip` fired and the run summary looked
identical to a pass. The fixture seeds them together now, and the precondition is asserted rather
than skipped.

### Left as it is

At phone widths (420px) the page still scrolls sideways by 25px, from `.shell__account` in the app
shell. Phones are not a supported way of working — the tablet is — and the header wants a
considered narrow layout rather than a nudge. The tablet project covers 810px, which is the size
that was promised.

---

## Still deferred, still owed

Not UI work, and not finished:

- **MFA.** Optional MFA reaches roughly a tenth of users; for Article 9 health data it should be
  required. Nothing currently stops a stolen password.
- **Erasure and export per client.** A subject access or deletion request has no answer in the
  software today, and the practitioner is the controller who must give one. Designed but
  deliberately deferred — see below.

Both should land before the first real practitioner, not after.

### Subject access and erasure — the design, parked

Discussed and deferred rather than dropped. Picking it up should start here, not from scratch.

**Where it already stands.** Erasure mechanically half-works: `DELETE /client/{id}` is a hard
delete and `ON DELETE CASCADE` carries plans, measurements and journal entries with it. It is
audited, and the trail survives on purpose — `audit_log.client_id` is not a foreign key precisely
so that erasing a client does not erase the evidence of who read them. Export does not exist at
all; the only one in the system is the per-plan PDF. There is no admin or role concept anywhere:
`AuthenticatedPractitioner.getAuthorities()` returns an empty list.

**Split the two rights, because they are not alike.** Access and portability are non-destructive
and read-only — the practitioner can already read every one of those records on screen, so an
approval gate adds no safety and only delays a legal obligation. Erasure is irreversible across
four tables, and that is where a gate earns its place.

**Export.** `GET /client/{id}/export`, ungated, producing JSON — Article 20 asks for a
machine-readable format — alongside the human-readable PDF. Recorded as `EXPORT`, an action the
audit log already has. This is the half that is both unambiguous and entirely missing, so it is
where to start.

**Erasure.** One tenant-owned table, `data_subject_request`, carrying type, status
(`REQUESTED → APPROVED → COMPLETED`, or `REFUSED`/`CANCELLED`), `approved_by`, an `executes_at`
cooling-off window, and an outcome with a reason. `received_at` is stored separately from
`created_at`: the statutory clock runs from when the *client* asked, not from when somebody found
time to record it — the same distinction the journal draws between the consultation and the
write-up, for the same reason.

**Three outcomes, not one.** `ERASED`, `REFUSED` with a recorded reason, and `RESTRICTED` — kept
because a retention obligation requires it, but locked out of normal use. Restriction is by far
the most expensive of the three: a restricted client has to disappear from every list, search and
picker and become read-only, which touches every tenant-scoped query in the system. It should not
be built until a retention period is confirmed to actually oblige keeping records the practitioner
has been asked to erase. That is a question for a DPO, not for this document.

**The open question, which is why this is parked.** Who approves. The requirement as stated is
that a user requests and an admin allows. If "admin" means someone at Ivi, the shape is inverted:
the dietitian is the **controller** and Ivi is the **processor**, and a processor is required to
*assist* with subject rights rather than to permit them. It would put Ivi inside the dietitian's
one-month statutory deadline, so that an outage here becomes their exposure, and it would give Ivi
staff cross-tenant sight of Article 9 data — dismantling the tenant isolation the rest of the
system is built around.

The concern underneath the requirement is real: a mis-click or a stolen session should not be able
to destroy a clinical record. That is answerable **inside the tenant** — a deliberate two-step act
with a cooling-off window now, and the practice owner as approver once multi-seat practices exist.
The `approved_by` column and the empty `getAuthorities()` are both already shaped for it. If an
Ivi-side approver is wanted anyway, that is a legitimate call to make, but it should be made
explicitly and written down, not arrived at as a side effect of a data model.
