# Ivi

Cloud practice-management and diet-planning software for dietitians.

Spring Boot monolith, Java 21, PostgreSQL. Conventions live in [`CLAUDE.md`](./CLAUDE.md).

## Running locally

**Requirements:** JDK 21, Docker (for the database and for the integration tests).

```bash
docker compose up -d          # PostgreSQL on :5432
./gradlew bootRun             # application on :8080
```

Flyway applies migrations on startup. Verify:

```bash
curl localhost:8080/actuator/health
# {"status":"UP"}
```

A fresh database has no data in it beyond the food catalogue. To get clients, measurement
series and plans to look at:

```bash
./scripts/seed-demo-data.sh
```

Then sign in with `ivitester@maildrop.cc` / `ivitester@maildrop.cc`. The data is fabricated and
the script goes through the public API only — see [`scripts/README.md`](./scripts/README.md).

If you already run Postgres locally and would rather not use Compose, create the database and
point the app at it:

```sql
CREATE USER ivi WITH PASSWORD 'ivi';
CREATE DATABASE ivi OWNER ivi;
```

Connection settings are overridable with `DB_URL`, `DB_USERNAME` and `DB_PASSWORD`.

## Desktop preview build

A double-clickable bundle of the application, its UI, a real PostgreSQL and the demo data, for
putting Ivi in front of a practitioner who has neither Java nor Docker and should not have to
acquire either.

```bash
./gradlew distDesktop      # -> build/distributions/Ivi-<platform>.zip
```

| Task | Output |
|---|---|
| `desktopJar` | `build/libs/ivi-<version>-desktop.jar`, runnable with `java -jar` |
| `packageDesktop` | `build/desktop/Ivi.app` or `build/desktop/Ivi` |
| `distDesktop` | `build/distributions/Ivi-<platform>.zip` — the file you send |

They unzip it, double-click, and a browser opens on a working Ivi with eight demo clients in it.
No installation, no terminal, no configuration. A small window offers **Open Ivi**, **Reset demo
data** and **Quit**; their work persists between sessions.

**This is a demo vehicle, not a distribution channel.** MVP feature 9 is "cloud, browser-based —
no installation", and the roadmap is full of features a desktop-only application cannot deliver:
the client mobile app (27), the emailed pre-visit questionnaire (16), calendar sync (19).

### How it stays out of the way

The desktop dependencies live in `src/desktop`, their own source set with its own configuration
that `bootJar` never sees. Embedded PostgreSQL carries ~30 MB of native binaries and the control
window drags in Swing; neither belongs in a Cloud Run image. The deployed artifact is unchanged:

```bash
unzip -l build/libs/ivi-*-SNAPSHOT.jar | grep -c zonky    # 0
```

There is also **no `desktop` Spring profile**. This project configures itself from environment
variables with defaults, and `DesktopLauncher` passes its settings straight to
`SpringApplicationBuilder` — so in a cloud deployment the desktop path is not conditionally
disabled, its `main` is simply never called.

Embedded PostgreSQL rather than H2 because `V1__baseline.sql` creates the `citext` extension,
which H2's PostgreSQL compatibility mode does not implement. The migrations therefore run
**unchanged**, and the preview exercises the same database as production.

### Where it puts things

| | |
|---|---|
| Data — everything the practitioner enters | `~/Library/Application Support/Ivi/database` (macOS)<br>`%LOCALAPPDATA%\Ivi\database` (Windows) |
| Extracted PostgreSQL binaries, no data, safe to delete | `$TMPDIR/embedded-pg/PG-<hash>` |

Delete the first to get a fresh first run with the demo data reloaded. Neither has any connection
to the Docker volume used by `bootRun`.

### Refreshing the demo data

`scripts/seed-demo-data.sh` stays the single source of truth; the desktop build ships a SQL dump
of it, because the practitioner's machine has no bash, curl or jq:

```bash
./scripts/seed-demo-data.sh --reset      # against a running dev instance
./scripts/generate-desktop-seed.sh       # rewrites src/desktop/resources/demo-data.sql
```

### Before you send it anywhere

jpackage builds only for the platform it runs on — **the Windows bundle must be produced on
Windows**. Windows SmartScreen will block an unsigned executable on first launch, and the
Postgres binaries need the Visual C++ runtime.

Most importantly: **no real client records**. It has no backups and none of the safeguards
Article 9 data requires.

[`docs/desktop-preview.md`](./docs/desktop-preview.md) covers all of this in full;
[`docs/ivi-preview-setup.md`](./docs/ivi-preview-setup.md) is the one-pager to send with the zip.

## Tests

```bash
./gradlew test                                # everything
./gradlew test --tests "com.ivi.app.*.unit.*" # unit only, no Docker needed
```

Integration tests start a real PostgreSQL through Testcontainers, so **Docker must be running**.
Unit tests, including the architecture rules, have no such requirement.

## Layout

```
src/main/java/com/ivi/app/
├── shared/              # cross-cutting only: config, dto, exception
│   ├── config/          # CorrelationIdFilter
│   ├── dto/             # PagedResponse
│   └── exception/       # BusinessException, ResourceNotFoundException, GlobalExceptionHandler
└── IviApplication.java

src/main/resources/
├── application.yml
├── logback-spring.xml   # structured JSON, correlation id in MDC
└── db/migration/        # Flyway; the schema is owned here, never by Hibernate

src/desktop/             # desktop preview launcher and its demo data.
                         # Own source set — bootJar never sees it.

infrastructure/          # Terraform. All cloud resources, no exceptions.
docs/                    # roadmap, MVP analysis, UI palette, desktop preview
scripts/                 # developer utilities; not part of the build
```

Feature modules arrive as `com.ivi.app.<feature>` with their own `controller`, `service`,
`repository`, `model`, `dto` and `mapper` packages. `shared` is for things used by two or more
modules and holds no business logic.

## Notes

- **The schema belongs to Flyway.** Hibernate runs with `ddl-auto: validate` and never writes DDL.
- **Structured JSON logs** in every environment, each line carrying a correlation id taken from
  `X-Correlation-Id` or generated per request.
- **Architecture rules are enforced by tests**, not by convention. See `ArchitectureTest`. They are
  written to allow empty matches, so they constrain feature code as it arrives.
