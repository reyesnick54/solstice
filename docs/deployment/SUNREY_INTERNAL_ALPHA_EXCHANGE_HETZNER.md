# SunRey Internal Alpha Exchange — Hetzner Deployment Readiness

**Environment:** `simulation` only — not live regulated production  
**Scope:** Internal Alpha Exchange acceptance, smoke verification, and operator handoff  
**Canonical stack:** `deploy/sunrey-sandbox-hetzner/` (Consumer BFF + PostgreSQL + reverse proxy)

This document describes exact Hetzner requirements for qualifying the Internal Alpha Exchange. It does not authorize production real-money functionality, public trading, or mainnet activation.

---

## 1. Prerequisites

| Requirement | Minimum |
|-------------|---------|
| OS | Ubuntu 22.04 or 24.04 LTS |
| CPU | 4 vCPU |
| Memory | 8 GiB RAM |
| Disk | 50 GiB SSD |
| Software | Docker Engine 24+, Docker Compose v2, Git |
| Network | Outbound HTTPS for image pulls; inbound 443 for API |

Use the dedicated `sunrey` system user. Do not expose PostgreSQL (`5432`) publicly.

---

## 2. Checkout and environment

```bash
sudo mkdir -p /opt/sunrey
sudo chown "$USER":"$USER" /opt/sunrey
cd /opt/sunrey
git clone <repository-url> .
git fetch origin main
git checkout <release-tag-or-commit>
cd deploy/sunrey-sandbox-hetzner
cp ../../infra/sandbox/env.production-sandbox.example .env
chmod 600 .env
```

Replace every `REPLACE_*` placeholder in `.env`. **Never commit secrets.**

### Required simulation posture (do not change)

```bash
ENVIRONMENT=simulation
PRODUCTION_ACTIVE=false
PRODUCTION_READY=false
LIVE_CONNECTIVITY_ENABLED=false
SUNREY_PRODUCT_INTEGRATION_MODE=DURABLE
SUNREY_FEATURE_REQUIRE_PERSISTENCE_FOR_READY=true
```

### Required Alpha Exchange variables

| Variable | Purpose |
|----------|---------|
| `SUNREY_PUBLIC_APP_ORIGIN` | Frontend origin for CORS (e.g. `https://app.sunrey.xyz`) |
| `SUNREY_PUBLIC_API_ORIGIN` | Public API origin |
| `SUNREY_API_ALLOWED_ORIGINS` | Comma-separated allowed browser origins |
| `SUNREY_PREVIEW_SANDBOX_PERSONAS` | `true` — enables sandbox personas including `exchange` |
| `SUNREY_PREVIEW_AUTH_ENABLED` | `true` — preview login for internal Alpha users |
| `SUNREY_PREVIEW_AUTH_EMAIL` | Internal Alpha login email |
| `SUNREY_PREVIEW_AUTH_PASSWORD` | Internal Alpha login password (minimum 12 characters) |
| `SUNREY_PG_*` | PostgreSQL bootstrap, migrator, and bounded-domain credentials |

### Optional provider API keys (reference data only)

External crypto reference providers (CoinGecko, CoinPaprika, CoinLore) use **fixture-backed adapters in simulation**. No live provider API keys are required for Alpha acceptance. If you later enable live reference preview, store keys only in your secret manager — never in git.

| Provider | Env (if enabled later) | Notes |
|----------|------------------------|-------|
| CoinGecko | `SUNREY_SECRET_COINGECKO_API_KEY` | Reference quotes only; does not mutate order books |
| CoinPaprika | `SUNREY_SECRET_COINPAPRIKA_API_KEY` | Reference quotes only |
| CoinLore | none required | Public fixture path in simulation |

---

## 3. Database migrations

Bootstrap roles and bounded databases:

```bash
cd /opt/sunrey/deploy/sunrey-sandbox-hetzner
docker compose --profile migrate run --rm db-bootstrap
```

Apply schema migrations:

```bash
docker compose --profile migrate run --rm db-migrate
```

Migrations live in `db/` and are executed by `scripts/postgres-migrate.mjs`.

