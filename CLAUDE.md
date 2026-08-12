# Ivi — Project Conventions

Cloud practice-management and diet-planning software for dietitians. Java Spring Boot monolith on
Google Cloud, with the frontend compiled into the same artifact.

## Infrastructure provisioning

**All cloud resources are provisioned through Terraform. Without exception.**

- Terraform lives in `infrastructure/` in this repository, versioned alongside application code.
- **Never create, modify, or delete cloud resources through the Google Cloud Console, `gcloud`, or
  any other out-of-band route.** Console changes cause state drift, and drift in a system holding
  health data is a compliance problem as well as an operational one.
- If a resource exists that Terraform does not describe, that is a defect. Either import it or
  delete it.
- A change is not finished until `terraform plan` is clean against the deployed environment.
- State lives in a versioned GCS bucket with locking — never locally, never in the repository.

See [`infrastructure/README.md`](./infrastructure/README.md) for the layer layout and what is
deliberately deferred.

## Build and stack

- Java Spring Boot monolith, **Gradle** (Kotlin DSL).
- Frontend is React + TypeScript + Vite under `src/main/frontend`, built by `gradle-node-plugin`
  and copied onto the classpath under `static/`. One deployable artifact.
- PostgreSQL via Cloud SQL. Schema changes through Flyway migrations only — never auto-DDL,
  including for framework-owned tables such as Spring Session.
- Sessions are server-side and revocable, stored in Postgres via Spring Session JDBC. No Redis.
  Do not replace these with stateless JWTs: instant revocation is a deliberate security property.

## Code conventions

Two skills in `.claude/skills/` are authoritative and apply to all Java work:

- **`spring-boot-clean-code`** — feature-based modules, six layers per module, record DTOs, manual
  static mappers, entities confined to their module, inter-module calls through services only,
  centralized exception handling, paginated collections.
- **`spring-boot-testing`** — three-layer test pyramid, BDD Mockito, AssertJ, Testcontainers.

Follow them rather than restating or re-deriving their rules.

## Data handling

Client records contain weight, body composition, blood markers and clinical notes. This is
**special-category personal data under GDPR Article 9**. Consequences that bind every feature:

- Tenant isolation is enforced structurally: every repository method reading tenant-owned data
  takes an explicit `practitionerId`, sourced from the security context and never from the request.
  An ArchUnit test guards this.
- Cross-tenant access attempts return **404, not 403** — a 403 confirms the record exists.
- Application-level audit logging of who read which client record. Infrastructure audit logs do not
  cover this.
- Data stays in an EU region.

## Reference documents

- [`docs/ivi-feature-roadmap.md`](./docs/ivi-feature-roadmap.md) — the 46 features, phased.
- [`docs/mvp-build-analysis.md`](./docs/mvp-build-analysis.md) — MVP architecture, module map,
  schemas, build order, risks.
