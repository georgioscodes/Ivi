# Ivi — Feature Inventory & Phased Roadmap

**Product**: Ivi — cloud practice-management and diet-planning software for dietitians and
nutritionists, with a companion mobile app for their clients.

## How to read this

This is a build-order plan for the full product surface, ranked by **dependency and
indispensability**: what has to exist before something else can work, and what the product cannot
credibly ship without.

Ranking is deliberately not by visible impressiveness. Several features that demo well sit late
because they aggregate or compose things built earlier, and a few unglamorous ones sit early
because everything downstream depends on them. Where those two orderings disagree, the dependency
graph wins, and the disagreement is called out explicitly in
[Cross-cutting observations](#cross-cutting-observations).

---

## MVP — the practice cannot function without these

The irreducible loop: *record a client → compute their energy needs → build a diet → hand it over.*
Remove any one of these and the product does not do its job.

| # | Feature | Why it is MVP |
|---|---|---|
| 1 | **Diet-plan builder** — meal-by-meal composition, quantity per item, per-day structure | The product's reason to exist. Everything else feeds it or follows from it. |
| 2 | **Food database** — several thousand foods across an exchange table, a Greek national composition table, and USDA data, all Greek-localized | The builder is inert without it. Greek-localized food data is the hard-to-copy asset and the deepest single investment in the MVP. |
| 3 | **Energy requirement calculation** — Harris-Benedict BMR, activity multiplier, weight-loss target, per-kg coefficients, manual calorie/BMR override | Every plan derives from this number. Support all the entry paths: practitioners differ sharply in method, and a tool that allows only one loses the rest. |
| 4 | **Macronutrient distribution** — carb/protein/fat percentage split | Converts the calorie target into the constraint the builder works against. |
| 5 | **Real-time daily progress bars** — energy and macros updating as foods are added | Makes the builder usable rather than guesswork. Also the core product bet: see [#28](#phase-2--differentiation-and-the-client-facing-surface). |
| 6 | **Client records** — CRUD, card and list views, tags, goals, contact details | The entity everything else attaches to. |
| 7 | **Anthropometric measurements** with value history and change charts | Closes the loop: without progress tracking there is no reason for a follow-up visit. |
| 8 | **PDF export / print of the diet**, carrying the practice's own logo | The actual deliverable handed to the client. Unshippable work is not work. |
| 9 | **Cloud, browser-based, no installation** — desktop, tablet, mobile | Architectural, not a feature. Decided at day zero or paid for painfully later. |
| 10 | **Session journal** — free-text record per consultation | Simple, but it is the clinical record of what was said. |

---

## Phase 1 — the time multipliers

These add little new capability; they collapse the *cost* of the MVP loop. That is what turns a
working tool into one people renew annually, and it should be the product's central claim.

| # | Feature | Rationale |
|---|---|---|
| 11 | **Template meals** — save a meal composition, insert it by name | Highest leverage per unit of build effort, and the **prerequisite for auto-generation** ([#14](#phase-1--the-time-multipliers)). Build first. |
| 12 | **Template diet plans** — save whole plans, copy to any client | Turns past work into reusable inventory. |
| 13 | **Copy/paste meal or entire day**, drag-and-drop reordering | Cheap mechanics, outsized daily impact. |
| 14 | **Automatic plan generation** — a complete personalized plan in under a minute | The headline capability, and **strictly dependent on #11**: it composes saved template meals into the day's slots and scales quantities to hit the targets. With no template library it produces nothing, which is why it cannot be an MVP item. |
| 15 | **Questionnaires** — population-validated instruments (brief history, health, 24-hour recall) plus a custom questionnaire builder | Structures intake; the builder keeps the tool from constraining clinical style. |
| 16 | **Pre-visit questionnaire sharing** — emailed link the client completes before arriving | The single clearest ROI in the product: it reclaims 10–15 minutes from every first consultation. |
| 17 | **Completed-answers summary view** | Small, and the difference between intake data being read or ignored. |
| 18 | **Calendar** — appointments, durations, notes, non-client events | Practice-management baseline. |
| 19 | **Two-way Google Calendar sync** | Decisive for adoption. Without it the calendar is merely a second place to check, so nobody checks it. |
| 20 | **Auto-generated shopping list** on the plan PDF | Nearly free from data already held; disproportionate perceived value to the end client. |
| 21 | **Plan analysis** — per-day energy and macros, food statistics, weekly averages | Verification that the plan is what was intended. |
| 22 | **Extended measurements** — skinfolds, circumferences, blood markers with in/out-of-range flags, bulk entry, progress view, printable results with charts | Broadens #7 to real clinical practice; bulk entry attacks the same time cost as the rest of this phase. |
| 23 | **Per-client file storage** — lab results, documents, spreadsheets | Expected of any practice system. |
| 24 | **Custom foods** — add a food with its energy, composition and micronutrients | Escape hatch for database gaps; prevents hard blocks mid-consultation. |
| 25 | **Favorite foods** — flag foods across any table, collected into one list | Directly attacks search time, the builder's main friction. |
| 26 | **Custom print templates** — colors, borders, fonts, category color-coding, hide analysis or quantities, rename days and meal times, multiple saved templates selectable per client | Professional identity: the output carries the practice's brand, not the vendor's. Category color-coding doubles as nutrition education for children, and font control makes plans legible for elderly clients. Differentiating, but nothing breaks without it. |

---

## Phase 2 — differentiation and the client-facing surface

Everything above serves the practitioner. This phase extends the product to the **end client**,
where both the pricing story and the retention story live.

| # | Feature | Rationale |
|---|---|---|
| 27 | **Client mobile app** — food logging with photo and text, exercise logging, water tracking against a goal, log history, view plans and notes, push notifications | The largest single expansion of product surface, and it presupposes the entire practitioner side exists. Design for *review*, not real-time surveillance: the highest-value use is a practitioner and client going through photo logs together to correct portion sizes, which no amount of live alerting replaces. |
| 28 | **Real-time micronutrient tracking** — select the micronutrients that matter (sodium, potassium, phosphorus, water), set targets and ceilings, values update live as foods are added | **The core competitive bet.** The category norm is to analyze a plan only after it is finished, forcing repeated back-and-forth revision. Live feedback while composing removes that loop entirely. The real cost is micronutrient-complete food data, not the UI. |
| 29 | **DRI display** — percentage of reference intake, hover for absolute values | Turns raw micronutrient numbers into a judgment. |
| 30 | **Consolidated client messaging** — one professional channel replacing scattered WhatsApp, Viber, social DMs and email | Solves a genuine daily pain, and doubles as a retention lock: once client conversations live here, leaving is expensive. |
| 31 | **Recipes** — ingredients, method, use inside plans, printable, with a generated nutrition label over selectable micronutrients | The nutrition label is a credible standalone selling point and is awkward or absent in most alternatives. |
| 32 | **Body-composition analyzer import** — device-agnostic CSV ingest with a mapping layer for unknown devices | Eliminates manual entry of measurement data. The mapping layer is the durable design choice: it makes any future device a configuration task rather than an engineering one. |
| 33 | **Business statistics** — revenue by period, cancellations, appointments held, projected revenue from bookings, client totals, month-over-month and year-over-year comparison | Speaks to the practice *owner* rather than the clinician — a different buying motivation, and the one that matters at renewal. |
| 34 | **Selective history export to PDF** — choose which sections to share with another professional | Supports interdisciplinary referral. Narrow audience, low build cost. |
| 35 | **Saved plan notes** reusable across plans | Minor, real, cheap. |
| 36 | **Custom food naming within a plan** — rename entries, attach preparation instructions | Removes the machine-generated feel of raw database names. |
| 37 | **Dashboard** — client birthdays this month, to-do list, the day's appointments, quick actions | Ranked late deliberately: it aggregates data that other features produce and is an empty shell until they exist. Build it last, then put it on the landing screen. |

---

## Phase 3 — moat, expertise, and ecosystem

Individually skippable; collectively the reason to choose this over a generic tool. These carry the
highest **content and maintenance** cost as distinct from engineering cost.

| # | Feature | Rationale |
|---|---|---|
| 38 | **Clinical conditions module** — per-condition dietary guidance for the practitioner, printable patient instructions, evidence-based supplement suggestions, background theory, diagnostic tools | The deepest available moat, and mostly a *curation* problem rather than a coding one. Ongoing clinical review is a standing commitment — exactly why it should not start early. Needs a named clinical owner before the first condition ships. |
| 39 | **Scientific calculators** — child BMI classification against growth references, triglyceride-glucose index for insulin resistance, dietary fiber requirement, chronic kidney disease staging | Individually small, each replacing a manual lookup or hand-read growth curve. Ship incrementally; every one is a self-contained unit of value. |
| 40 | **Practitioner network** — exchange plans, recipes and foods between professionals, with discussion, endorsement, and save-to-templates | Real network-effect potential, but a **cold-start problem**: worthless until a critical mass of practitioners is already on the platform. Correctly last. Attempted early, it is an empty room that makes the product look abandoned. |
| 41 | **Micronutrient export to CSV** — per-day values, DRI percentages, tolerable upper intake levels | Aimed at research use. Small build, high value to a small segment. |
| 42 | **Feature request and voting board** — practitioners submit ideas, vote on each other's, most-voted get built | Product-development infrastructure rather than product. Compounds over time and doubles as retention: users who vote feel ownership. |
| 43 | **Public changelog** | Makes #42 credible. Pairs with it or is noise. |
| 44 | **In-app support staffed by practising dietitians**, alongside phone and email | Domain-expert support rather than generalist support is a real quality signal in a clinical tool. |
| 45 | **Onboarding** — step-by-step training videos plus 1:1 sessions on request | "How will I ever learn this?" is the primary objection for a product this large. Deferred as a *build* item, but the objection must be answered from day one, even if a human does the training manually at first. |
| 46 | **Self-service demo booking** | Sales motion, not product. |

---

## Cross-cutting observations

**Sell time, not features.** The strongest argument this product can make is minutes reclaimed per
client: 10–15 minutes per intake through pre-visit questionnaires, a complete plan in under a
minute through auto-generation. Anything that removes manual work should outrank anything that adds
capability.

**Demo appeal and structural dependency disagree in three places** — each resolved in favor of
dependency:

- *Auto-generation* (#14) is the most impressive thing here, but cannot precede template meals (#11).
- *Print templates* (#26) are more visible than the measurement system (#22), but nothing breaks
  without them.
- *The dashboard* (#37) belongs on the landing screen and is ranked 37th, because it only surfaces
  what other features produce.

**Two items are content problems wearing engineering clothes.** The clinical conditions module
(#38) and the food database (#2) are curation and maintenance commitments, not build tasks. The
database is unavoidable and sits in the MVP; the clinical module is deferrable and should be
deferred until there is revenue to sustain its upkeep.

**One item has a cold-start dependency.** The practitioner network (#40) needs a practitioner
population before it is worth anything. It must follow adoption, never lead it.

**The competitive wedge is live feedback.** Category norm is to compose a plan and analyze it
afterwards, which forces revision loops. Real-time energy and macro feedback (#5) is in the MVP for
this reason, and micronutrient tracking (#28) extends the same idea once the data supports it. If
one sentence has to carry the positioning, it is this one.

**Hold one explicit non-goal: the software does not replace the dietitian.** The practitioner does
the clinical thinking up front by building the template library; automation only recombines and
scales what they already approved. This is what makes the automation clinically defensible, and it
should survive any future repositioning.

---

## Open questions

- **Growth-reference source for child BMI classification** (#39) — which reference set to
  standardize on. Affects how results are reported and defended.
- **Micronutrient data coverage** (#28) — the feature is gated on how complete the underlying food
  data is, not on the interface. Audit coverage before committing to the phase.
- **Clinical ownership** (#38) — a licensed clinician must own the guidance content and its review
  cycle. Without that named, this feature should not start.
