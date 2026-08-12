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

If you already run Postgres locally and would rather not use Compose, create the database and
point the app at it:

```sql
CREATE USER ivi WITH PASSWORD 'ivi';
CREATE DATABASE ivi OWNER ivi;
```

Connection settings are overridable with `DB_URL`, `DB_USERNAME` and `DB_PASSWORD`.

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

infrastructure/          # Terraform. All cloud resources, no exceptions.
docs/                    # roadmap, MVP analysis, UI palette
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
