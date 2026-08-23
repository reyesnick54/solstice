# Phase I Prompt 4 — Production infrastructure, cloud deployment, and preproduction

`CORE_CODE_COMPLETE_CANDIDATE=true`
`PRODUCTION_READY=false`
`PRODUCTION_ACTIVE=false`
`LIVE_CONNECTIVITY_ENABLED=false`
`production_authorized=false`
`ENVIRONMENT=simulation`
`MAINNET_ACTIVE=false`
`SAFE_TO_PROCEED_TO_PHASE_I_PROMPT_5=true`

This prompt productizes existing provider-neutral infrastructure into a
repeatable preproduction platform. It does not activate live customer
production. It does not flip `LIVE_*` flags. It does not enable mainnet.

Phase I Prompts 1–3 were not present on this tree when this work
started. This prompt extends Chunk 66 (`sunrey-production-infrastructure`)
and Chunk 86 (`sunrey-production-provisioning`) rather than creating a
second deployment owner. Secret references continue to use the Chunk 66
/ Chunk 149 `secret://` plane.

Do not begin Prompt 5 in this record.

## Canonical owner

| Concern | Path |
| --- | --- |
| Control plane | `packages/sunrey-chain/src/infra` |
| Preproduction productization | `packages/sunrey-chain/src/infra/preproduction` |
| OpenTofu modules | `infra/sunrey-production/modules` |
| Helm chart | `infra/sunrey-production/helm/sunrey-preproduction` |
| Environment overlays | `infra/sunrey-production/environments` |
| Versioned release record | `infra/sunrey-production/releases/preproduction-release.json` |
| Platform container | `deploy/sunrey-preproduction/docker/sunrey-platform.Dockerfile` |
| Testnet (unchanged) | `deploy/sunrey-testnet` |

Do not create `packages/infrastructure`, `packages/deploy`,
`packages/sunrey-infra`, or a second Kubernetes control plane.

## 1. Infrastructure audit

Inspected and classified:

| Surface | Status |
| --- | --- |
| `packages/sunrey-chain/src/infra` | Deployable control plane (Chunk 66) |
| `packages/sunrey-chain/src/infra/provisioning` | Plan-first provisioning (Chunk 86) |
| `infra/sunrey-production/modules/*` | Provider-neutral modules; previously plan/output stubs |
| Helm `sunrey-production-candidate` | Placeholder network policy only |
| `deploy/sunrey-testnet` | Deployable testnet, not the product platform |
| CI / signed release | Present; production apply absent |
| `db/*/migrations` | Versioned SQL from zero |
| Chain validator/RPC/Explorer | Present as chain modules |

Placeholders that this prompt productized: platform Helm chart, queue /
cache / DNS / TLS / load-balancer modules, environment overlays,
versioned release configuration, and a local/rehearsal renderer.

## 2. Environment model

`LOCAL` → `TEST` → `SANDBOX` → `STAGING` → `PREPRODUCTION` → `PRODUCTION`

Each environment has a unique namespace and explicit boundaries in
`packages/sunrey-chain/src/infra/preproduction/environments.ts`.

PREPRODUCTION resembles production topology (replicas, TLS, private
data plane, signed artifacts, sandbox/certification/preproduction
providers). It does not authorize live money, mainnet, or production
KMS.

PRODUCTION exists as configuration and fails closed without approved
KMS/HSM. Promotion into it is human-gated and does not deploy.

## 3. Infrastructure modules

Reusable OpenTofu modules (provider-neutral):

network/VPC and subnets, firewall default-deny, load balancer,
Kubernetes compute, PostgreSQL, object storage, queue, cache, secrets,
monitoring, backup, DNS/TLS abstraction, validator, sentry, RPC,
Explorer.

No commercial cloud is hard-coded.

## 4. High availability

Preproduction validates:

- application and worker replicas ≥ 2
- PostgreSQL `PRIMARY_SYNC_REPLICA`
- load balancer at the public edge
- rolling updates (`maxUnavailable: 0`)
- migration job before incompatible rollout
- backup CronJob

