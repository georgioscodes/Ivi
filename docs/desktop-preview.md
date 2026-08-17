# Desktop preview build

A double-clickable bundle of the whole application — server, UI, database and demo data — for
putting Ivi in front of a practitioner who has neither Java nor Docker and should not have to
acquire either.

## What this is not

**It is not the product.** MVP feature 9 is "cloud, browser-based — no installation; desktop,
tablet, mobile", and the roadmap is full of features a desktop-only application cannot deliver:
the client mobile app with push notifications (27), the emailed pre-visit questionnaire (16),
two-way Google Calendar sync (19), client messaging (30), the practitioner network (40). Each of
those needs a server that is awake when the practitioner's laptop is not.

It exists so somebody can *use* the software before there is anywhere to host it. Treat it as a
demo you can hand over, and delete it when it has served that purpose.

## How it fits together

```
Ivi.app / Ivi.exe
└── bundled Java runtime               (jpackage — nothing to install)
    └── ivi-<version>-desktop.jar
        ├── the application + compiled frontend
        ├── embedded PostgreSQL         (real Postgres, not H2)
        └── demo-data.sql
```

On launch, `DesktopLauncher`:

1. creates a data directory under the user's profile —
   `%LOCALAPPDATA%\Ivi` on Windows, `~/Library/Application Support/Ivi` on macOS
2. starts PostgreSQL against it on a free port
3. boots the application on `127.0.0.1`, first free port from 8080
4. lets Flyway migrate, exactly as it does anywhere else
5. loads `demo-data.sql` if the database has no practitioner in it
6. opens the default browser, and shows a small window with **Open Ivi**, **Reset demo data**
   and **Quit**

The data directory persists between launches, so the practitioner can work across several
sessions. **Reset demo data** puts the demo clients back.

### Why embedded PostgreSQL rather than H2

`V1__baseline.sql` runs `CREATE EXTENSION citext`, and two tables use `CITEXT` columns. H2's
PostgreSQL compatibility mode does not implement it. Embedded PostgreSQL ships the real server
binaries, including contrib, so **the migrations run unchanged** and the desktop build exercises
the same database as production. It also means anything a practitioner enters during a preview is
a `pg_dump` away from their cloud account later.

The PostgreSQL major version is pinned at 16 to match. Changing it would leave an existing data
directory unreadable.

### Why there is no `desktop` Spring profile

This project has no profiles at all. It configures itself from environment variables with
defaults — `${DB_URL:…}`, `${COOKIE_SECURE:false}` — and one artifact behaves differently by
environment, not by profile. A profile here would be a second, divergent way to do the same
thing, and profiles drift until something works in one and breaks in the other.

`DesktopLauncher` passes its settings straight to `SpringApplicationBuilder`. In a cloud
deployment the desktop code is not conditionally disabled; its `main` is simply never called.

### Why a separate source set

Embedded PostgreSQL carries ~30 MB of native binaries and the control window drags in Swing.
Neither belongs in a Cloud Run image. `src/desktop` has its own dependency configuration that
`bootJar` never sees, so the deployed artifact is unchanged — verifiable with:

```bash
./gradlew bootJar
unzip -l build/libs/ivi-*-SNAPSHOT.jar | grep -c zonky    # 0
```

## Building it

Requires JDK 21 on the build machine. Nothing else — Gradle and Node are downloaded by the build.

```bash
./gradlew distDesktop
```

Produces `build/distributions/Ivi-<platform>.zip`. That is the file you send.

| Task | Output |
|---|---|
| `desktopJar` | `build/libs/ivi-<version>-desktop.jar`, runnable with `java -jar` |
| `packageDesktop` | `build/desktop/Ivi.app` or `build/desktop/Ivi` |
| `distDesktop` | `build/distributions/Ivi-<platform>.zip` |

**jpackage can only build for the platform it runs on.** The Windows bundle has to be produced on
Windows; there is no cross-compilation. The build picks the embedded PostgreSQL binaries for the
host automatically, so each bundle carries one platform's binaries rather than all five.

Roughly 264 MB unpacked, 142 MB zipped.

### Refreshing the demo data

`scripts/seed-demo-data.sh` remains the single source of truth. The desktop build cannot run it —
the practitioner's machine has no bash, curl or jq — so it is dumped to SQL:

```bash
./scripts/seed-demo-data.sh --reset      # against a running dev instance
./scripts/generate-desktop-seed.sh       # rewrites src/desktop/resources/demo-data.sql
```

The generated file truncates before loading, which is both what makes it idempotent and what
makes **Reset demo data** work. It is dumped from a filtered throwaway copy of the development
database, so other practitioner accounts on your machine do not end up inside it.

## Before sending it to anyone

**Do not let real client records into this.** A working application in a dietitian's hands
invites real patients being typed in, and that would put Article 9 health data on a personal
laptop: unencrypted, outside the infrastructure, no backup, no processing agreement, and an audit
log you cannot produce from. The control window says so on screen; say it out loud as well.

**Windows SmartScreen** will block an unsigned executable on first launch — *More info* → *Run
anyway*. Their antivirus may also object to an unsigned program that starts `postgres.exe` and
opens a port. [`ivi-preview-setup.md`](./ivi-preview-setup.md) is a one-pager written for the
practitioner that walks through it; send that with the zip.

**The Visual C++ runtime.** The PostgreSQL Windows binaries link against it. It is present on most
Windows installations, but it is the likeliest thing to fail on a specific machine and the one
item that cannot be checked from a Mac. Test on the target machine early.

## Verified

The whole path — build, zip, unzip, double-click, first-run initdb, migrations, demo data load,
sign in, browse, PDF export — has been run end to end **on macOS (Apple Silicon)**. A clean first
run takes about 10 seconds; later ones the same.

**The Windows bundle has not been built or run.** The code is platform-neutral and the packaging
is the same jpackage invocation, but nothing on Windows has been executed. Expect the first
Windows build to need a fix or two.
