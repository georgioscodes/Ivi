# End-to-end tests

Playwright, against the real jar and a real Postgres. Not a second unit suite: everything here is
something the component tests structurally cannot see.

| Spec | What it holds to account |
|---|---|
| `keyboard.spec.ts` | Focus order, focus restore, dialog naming and trapping, the skip link |
| `greek.spec.ts` | That the bundled font loaded, that no glyph is missing, Greek number formats |
| `contrast.spec.ts` | Contrast measured from the painted page, not from the token table |
| `layout.spec.ts` | Horizontal overflow and tap-target size, at desktop and tablet widths |

## Running them

The application must already be running — these tests do not start it, because a suite that owns
the database lifecycle is a suite nobody runs.

```bash
java -jar build/libs/ivi-0.0.1-SNAPSHOT.jar &   # or ./gradlew bootRun
./gradlew e2e                                    # or: npm run test:e2e
```

Against something other than `localhost:8080`:

```bash
IVI_BASE_URL=https://staging.example.gr ./gradlew e2e
```

If the machine already has a Chromium — a container image, a pinned CI browser — point at it
instead of downloading another:

```bash
IVI_CHROMIUM=/opt/pw-browsers/chromium ./gradlew e2e
```

## Why these are not part of `check`

`./gradlew check` must pass on a laptop with nothing running. These need a server and a database,
so they are their own task. A check that fails for reasons unrelated to the change is a check
people learn to skip.

## Fixtures

`fixtures.ts` seeds a fresh practitioner, client, plan and journal entry through the API for every
test, and hands back their ids. Seeded rather than clicked: these tests are about the rendered
result, and clicking the setup would make every spec depend on every form.

Each test gets its own practitioner, so tenant isolation doubles as test isolation — no test can
see another's data, and none needs a cleanup step.