Geographic HA is **not** claimed.

## 5. Service deployments

Canonical deployable workloads:

API, Consumer BFF, workers, event-processor, Agent Runtime, Model
Gateway, Exchange, operations API, treasury/reconciliation jobs,
Vault, HIN, Chain RPC, Explorer.

Unused legacy services (`strategy-lab`, `agentic-capital-mesh`,
legacy consumer-platform) are excluded.

## 6–9. Persistence, queues, storage, secrets

- PostgreSQL: TLS, PITR-capable HA, role separation, pgbouncer,
  `secret://` credentials, migrate-before-rollout Job.
- Queues: durable events, jobs, workflows, dead letters. Process
  memory is forbidden for production-critical async work.
- Object storage: evidence, exports, Vault objects, audit bundles,
  backups — encrypted, private, versioned.
- Secrets: Chunk 66 / 149 references only. Preproduction may use an
  isolated non-production secret implementation. Production fails
  closed without approved KMS/HSM. No credentials are committed.

## 10–12. TLS, network, resources

TLS is required on public financial APIs. Domain templates support a
future `api.sunrey.xyz` without confirming DNS. Rehearsal hosts use
`*.example.invalid`.

Network policies: default deny, public API, database isolation, ops
isolation, validator/RPC separation, key-service isolation.

CPU/memory requests and limits plus HPA hooks are set for API, Agent,
Exchange, workers, and RPC.

## 13–15. Deployment strategy and release artifacts

Rolling is default. Agent and Model Gateway use canary. Exchange uses
blue/green. Application rollback returns to the previous signed
digest. Financial schema changes are forward-fix only.

Deployments use versioned, signed, digest-pinned artifacts. Floating
tags cannot satisfy preproduction or later.

The versioned release record stores application version, container
digest, migration version, policy versions, Agent policy, tool
versions, provider config references, and chain config.

## 16–21. Preproduction rehearsal

Cloud credentials are unavailable in this environment. The rehearsal
renders Helm, validates IaC paths, simulates migrations from zero and
from the prior customer schema, runs smoke contracts, verifies
artifact signatures, and proves rollback/drift/posture.

It does **not** fabricate a cloud apply.

Testnet remains the bound chain (`net_sunrey_testnet_1`). Mainnet is
inactive.

Smoke surfaces: health, auth, BFF, accounts, payments/FX/cards
sandbox, Grow, Agent, Exchange, wallets, Vault, HIN, operations, RPC.

Posture: `production_authorized=false`, mainnet inactive, live
providers disabled, live data marketplace disabled, real native
issuance disabled.

## 22–24. CI/CD, rollback, drift

Promotion: `BUILD → TEST → SIGN → STAGING → PREPRODUCTION → HUMAN_APPROVAL → FUTURE_PRODUCTION`.

The future-production job is disabled (`if: false`). Manual
infrastructure drift is classified `UNAUTHORIZED_DRIFT` when the
observed hash diverges from the approved plan.

## 25. Companion documents

- `docs/productization/SUNREY_PREPRODUCTION_DEPLOYMENT_GUIDE.md`
- `docs/productization/SUNREY_RELEASE_PROMOTION_POLICY.md`

## 26. Validation

`npm test` includes `packages/sunrey-chain/src/infra-preproduction.test.ts`.
`npm run demo:sunrey-preproduction` runs the rehearsal. Helm lint is
used when `helm` is installed; otherwise the TypeScript renderer is
the validator. Secret scan and container-pin checks cover the new
Dockerfile.

## Definition of done

- deployment topology productized
- environment isolation works
- canonical services are deployable
- database / queues / storage are persistent
- secrets are referenced securely
- TLS and network policies exist
- signed release artifacts are required
- preproduction rehearsal succeeds
- smoke tests pass
- rollback is tested (application) and documented (database)
- CI/CD promotion exists
- production remains human-gated
- mainnet remains off
- live providers remain off
