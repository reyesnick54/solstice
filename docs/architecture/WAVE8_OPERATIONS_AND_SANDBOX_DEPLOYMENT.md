# Wave 8 — Operations and Sandbox Deployment

**Program:** SunRey Sovereign Architecture — Wave 8  
**Date:** 2026-09-02  
**Status:** Simulation sandbox (operations plane)  
**Owner:** `services/api` (operations HTTP) + `packages/sunrey-chain/src/ops/control-room`  
**Environment:** `simulation`; all `LIVE_*` flags remain `false`

---

## 1. Purpose

Wave 8 makes the integrated SunRey product **operationally manageable** without public market launch. It delivers:

1. Protected internal operations API
2. Governance operations interfaces (view/approve; no mint buttons)
3. Read-only operational dashboard data
4. Alert definitions on the existing monitoring stack
5. Health/readiness with `PROCESS_UP` vs `READY_TO_SERVE`
6. Complete non-market sandbox deployment topology
7. Domain/deployment configuration guidance
8. Infrastructure portability requirements
9. Sandbox feature gates
10. Deterministic test fixtures
11. Backup/restore alignment with Wave 2 recovery
12. Deployment validation and runbooks

---

## 2. Environment architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Labeled simulation sandbox                   │
├─────────────────────────────────────────────────────────────────┤
│  app.sunrey.xyz (optional)  →  Consumer BFF  →  canonical BFF   │
│  api.sunrey.xyz (optional)  →  Platform API  →  /api/v1         │
│  internal network only      →  /internal/v1/* (operator token)  │
├─────────────────────────────────────────────────────────────────┤
│  PostgreSQL  │  Prometheus/Grafana  │  Simulation chain adapter │
└─────────────────────────────────────────────────────────────────┘
```

**Not in scope:** production mainnet, live regulated custody, real securities execution, real banking movement, unauthorized issuance.

---

## 3. Service topology

| Component | Location | Port (sandbox) | Health |
|-----------|----------|----------------|--------|
| Platform API | `services/api` | 8080 | `/health`, `/ready` |
| Consumer BFF | `services/api/src/preview-main.ts` | 8443 | `/health` |
| PostgreSQL | `infra/postgres`, `infra/sandbox` | 5432 | `pg_isready` |
| Internal ops | `services/api/src/operations/` | 8080 `/internal/v1/ops/*` | operator auth |
| Control room | `packages/sunrey-chain/src/ops/control-room` | in-process | via ops API |
| Provider plane | `packages/sunrey-chain/src/provider-runtime` | in-process | `/internal/v1/providers/*` |
| Governance ops | `packages/sunrey-chain/src/governance-ops` | `/internal/v1/governance/*` | role-gated |
| Chain (simulation) | `packages/sunrey-chain/src/simulation.ts` | in-process | `/internal/v1/ops/chain` |
| Monitoring | `packages/sunrey-chain/ops/` | 9090 / 3001 | reference stack |

---

## 4. Internal operations plane

Implementation: `services/api/src/operations/`

| Module | Role |
|--------|------|
| `plane.ts` | `SandboxOperationsPlane` orchestrator |
| `collectors.ts` | Metrics from control room, providers, chain, productive ops |
| `health.ts` | `PROCESS_UP` / `READY_TO_SERVE` per service |
| `feature-gates.ts` | Sandbox allowed vs blocked capabilities |
| `sandbox-seed.ts` | Deterministic fixture catalog |
| `routes.ts` | Internal HTTP routes |
| `governance-routes.ts` | Proposal view/approve/reject |

Consumer authorization never grants access to `/internal/v1/*`.

---

## 5. Health dependencies

```
Platform API /ready
  └── configuration (required)
  └── persistence (required when SUNREY_FEATURE_REQUIRE_PERSISTENCE_FOR_READY=true)

Aggregate product health
  └── platform-api → configuration + readiness
  └── consumer-bff → platform-api, identity
  └── ledger → persistence
  └── economic-awareness → provider plane
  └── wallet → custody-simulation, chain
  └── exchange-sandbox → ledger, custody-simulation
  └── sunrey-chain → simulation validators
```

`PROCESS_UP` means the process responds. `READY_TO_SERVE` means required dependencies for that service role are satisfied.

---

## 6. Feature gates

Sandbox **may** exercise:

- SunRey issuance simulation (rehearsal only)
- MoonRey issuance simulation (proposal pipeline only)
- Exchange sandbox
- Agent proposals (ProposalGate)
- Wallet transfer simulation
- Economic claims simulation

Sandbox **must block**:

- Production mainnet
- Live regulated custody
- Real securities execution
- Real banking movement
- Unapproved token issuance

Inspect: `GET /internal/v1/ops/feature-gates`

---

## 7. Observability

| Asset | Path |
|-------|------|
| Prometheus config | `packages/sunrey-chain/ops/prometheus/prometheus.yml` |
| Alert rules | `packages/sunrey-chain/ops/prometheus/alerts.json` |
| Grafana dashboards | `packages/sunrey-chain/ops/grafana/dashboards/` |
| OTel collector | `packages/sunrey-chain/ops/otel-collector.yaml` |
| Control room | `packages/sunrey-chain/src/ops/control-room/` |

Wave 8 adds alerts for: validator down, consensus stalled, chain/state mismatch, high claim conflict, dead-letter growth, policy/authorization unavailability, KMS issues, database unavailable, exchange settlement mismatch, unexpected production feature enablement.

Dashboard sections exposed at `GET /internal/v1/ops/dashboard`:

- Chain (height, finality, validators, mempool)
- Supply (SunRey/MoonRey, reconciliation)
- Providers, observation ingestion, information consensus
- Human claims, productive claims, PEVE, GPUV
- Policy, authorization, exchange, API health, reconciliation, events

---

## 8. Sandbox deployment

| Artifact | Path |
|----------|------|
| Docker Compose | `infra/sandbox/docker-compose.yml` |
| Environment template | `infra/sandbox/env.example` |
| Reverse proxy template | `infra/sandbox/nginx.conf` |
| Terraform sandbox vars | `infra/sunrey-production/environments/sandbox.tfvars.json` |

Deploy:

```bash
cd infra/sandbox && docker compose up -d
```

Runbook: `docs/runbooks/SUNREY_SANDBOX_DEPLOYMENT.md`

---

## 9. Domain and TLS architecture

| Public domain | Backend | Exposed paths |
|---------------|---------|---------------|
| `app.sunrey.xyz` | Consumer BFF | BFF routes, static frontend |
| `api.sunrey.xyz` | Platform API | `/api/v1`, `/health`, `/ready` |

**Never expose publicly:** `/internal/v1/*`

TLS terminates at edge (Caddy, Nginx, Traefik, or Hetzner load balancer). Internal service mesh uses plain HTTP on private network.

Do not modify public DNS without authorized infrastructure automation.

---

## 10. Infrastructure requirements (portable)

Vendor-neutral minimums for integrated sandbox (not capacity guarantees):

| Resource | Minimum guidance |
|----------|------------------|
| CPU | 4 vCPU (API + BFF + DB + monitoring) |
| Memory | 8 GiB |
| Storage | 50 GiB SSD (PostgreSQL + logs); chain state additional if local node |
| Network | Private VPC; egress restricted except approved provider fixtures |
| Database | PostgreSQL 16; PITR recommended for staging |
| Container | Docker or Kubernetes; non-root runtime |
| Backup | Daily DB backup; config sans secrets; chain snapshot per Wave 2 |
| TLS | Edge termination; internal CA or LB-managed certs |
| Secrets | `SUNREY_INTERNAL_OPERATOR_TOKEN` via secret manager; never in git |
| Monitoring | Prometheus scrape + Grafana; optional Alertmanager |

Hetzner cloud and other providers map to these requirements via `infra/sunrey-production/modules/*`.

---

## 11. Backup and recovery

| Asset | Owner | Recovery |
|-------|-------|----------|
| PostgreSQL | `packages/persistence` | PITR, `docs/operations/database-recovery.md` |
| Chain state | `packages/sunrey-chain/src/sync` | Genesis replay or verified snapshot |
| Configuration | `infra/sandbox` | Version-controlled manifests; secrets excluded |
| Operational relations | Chunk 154 `packages/persistence/src/production/recovery` | Rehydration and integrity gate |

Secrets are excluded from ordinary backups. Use secret references only.

---

## 12. Test fixtures

Deterministic catalog: `services/api/src/operations/sandbox-seed.ts`

Includes sample human contributions, productive events, wallets, claims, exchange orders, vault permissions, and all sandbox personas from `services/api/src/consumer/sandbox-personas.ts`.

Consumer world: `createSandboxWorld()` in `services/api/src/consumer/fixtures.ts`.

---

## 13. Validation

| Test | Command / endpoint |
|------|-------------------|
| Wave 8 integration | `tests/wave-8-operations-sandbox.test.ts` |
| Prior architectural tests | `npm run ci` |
| Persistence recovery | `npm run test:persistence` |
| Control room demo | `npm run demo:sunrey-control-room` |
| End-to-end demo | `npm run demo` |

Connectivity matrix:

- Frontend → Consumer BFF (`/api/v1/*`)
- Platform API → services (orchestration)
- Services → PostgreSQL (when configured)
- Services → simulation chain adapter
- Wallet → chain (simulation)
- Exchange → settlement (sandbox)
- Vault → policy (consent engine)
- Agent → authorization (ProposalGate; no EA)
- Provider → Economic Awareness (provider plane)
- Claims → proof layer (Wave 3 economic proof)

---

## 14. Runbooks

| Document | Purpose |
|----------|---------|
| `docs/runbooks/SUNREY_SANDBOX_DEPLOYMENT.md` | Provision and validate sandbox |
| `docs/runbooks/SUNREY_FULL_STACK_OPERATIONS.md` | Day-2 internal operations |
| `docs/runbooks/SUNREY_SERVICE_DEGRADATION.md` | Incident response |

---

## 15. Remaining deployment gaps

| Gap | Notes |
|-----|-------|
| Durable PostgreSQL seed migrations | Fixtures are runtime/test catalog; PG seed scripts deferred |
| Runnable Alertmanager bundle | Alert rules defined; Alertmanager not packaged in compose |
| Single-command chain node in compose | Chain uses simulation adapter; optional `sunrey-node` is separate |
| Production DNS automation | Templates only; DNS changes require authorized infra |
| Unified multi-service readiness aggregator HTTP | Per-service health via ops API; no separate aggregator service |
| Wave 8 product PostgreSQL-default paths | Listed in upgrade plan; not all BFF paths durable yet |

---

## 16. Boundaries

The operations plane:

- Does not post ledger journals
- Does not mint SunRey or MoonRey
- Does not issue Execution Authority
- Does not enable `LIVE_*` flags
- Does not bypass Kernel refusal

Companion: `docs/architecture/SUNREY_SOVEREIGN_ARCHITECTURE_UPGRADE_PLAN.md` (Wave 8 — Product Integration).
