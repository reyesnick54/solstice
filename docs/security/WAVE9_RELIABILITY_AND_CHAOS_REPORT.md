# Wave 9 — Reliability and Chaos Report

**Classification:** Engineering qualification — not production SLA or capacity claims.

**Environment:** `ENVIRONMENT=simulation`, all `LIVE_*` flags `false`.

**Date:** 2026-09-02

## Executive summary

Wave 9 qualification exercises scalability, resilience, failure isolation,
recovery, and data integrity across the integrated SunRey platform using safe
synthetic sandbox and in-process simulation environments. No real network calls,
no production activation, and no fabricated RPO/RTO guarantees.

## 1. Performance baseline

Baselines delegate to the Wave 6 qualification harness (`npm run qualify:performance`)
and Wave 9 orchestration (`npm run qualify:wave9 -- --suite baselines`).

| Surface | Harness | Notes |
| --- | --- | --- |
| API request throughput / latency | `performance/api/baseline.ts` | Consumer BFF flows at concurrency 10/50/100 |
| Transaction submission | `performance/database/baseline.ts` | Ledger posting and journal lookup |
| Block production / finality | `performance/blockchain/run.ts` | Canonical `sunrey-bench` |
| Wallet queries | API home/accounts/grow flows | Sandbox personas |
| Exchange order processing | `performance/exchange/baseline.ts` | Order ingress latency |
| Economic observation ingestion | `performance/providers/fanout-baseline.ts` | Provider fan-out |
| Human contribution verification | `performance/human-economy/baseline.ts` | Registry submit/verify |
| Oracle mesh / PEVE / GPUV | Provider plane + policy demos | Simulation-only |
| Graph / federated queries | API multiService category | PEG facade via BFF |
| Action Center / Vault | Phase H qualification paths | Kernel-gated |

All values are `ENGINEERING_MEASUREMENT`. Do not extrapolate to production capacity.

## 2. Load-test findings

Nine bounded load profiles exercise representative mixes:

| Profile | Focus |
| --- | --- |
| NORMAL | Health, bootstrap, home, accounts |
| HIGH | Elevated concurrent BFF reads |
| BURST | Rate-limit and backpressure (100 concurrent) |
| SUSTAINED | 5s moderate load window |
| READ_HEAVY | Bootstrap, home, accounts, markets, grow |
| TRANSACTION_HEAVY | Grow and accounts paths |
| PROVIDER_INGESTION_HEAVY | External data plane fan-out |
| EXCHANGE_HEAVY | Exchange market reads |
| CLAIM_VERIFICATION_HEAVY | Human contribution registry |

## 3. Event-backlog behavior

Verified via `performance/wave9/scenarios/event-backlog.ts`:

- Idempotent inbox processing — duplicate delivery does not double-apply effects
- Consumer recovery — second pass produces zero additional effects
- Dead-letter routing — transport failure after retry exhaustion
- No duplicate issuance — operation store idempotency at financial boundary
- Lag monitoring — outbox pending count exposes consumer backlog

## 4. Database-failure findings

Per-domain simulation (customer, ledger, evidence, security):

| Domain | Expected degradation |
| --- | --- |
| Ledger | Writes fail closed; no blockchain supply mutation |
| Evidence | Proof-dependent issuance blocked where required |
| Security | Sensitive writes fail closed |
| Customer | Mutations blocked; reads may degrade |

Full PostgreSQL stop/start: `npm run qualify:backend-db` (requires `db:up`).

Authority boundaries enforced: Postgres cannot mint, issue Execution Authority,
or replace ledger postings.

## 5. Blockchain-failure findings

`runChaosRecoverySuite()` verifies:

- Restart preserves finalized state
- Snapshot restore with tampered/wrong-network rejection
- Peer sync produces identical state root
- Supply and nonce unchanged after outage recovery
- Duplicate transactions rejected

Consumer APIs must not invent chain state on query node failure.

## 6. Provider-failure findings

- 25-provider outage degrades plane without crash
- Category outages isolated per economic domain
- Compliance outage → DEGRADED, not silent ALLOW
- Preview `providerDown` flag produces partial degradation
- Unrelated blockchain transfers continue

## 7. Policy / auth failure behavior

- Policy engine outage: sanctions/compliance unavailable → degraded
- Authorization engine outage: sensitive writes fail closed
- Identity provider outage: 401 on protected paths, no anonymous elevation
- Kernel refusals sealed in Evidence Vault unchanged

## 8. Exchange recovery

`ExchangeSettlementRecovery` verifies:

- Matching engine restart mid-DVP resumes from durable phase
- Duplicate settlement callback is noop
- No native supply inconsistency (AssetSupplyBook not mutated by exchange DB)

## 9. Full-stack restart

- API preview restart recovers health endpoint
- Chain height/state preserved via `safeRestart` invariants
- Rehydration order: schema → security → providers → payments/custody/exchange → outbox/inbox → reconciliation
- Exchange settlements idempotent after restart
- Identity links, consent, and policy versions persist via durable stores

## 10. Backup / restore

- Chain snapshot create/verify via canonical ops package
- Documented runbooks: blockchain recovery, database PITR, production backup
- Restore artifacts scanned for forbidden secrets (no private keys in ordinary dumps)
- Evidence Vault hash chain verified on restore
- Real PITR drill: `sunrey-ops database restore-test`

## 11. Bottlenecks (prioritized by production impact)

| Priority | Component | Category |
| --- | --- | --- |
| HIGH | Consumer BFF multi-service fanout | API |
| HIGH | Kernel-gated ledger posting | Database |
| HIGH | BFT block finality | Consensus |
| MEDIUM | Outbox/inbox dispatch | Event bus |
| MEDIUM | 126-provider external data plane | Network |
| MEDIUM | PEG federated queries | Graph |
| MEDIUM | Exchange DVP settlement | Exchange |

## 12. Production infrastructure requirements

Documented in `performance/wave9/scenarios/regional-failure.ts`. Requirements
for redundancy, replication, failover, and backup location are specified.
RPO/RTO are `ENGINEERING_TEST_TARGETS` only — measured per drill, not fabricated.

## 13. Chaos automation

Reusable scripts under `scripts/chaos/` (simulation only):

| Script | Scenario |
| --- | --- |
| `restart-sandbox.mjs` | API preview restart |
| `network-delay.mjs` | Provider timeout / queue interruption |
| `service-unavailable.mjs` | Provider-down degradation |
| `provider-failure.mjs` | 25-provider + compliance outage |
| `database-restart.mjs` | PostgreSQL qualification pointer |
| `blockchain-recovery.mjs` | Chain chaos recovery suite |

## 14. Validation

```bash
npm run test:wave9-regression
npm run qualify:wave9:fast
npm run sunrey-range -- campaign --production-safety-smoke
```

## Invariants held

- `ENVIRONMENT=simulation`
- All `LIVE_*` flags `false`
- No invented journals
- No blockchain supply mutation on DB failure
- No authorization bypass under load
- No duplicate financial side effects under retry

## Related documentation

- `docs/runbooks/SUNREY_DISASTER_RECOVERY_MASTER_RUNBOOK.md`
- `docs/security/chunk-157-production-adversarial-resilience.md`
- `docs/operations/disaster-recovery.md`
- `performance/wave9/README.md`
