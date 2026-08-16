# Infrastructure

All Google Cloud resources for Ivi are provisioned here, with Terraform. Nothing is created through
the Console or `gcloud` — see [`../CLAUDE.md`](../CLAUDE.md).

## Layout

```
infrastructure/
├── bootstrap/              # State bucket + Terraform service account. Applied once.
├── modules/
│   ├── network/            # VPC, subnet, private services access for Cloud SQL
│   ├── data/               # Cloud SQL Postgres, GCS buckets
│   ├── runtime/            # Artifact Registry, Cloud Run, service accounts, Secret Manager
│   └── perimeter/          # Global load balancer + Cloud Armor        ← deferred for beta
└── environments/
    ├── beta/               # enable_perimeter = false
    └── prod/               # enable_perimeter = true
```

`bootstrap/` is separate because of a chicken-and-egg problem: it creates the GCS bucket that holds
everyone else's state. Apply it once with local state, migrate its own state into the bucket it
created, then leave it alone.

## What is deferred, and what emphatically is not

The deferred module is called **`perimeter`**, not `security`. That distinction is deliberate and
worth keeping.

Only the **edge perimeter** is deferred: the global load balancer and Cloud Armor. Those address
automated scanning, bots and volumetric attacks — the *lowest-damage* threats to this product — and
they cost roughly $33–40/month in fixed charges regardless of traffic. For a closed beta with a
handful of known practitioners and no public signup page, that spend buys very little.

Everything that addresses the high-damage threats is **day one, in the modules below**, and is not
deferrable:

| Control | Lives in | Why it is not deferred |
|---|---|---|
| Cloud SQL on private IP, no public IP | `data` | Public database endpoints are how beta data gets lost |
| Secrets in Secret Manager | `runtime` | Never in environment variables or deploy config |
| Least-privilege service accounts | `runtime` | Retrofitting IAM is painful and usually skipped |
| Uniform bucket-level access, no public objects | `data` | Client files are health data |
| EU region pinning | all | GDPR posture |
| Audit log sinks and retention | `runtime` | Breach notification requires knowing what was accessed |

Tenant isolation, MFA and application-level audit logging are application concerns and live in the
codebase, not here. They are likewise not deferrable.

**If the perimeter is still off when public signup opens, that is a bug.** Turning it on is the
gate for going public, not a later nice-to-have.

## Flipping the perimeter on

`enable_perimeter` is not a standalone switch — it is coupled to the runtime module, and this is
the one part of the deferral that needs care:

- **Off** — Cloud Run ingress is `all`, reachable directly on its `*.run.app` URL over
  Google-managed TLS.
- **On** — Cloud Run ingress must become `internal-and-cloud-load-balancing`, so the service is
  reachable *only* through the load balancer. Leaving ingress open would mean traffic could bypass
  Cloud Armor entirely, which is the failure mode worth guarding against.

Both settings are driven from the same variable so they cannot drift apart. Flipping it also means
a managed certificate and a DNS cutover, so plan it as a deliberate change rather than a flag flip
on a Friday.

There is a third thing coupled to the same switch, in the application rather than the
infrastructure: the runtime module sets **`TRUSTED_PROXY_COUNT`** on the Cloud Run service, and it
must move from `0` to `1` at the same time. It is how many `X-Forwarded-For` entries were appended
by proxies we control, counting from the right, and adding a load balancer adds a hop.

Both directions of getting it wrong are quiet, which is why it belongs in this section rather than
in a runbook:

- **Too low** (left at `0` behind the balancer) — every request appears to come from the balancer,
  so the per-address login limit stops telling callers apart. It degrades safely; the per-email
  limit still protects individual accounts.
- **Too high** (left at `1` with the perimeter off) — the header is believed when nothing trustworthy
  is writing it, so a caller can choose their own address and both evade the per-address limit and
  forge the address in the audit trail. This is the dangerous direction, and it is the one that
  happens if the perimeter is ever turned back off without touching the variable.

## Conventions

- One state file per environment, in the bootstrap bucket, with versioning and locking enabled.
- Provider and module versions pinned. No floating constraints.
- No secret values in `.tfvars`, ever. Secrets are created empty by Terraform and populated out of
  band; Terraform manages the container, not the contents.
- `terraform plan` must be clean before a change is considered done.
- Beta and prod differ only through variables, never through divergent resource definitions.
