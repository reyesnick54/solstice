# Phase I Prompt 3 — Observability, SRE, incident response, backups, DR

Productizes SunRey's operational reliability framework by extending the
canonical ops / control-room owner.

Canonical owner: `packages/sunrey-chain/src/ops`  
New layer: `packages/sunrey-chain/src/ops/sre`  
Existing foundations: Chunk 55 (`sunrey-ops-resilience`), Chunk 156 (`sunrey-unified-control-room`)

Do not create `packages/observability`, `packages/control-room`,
`packages/sre`, `packages/disaster-recovery`, `packages/kill-switch`,
or `packages/incident-v2`.

`ENVIRONMENT` remains `simulation`. Every `LIVE_*` flag remains `false`.
`PRODUCTION_ACTIVE=false`.

Phase I Prompts 1 and 2 are not present as documents on this tree. This
prompt extends already-implemented Phases A–H plus Chunks 55/156 rather
than reimplementing Money, Kernel, Execution Authority, Evidence, or the
ledger.

## 1. Observability status

Inventory covers API, authentication, Ledger, accounts, payments, FX,
cards, treasury, reconciliation, providers, Grow, Agent, Exchange, Chain,
wallets, custody, Vault, HIN, database, and queues/jobs.

Covered on the existing control-room / ops plane: Ledger, payments, FX
stale quotes, providers, reconciliation, Exchange, Chain, custody,
database, queues.

Partial / blind spots (honest):

- No production Prometheus scrape
- Cards have no local kill switch (treasury/provider scopes apply)
- Grow must never emit yield/APY metrics
- Agent ALLOW is not execution
- Exchange settlement is not ledger-backed on current ports
- Vault/HIN payloads are forbidden in telemetry
- Managed-cloud PITR is not claimed

## 2. Metrics, logs, traces

Productization metrics add request/latency/error/throughput, queue depth,
job age, database/provider/Agent/Exchange/chain/wallet/Vault gauges.
Labels are aggregate only (`domain`, `providerClass`, `jurisdictionClass`,
`asset`, `environment`, `status`, `component`, `plane`).

Logs require timestamp, service, environment, requestId, correlationId,
traceId, severity, event code, with redaction. Logs are not canonical
financial evidence.

Traces cover:

- API → Kernel → Execution Authority → domain → provider → Ledger → events → evidence
- Agent → model → tool → proposal → human consider
- Exchange → match → settlement → custody/chain

## 3. SLIs / SLOs

Twelve measurable SLIs. Proposed SLOs are labeled `ENGINEERING_TARGET`.
`contractualSla=false`. `humanApproved=false`. Existing Chunk 55/156
catalogs remain `ENGINEERING_TEST_TARGETS`.

## 4. Alerts and severity

Fifteen productization alerts (API outage through Vault access anomaly)
map to SEV1–SEV4. They recommend runbooks and never auto-execute. A
subset maps into the existing in-process `AlertEngine`. No real pager
provider is connected.

## 5. Control room

Read model at `buildControlRoomReadModel` / `SreReliabilityPlatform.readModel()`
shows overall, payments, providers, treasury, reconciliation, Agent,
Exchange, Chain, custody, database, queues, security, active incidents,
and kill-switch references. No secrets.

## 6. Incident management

Persistent incident resource with required fields and states
`DETECTED` … `CLOSED`. Financial-integrity incidents need a mitigation
before resolve. Evidence is sealed in the existing ops vault.

## 7. Kill switches

Catalog references existing domain-scoped switches for provider,
payments, FX, cards (via treasury/provider), Agent, Exchange market,
withdrawals, and data marketplace. `globalDestructiveOff=false`.
Control room cannot engage them.

## 8. Runbooks

Fourteen required runbooks under `docs/runbooks/sre/`. Index:
`docs/productization/SUNREY_PRODUCTION_RUNBOOK_INDEX.md`.

## 9. Backup, restore, PITR, DR

Schedules, encryption, retention, and integrity verification are
defined. Object-storage and configuration backup policies exclude raw
secrets. PITR is `LOCAL_WAL_ARCHIVE` with engineering RPO 120s / RTO
600s.

Restore has been executed in-process (`runRestoreTest`): backup →
isolated blank target → restore → integrity → smoke → ledger
invariants. `claimBackupWorks` is true only after that pass.

DR plan: `docs/productization/SUNREY_DISASTER_RECOVERY_PLAN.md`.
Multi-region failover is **not** implemented and is not claimed.

## 10. Chaos and continuity

Controlled API/worker/database/queue/provider/model/Exchange/validator/RPC
faults keep financial integrity and production disabled.

Degraded modes: Agent down → Money UI usable; Exchange down → banking
remains; FX down → same-currency remains; custody down → withdrawals
paused, balances readable.

## 11. On-call

Roles required. No named staff invented. Staffing gaps are explicit.

## 12. Production remains disabled

`SRE_CAPABILITIES.productionActive=false`
`SRE_CAPABILITIES.canPostLedger=false`
`SRE_CAPABILITIES.canEnableLiveFlags=false`

## Demo

```
npm run demo:sunrey-sre-dr
```
