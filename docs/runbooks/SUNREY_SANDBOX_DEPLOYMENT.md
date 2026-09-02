# SunRey Sandbox Deployment Runbook

**Wave 8 — Operations and sandbox deployment**  
**Environment:** `simulation` only  
**Status:** Non-market integrated sandbox

---

## Purpose

Deploy a complete integrated SunRey environment for:

- Founder and team testing
- QA and architecture validation
- Provider integration testing (fixture/simulation transports)
- Mobile and web testing against the Consumer BFF
- Investor and product demos when clearly labeled **SIMULATION / NOT PRODUCTION**

This runbook does **not** authorize public market launch, live regulated money rails, unauthorized mainnet economics, or production SunRey/MoonRey issuance.

---

## Prerequisites

- Docker and Docker Compose
- Node.js 22+ (for local validation outside compose)
- Repository checkout at `/workspace` or equivalent

---

## Quick start (local sandbox stack)

```bash
cd infra/sandbox
cp env.example .env
# Edit SUNREY_INTERNAL_OPERATOR_TOKEN before any shared deployment

docker compose up -d postgres
docker compose run --rm platform-api npm run db:migrate   # from repo root via volume mount
docker compose up -d
```

Verify:

```bash
curl -s http://localhost:8080/health | jq .
curl -s http://localhost:8080/ready | jq .
curl -s http://localhost:8443/health | jq .
```

Internal operations (operator token required):

```bash
curl -s http://localhost:8080/internal/v1/ops/health \
  -H 'x-sunrey-internal-token: <token>' \
  -H 'x-sunrey-operator-role: GOVERNANCE_OPERATOR' | jq .
```

---

## Service topology

| Service | Port | Role |
|---------|------|------|
| PostgreSQL | 5432 | Durable persistence (optional for preview; required for staging sandbox) |
| Platform API | 8080 | `/api/v1`, `/health`, `/ready`, `/internal/v1/*` |
| Consumer BFF | 8443 | Lovable/mobile/web preview surface |
| Prometheus | 9090 | Metrics scrape (engineering reference) |
| Grafana | 3001 | Dashboards (engineering reference) |

SunRey blockchain dev/test network runs in-process via simulation adapters and optional local `sunrey-node` for chain-specific drills. See `docs/runbooks/local-sunrey-devnet.md`.

---

## Seed data

Deterministic sandbox fixtures are cataloged at:

```
GET /internal/v1/ops/sandbox/seed
```

Categories include sandbox personas, human contributions, productive events, wallets, claims, exchange orders, and vault permissions. No real sensitive user data is used.

Consumer BFF sandbox personas: set `SUNREY_PREVIEW_SANDBOX_PERSONAS=true` and use tokens `sandbox.<persona>`.

---

## Feature gates

Sandbox may exercise simulation flows for SunRey/MoonRey issuance rehearsal, Exchange sandbox, agents, wallet transfer, and economic claims.

Blocked regardless of sandbox tier:

- Production mainnet
- Live regulated custody
- Real securities execution
- Real banking movement
- Unapproved token issuance

Inspect gates:

```
GET /internal/v1/ops/feature-gates
```

---

## Domain configuration

Expected public domains (configure DNS and TLS only when infrastructure automation is authorized):

| Domain | Backend |
|--------|---------|
| `app.sunrey.xyz` | Consumer BFF |
| `api.sunrey.xyz` | Platform API (`/api/v1` only) |

`/internal/v1/*` must remain on an internal network or VPN. See `infra/sandbox/nginx.conf`.

---

## Backup and restore

### Database

Use Wave 2 / Chunk 154 recovery architecture:

```bash
npm run db:up
npm run db:migrate
# Backup via pg_dump or infrastructure backup module
```

See `docs/operations/database-recovery.md` and `docs/operations/backups.md`.

### Blockchain state

Chain truth is replayable from genesis or verified snapshots. Database is not chain truth.

See `docs/architecture/WAVE2_STATE_SYNC_AND_RECOVERY.md`.

### Configuration

Back up `infra/sandbox/.env` and deployment manifests. **Exclude secrets** from ordinary backups; store secret references only.

---

## Deployment validation checklist

- [ ] `GET /health` returns `ok: true` on Platform API and Consumer BFF
- [ ] `GET /ready` returns `ready: true` when persistence is configured
- [ ] Consumer BFF `GET /api/v1/world/snapshot` returns reference-only data
- [ ] Internal ops dashboard returns metrics at `/internal/v1/ops/dashboard`
- [ ] Feature gates show `productionActive: false` and blocked live flags
- [ ] Governance proposal view works; no mint button exists
- [ ] Restart containers and re-run readiness checks

---

## Teardown

```bash
cd infra/sandbox
docker compose down
# Add -v only when intentionally destroying sandbox database volume
```

---

## Escalation

- Service degradation: `docs/runbooks/SUNREY_SERVICE_DEGRADATION.md`
- Full-stack operations: `docs/runbooks/SUNREY_FULL_STACK_OPERATIONS.md`
- Architecture: `docs/architecture/WAVE8_OPERATIONS_AND_SANDBOX_DEPLOYMENT.md`
