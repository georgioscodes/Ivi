# scripts

Developer utilities. Nothing here is part of the build or the deployed artifact.

| | |
|---|---|
| [`seed-demo-data.sh`](#seed-demo-datash) | Fills a local instance with demo data through the API |
| [`generate-desktop-seed.sh`](#generate-desktop-seedsh) | Dumps that data into the SQL the desktop build ships |

## `seed-demo-data.sh`

Fills a local instance with enough data to exercise the UI — charts with real trends, plans with
meals in them, clients at different stages, and one client left empty so empty states get
tested too.

```bash
docker compose up -d
./gradlew bootRun          # in another terminal

./scripts/seed-demo-data.sh
```

Sign in afterwards at <http://localhost:8080> with **`ivitester@maildrop.cc`** /
**`ivitester@maildrop.cc`**.

Re-running adds a second copy of everything. To start over instead:

```bash
./scripts/seed-demo-data.sh --reset
```

`--reset` deletes every client on the account — which cascades to their measurements, journal
entries and plans — and the practitioner's own foods. It leaves the shared food catalogue alone,
since that belongs to the Flyway seed rather than to the account.

### What it creates

| | |
|---|---|
| Practitioner | 1, with a published password |
| Clients | 8, one of them deliberately empty |
| Measurements | 189, as dated batches across 9 measurement types |
| Journal entries | 22, multi-paragraph Greek clinical notes |
| Plans | 8, spanning 1–7 days, covering `DRAFT`, `ISSUED` and `ARCHIVED` |
| Practitioner-owned foods | 4, on top of the 34 in the catalogue |
| Catalogue suggestions | 1 |

The data is shaped for looking at, not just for existing:

- **Measurement series move in one direction.** Μαρία drops 86.4 → 77.9 kg over eight monthly
  visits with her waist following; Γιώργος gains weight while body fat falls; Ελένη's weight is
  flat within 0.9 kg while her composition shifts; Άννα's weight rises, which for her is the
  intended outcome. A chart of random numbers cannot tell you whether the chart works.
- **Visit intervals vary** — monthly, six-weekly, irregular — so the x axis is not evenly spaced
  everywhere.
- **Issued plans land within a few percent of their energy target**, but individual macros run
  from 65% to 123%. A UI that only ever renders on-target bars has not really been tested. The
  one draft sits at roughly three quarters of target, because that is what a plan
  mid-construction looks like.

### Configuration

| Variable | Default |
|---|---|
| `IVI_BASE_URL` | `http://localhost:8080` |
| `IVI_EMAIL` | `ivitester@maildrop.cc` |
| `IVI_PASSWORD` | `ivitester@maildrop.cc` |

Requires `bash`, `curl` and `jq`. It sticks to bash 3.2 features so it runs on the bash macOS
ships, without Homebrew.

### Everything goes through the API

No SQL, no direct database access. The script registers, signs in, and then uses the same
endpoints the frontend uses, which means it exercises validation, tenant scoping and the audit
trail on the way in — and a seeding run that succeeds is itself a check that those endpoints
work. It handles CSRF the way the SPA does, reading the `XSRF-TOKEN` cookie and echoing it in
the `X-XSRF-TOKEN` header.

It finishes by reading everything back and printing per-client counts and each plan's macro
percentages, so a run that silently half-worked is visible rather than assumed.

### This is fabricated data

The names, readings and clinical notes were written to look plausible on screen. None of it
describes a real person, and none of it is measured composition data.

**Never point this at an environment holding real client records.** It creates an account whose
password is published in this repository, and `--reset` deletes clients irreversibly. It is for
local development against a throwaway database.

---

## `generate-desktop-seed.sh`

Rewrites `src/desktop/resources/demo-data.sql`, the demo data the
[desktop preview build](../docs/desktop-preview.md) ships with.

`seed-demo-data.sh` stays the single source of truth for what the data *is*. The desktop app
cannot run it — the practitioner's machine has no bash, curl or jq — so this turns the result of
a seeding run into SQL the launcher can execute directly.

```bash
docker compose up -d
./gradlew bootRun                    # in another terminal
./scripts/seed-demo-data.sh --reset
./scripts/generate-desktop-seed.sh
```

Run it after any change to `seed-demo-data.sh`, otherwise the desktop build keeps shipping the
previous version of the data.

### What it does that a plain `pg_dump` would not

**It filters out everything that is not the demo account.** A development database usually holds
other practitioners created while testing, each with their own clients, and a straight dump would
ship all of them. So the dump is taken from a throwaway copy with everything else deleted, which
leaves your development database untouched.

**It produces a script that truncates before loading.** That makes it idempotent and is what
implements the desktop app's *Reset demo data* — there is no separate teardown to keep in step.
It also means the reference data inserted by migrations V5 and V7 is replaced wholesale rather
than colliding with the dump.

**It resets the identity sequences afterwards.** The rows carry explicit ids, which does not
advance the sequences behind them; without the reset, the first client the practitioner creates
collides with an existing id. It is driven off the catalogue rather than a fixed list, so a new
table does not silently miss out.

The generated file is committed, so building the desktop bundle does not require a database.
