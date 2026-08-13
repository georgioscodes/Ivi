# Ivi — UI Palette

Initial brand palette, with the accessibility constraints that follow from it and the tokens needed
to complete it.

## Brand colours

| Token | Hex | Description |
|---|---|---|
| `--brand-taupe` | `#a18276` | Warm taupe |
| `--brand-sage` | `#b9d2b1` | Sage green |
| `--brand-sand` | `#dac6b5` | Sand |
| `--brand-peach` | `#f1d6b8` | Peach |
| `--brand-pink` | `#fbacbe` | Pink |

Soft, warm and calm — a good register for a health product used all day, and a deliberate step away
from the cold blue-and-white of most clinical software.

## What the contrast maths says

Measured as WCAG 2.1 contrast ratios. AA requires 4.5:1 for body text, 3:1 for large text and UI
components.

| Colour | vs white | vs black | As text on white | White text on it |
|---|---|---|---|---|
| `#a18276` | 3.52 | 5.97 | AA-large only | Fail |
| `#b9d2b1` | 1.63 | 12.92 | Fail | Fail |
| `#dac6b5` | 1.65 | 12.73 | Fail | Fail |
| `#f1d6b8` | 1.40 | 15.05 | Fail | Fail |
| `#fbacbe` | 1.79 | 11.75 | Fail | Fail |

**These are surface colours, not ink.** None can carry body text on a white background, and none can
take white text on top. That is not a flaw — it is what a soft palette in this luminance band is
for. Used the right way round, they are excellent: with the dark ink below, every one of them
reaches AAA.

| Ink `#2b2320` on | Ratio | |
|---|---|---|
| `#f1d6b8` | 11.03 | AAA |
| `#b9d2b1` | 9.47 | AAA |
| `#dac6b5` | 9.33 | AAA |
| `#fbacbe` | 8.61 | AAA |
| `#a18276` | 4.38 | AA-large only — see below |

So: **brand colours as fills, dark ink on top.** Never brand-on-white for text, never white-on-brand.

`#a18276` is the exception in both directions — it is the only one dark enough to work as
large text or an icon on white, and the only one where dark ink on top drops below AA. Treat it as
a mid-tone: fine for large headings on white, fine as a fill behind large text, not fine for body
copy in either direction.

## The palette cannot encode categories

Pairwise contrast between the brand colours:

| | taupe | sage | sand | peach | pink |
|---|---|---|---|---|---|
| **taupe** | — | 2.16 | 2.13 | 2.52 | 1.97 |
| **sage** | 2.16 | — | **1.01** | 1.17 | 1.10 |
| **sand** | 2.13 | 1.01 | — | 1.18 | 1.08 |
| **peach** | 2.52 | 1.17 | 1.18 | — | 1.28 |
| **pink** | 1.79 | 1.10 | 1.08 | 1.28 | — |

Sage and sand differ by **1.01** — effectively identical luminance. Four of the five sit in a narrow
band, and three of those are warm neutrals of near-identical hue family. Distinguishing them
depends almost entirely on hue, which fails for colour-vision deficiency and fails again on a
projector, a cheap monitor, or a greyscale print of a diet plan.

This matters in two specific places in this product:

- **Food category colour-coding** (roadmap #26) needs five reliably distinguishable categories —
  fresh, carbohydrate, fat, protein, composite. This palette has five colours and cannot do it.
- **Chart series** for measurement history, and the **progress bars** for energy and macros
  (roadmap #5), have the same requirement.

Both need a separate categorical scale designed for separation, plus a non-colour channel — label,
pattern or icon — carrying the same information. Do not solve this by reaching for the brand five.

## Tokens still needed

Proposed and contrast-verified, but not yet signed off. The brand colours above are decided; these
are a recommendation.

### Ink and surface

| Token | Hex | Contrast on surface | Use |
|---|---|---|---|
| `--ink` | `#2b2320` | 14.91 AAA | Body text, headings. Warm near-black, not pure `#000` |
| `--ink-muted` | `#5c4f49` | 7.62 AAA | Secondary text, labels, captions |
| `--surface` | `#fdfbf9` | — | Page background. Warm white to sit with the palette |

### Semantic

Needed because the brand palette has no way to say *wrong*, and the plan builder must signal when a
target is exceeded. All verified at AA or better both as text on surface and with white text on top.

| Token | Hex | Use |
|---|---|---|
| `--error` | `#a03530` | Over target, validation failure, destructive action |
| `--warning` | `#8a5a1a` | Approaching a limit, unsaved changes |
| `--success` | `#3f6b45` | Within target, saved |
| `--info` | `#3a5f7d` | Neutral information |

These are deliberately desaturated to sit alongside the brand tones rather than shout over them.
Note that `--success` is close in hue to `--brand-sage`: keep sage decorative and reserve the
semantic green for state, or the two will be read as the same signal.

### Neutrals

Warm-tinted rather than pure grey, so a border next to sand or peach does not read as cold.
Measured against `--surface` (`#fdfbf9`):

| Token | Hex | vs surface | Use |
|---|---|---|---|
| `--grey-50` | `#f6f2ef` | 1.08 | Subtle fill, row hover |
| `--grey-100` | `#ece5e0` | 1.21 | Divider |
| `--grey-200` | `#ded4cc` | 1.41 | Decorative border, disabled fill |
| `--grey-300` | `#c6b9af` | 1.86 | Border where nothing depends on seeing it |
| `--grey-400` | `#9d8e84` | **3.07** | Input and control boundaries |
| `--grey-500` | `#7f7067` | **4.61** | Placeholder and de-emphasised text |
| `--grey-600` | `#665a53` | 6.45 | Secondary text |
| `--grey-700` | `#4a403b` | 9.74 | Near-ink |

Only two of these carry a requirement, and both were tuned to clear it rather than chosen and
hoped for. `--grey-400` meets the 3:1 that WCAG 1.4.11 asks of a UI component boundary — an input
whose edge cannot be seen is an input that cannot be found. `--grey-500` meets 4.5:1 as body text,
because "de-emphasised" is not the same as "optional to read". The rest are decorative and can be
adjusted by eye.

Implemented in `src/main/frontend/src/styles/tokens.css`.

## Rules

1. Brand colours are **fills and surfaces**. Dark ink goes on top of them.
2. Never white text on a brand colour. Never brand-coloured body text on white.
3. `#a18276` only for large text or icons, and only on white.
4. Never use the brand five to encode category or series — see above.
5. Colour is never the sole carrier of meaning. Every state signalled by colour also has a label,
   icon or text.
6. Targets are AA minimum, AAA for body text. Verify rather than assume.

## Dark theme

Not attempted here. This palette is built for light backgrounds, and every one of the five loses its
character when it has to sit on a dark surface — they would need re-deriving rather than inverting.
Worth doing deliberately later, not as a mechanical flip.
