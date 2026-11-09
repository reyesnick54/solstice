# HELIOS shadow lab durable runtime — operations runbook

**Work package:** OPS01  
**Qualification marker:** `HELIOS_DURABLE_SHADOW_LAB_RUNTIME_V1_QUALIFIED`  
**Authority:** `packages/platform/src/helios/autonomous-shadow-lab/ops01`

## Posture

- Simulation only. `ENVIRONMENT=simulation`, all `LIVE_*` flags remain `false`.
- Shadow and paper execution only. No customer ledger journals, no Execution Authority, no live trading.

## Components

| Layer | Location |
| --- | --- |
| Runtime service | `packages/platform/src/helios/autonomous-shadow-lab/ops01/service.ts` |
| Durable store (PostgreSQL) | `packages/persistence/src/growth/pg-helios-shadow-lab-runtime-store.ts` |
| Migration | `db/customer/migrations/V072__helios_autonomous_shadow_lab_runtime.sql` |
| Deployment descriptor | `deploy/helios-shadow-lab-runtime.json` |

## Health endpoints

| Path | Meaning |
| --- | --- |
| `GET /health` | Liveness: simulation posture + persistence probe |
| `GET /ready` | Readiness: persistence available and not shutting down |
| `GET /metrics` | Counters: decisions sealed, fills, outcomes, lease collisions, persistence failures |

Bind via `serveShadowLabHttpRuntime` (default `127.0.0.1`).

## Graceful shutdown

1. Stop accepting new campaign work (`requestGracefulShutdown()`).
2. Allow in-flight lease holders to complete open transactions.
3. Release leases or wait for lease expiry (30s default).
4. Drain outbox (`growth.helios_shadow_lab_outbox` state `PENDING` → `DELIVERED`).
5. Exit process.

Readiness returns `503` while shutting down.

## Lease / fencing

- One active lease per `campaign_id` in `growth.helios_shadow_lab_campaign_lease`.
- Monotonic `fencing_token`; commits require matching token.
- Expired workers cannot commit after losing the lease.

## Failure modes

| Condition | Behavior |
| --- | --- |
| PostgreSQL unavailable | Fail closed — no new sealed decisions |
| Duplicate `decision_id` or `evidence_hash` | Reject commit (idempotent restart) |
| Lease held by peer | Second worker backs off (`HELD_BY_OTHER`) |
| History rewrite attempt | Blocked by append-only grants on sealed decisions |

## Restart verification

Automated harness: `runAllRestartCrashPoints` in `ops01/restart-harness.ts`.  
Acceptance: `tests/helios-ops01-durable-shadow-lab-runtime.test.ts` and `tests/persistence/helios-shadow-lab-runtime.test.ts`.

## Database operations

```bash
npm run db:up
npm run db:migrate
SUNREY_PERSISTENCE_TEST=1 npm run test:persistence -- tests/persistence/helios-shadow-lab-runtime.test.ts
```