Re-run migrations after every upgrade before restarting the BFF.

---

## 4. Service startup order

1. **postgres** — wait for healthcheck
2. **db-bootstrap** (profile `migrate`) — first boot only
3. **db-migrate** (profile `migrate`) — every upgrade
4. **consumer-bff** — `services/api/src/preview-main.ts`
5. **reverse-proxy** — Nginx on `127.0.0.1:8443`

Start the stack:

```bash
cd /opt/sunrey/deploy/sunrey-sandbox-hetzner
docker compose up -d --build
docker compose ps
```

SunRey Alpha chain simulation runs **in-process** inside the Consumer BFF. No separate chain node is required for Internal Alpha.

---

## 5. Health endpoints

| Endpoint | Expected |
|----------|----------|
| `GET /health` | `200`, `ok: true`, `environment: simulation`, `productionActive: false` |
| `GET /ready` | `200`, `ready: true`, persistence check `ok: true` when DURABLE |
| `GET /api/v1/version` | `environment: simulation` |

Example:

```bash
curl -fsS https://api.sunrey.xyz/health
curl -fsS https://api.sunrey.xyz/ready
```

---

## 6. Alpha Exchange smoke test

From the repository root on the server (or any machine that can reach the API):

```bash
export SUNREY_VERIFY_API_BASE=https://api.sunrey.xyz
export SUNREY_VERIFY_APP_ORIGIN=https://app.sunrey.xyz
export SUNREY_VERIFY_PREVIEW_EMAIL="<internal alpha email>"
export SUNREY_VERIFY_PREVIEW_PASSWORD="<internal alpha password>"
export SUNREY_VERIFY_PERSONA_ID=exchange
npm run smoke:exchange-alpha -- --remote
```

The command prints a report including:

- API, PostgreSQL, and SunRey Alpha network health
- SRC/USD, MRC/USD, and SRC/MRC market readiness
- Alpha order-book liquidity
- External reference providers (CoinGecko, CoinPaprika, CoinLore)
- Buy SRC / buy MRC trade and chain settlement paths
- `REAL MONEY: DISABLED` and `PUBLIC TRADING: DISABLED`

Exit code `0` means **ALPHA EXCHANGE: READY**.

### Local qualification (CI / developer)

```bash
npm run smoke:exchange-alpha
```

This runs the in-process acceptance harness without contacting a deployed URL.

---

## 7. Manual product acceptance checklist

An internal team member should be able to:

1. Log in with the preview Alpha user (`personaId: exchange`)
2. Open Exchange and see markets
3. See live/reference prices on crypto reference screens
4. Buy SRC with sandbox quote liquidity (proposal → approve → submit)
5. Receive SRC in wallet / holdings read models
6. Buy or acquire MRC through a second trade path
7. Inspect orders, fills, settlements, and wallet transactions
8. Log out, restart the platform, log in again
9. See the same balances and history (DURABLE mode)

After restart, re-run:

```bash
npm run smoke:exchange-alpha -- --remote
```

---

## 8. Rollback

1. Check out the previous known-good Git tag.
2. Rebuild and restart:

```bash
cd /opt/sunrey/deploy/sunrey-sandbox-hetzner
docker compose up -d --build
```

3. If migrations are not backward-compatible, restore PostgreSQL from backup instead of downgrading schema in place.
4. Re-run `npm run smoke:exchange-alpha -- --remote`.

---

## 9. Related commands

| Command | Purpose |
|---------|---------|
| `./scripts/verify-sandbox-deployment.sh` | General sandbox deployment smoke |
| `npm run smoke:exchange-alpha` | Internal Alpha Exchange acceptance |
| `npm run qualify:backend-db` | PostgreSQL migration qualification |
| `npm run test:persistence` | Persistence integration tests (requires PostgreSQL) |
| `npm run ci` | Full repository CI pipeline |

---

## 10. Security notes

- Do not set `ENVIRONMENT` to anything other than `simulation`.
- Do not enable any `LIVE_*` flag or `PRODUCTION_ACTIVE`.
- Do not store provider or database secrets in the repository.
- Preview credentials must be rotated if leaked.
