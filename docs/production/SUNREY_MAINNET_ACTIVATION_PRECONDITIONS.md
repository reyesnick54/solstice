# SunRey Mainnet Activation Preconditions

**Wave 9 — Formal activation gate checklist**  
**Date:** 2026-09-02 (UTC)  
**Commit:** `1a6eafa55ece2446c65ca2a5320370df896e7240`

---

## Mandatory posture

Mainnet activation is **not authorized** by this document or by any engineering wave completion.

```
ENVIRONMENT=simulation
PRODUCTION_READY=false
PRODUCTION_ACTIVE=false
MAINNET_ACTIVE=false
MAINNET_INACTIVE=true
All LIVE_*=false
PRODUCTION_HSM_KMS_CONFIGURED=false
LIVE_PROVIDER_CONNECTED=false
PRODUCTION_SUNREY_ISSUANCE_FORMULA_APPROVED=false
PRODUCTION_MOONREY_ISSUANCE_DISABLED=true
moonreyIssuanceActivated()=false
LAUNCH_FREEZE_PRODUCTION_ACTIVATED=false
FREEZE_EQUALS_ACTIVATION=false
```

No single flag may bypass prerequisite validation. Activation requires **all** mandatory gates below unless explicitly marked advisory.

Evaluators:

- `packages/sunrey-chain/src/runtime/mainnet-gate.ts` — runtime fail-closed
- `docs/productization/sunrey-mainnet-readiness-gate.json` — readiness gate
- `packages/sunrey-chain/src/production-handoff/production-gates/` — gate catalog
- `packages/sunrey-chain/src/economics/production-activation/firewall.ts` — economic firewall (evaluator only)

---

## Task 12 — Mainnet activation preconditions

### Tier A — Mandatory (all must be SATISFIED)

| # | Gate | Kind | Current status | Evidence |
| --- | --- | --- | --- | --- |
| A1 | Approved production genesis | EXTERNAL_HUMAN | **MISSING** | `mainnetGenesisFailsClosed()`; ceremony rehearsal ≠ approval |
| A2 | Approved validator set | EXTERNAL_HUMAN | **MISSING** | Dev harness only; no operator acceptance |
| A3 | Production key custody (HSM/KMS) | EXTERNAL_PROVIDER | **MISSING** | `PRODUCTION_HSM_KMS_CONFIGURED=false` |
| A4 | External security audit complete | EXTERNAL_AUDIT | **MISSING** | `EXTERNAL_AUDIT_COMPLETE=false` |
| A5 | Critical security findings resolved | EXTERNAL_AUDIT | **MISSING** | No audit report |
| A6 | Economic / mechanism audit complete | EXTERNAL_AUDIT | **MISSING** | No economic audit letter |
| A7 | Governance configured for mainnet | EXTERNAL_HUMAN | **MISSING** | `LAUNCH_AUTHORIZATION_CANDIDATE ≠ MAINNET_ACTIVE` |
| A8 | Monetary policies approved (SunRey + MoonRey) | EXTERNAL_HUMAN | **MISSING** | Fixture packages; `productionApproved: false` |
| A9 | Provider readiness (custody, Travel Rule, rails as required) | EXTERNAL_PROVIDER | **MISSING** | All provider gates MISSING |
| A10 | Regulatory / legal feature gates | EXTERNAL_HUMAN | **MISSING** | No `CONFIRMED_BY_COUNSEL`; corridors `RESEARCH_REQUIRED` |
| A11 | Production monitoring operational | EXTERNAL_HUMAN | **MISSING** | Alerts defined; on-call external |
| A12 | Backup / restore rehearsed | EXTERNAL_HUMAN | **MISSING** | DR docs exist; production sign-off absent |
| A13 | Incident-response rehearsal complete | EXTERNAL_HUMAN | **MISSING** | Chunk 167 rehearsal ≠ staffed IR |
| A14 | Production migration approved | EXTERNAL_HUMAN | **MISSING** | `production_migration_not_performed` blocker |
| A15 | Simulation data isolation confirmed | INTERNAL_SOFTWARE | **RECORDED_INTERNAL** | Architecture guards; must re-verify at cutover |
| A16 | Penetration test complete | EXTERNAL_AUDIT | **MISSING** | `EXTERNAL_PENTEST_EXECUTED=false` |
| A17 | Protocol / cryptography review | EXTERNAL_AUDIT | **MISSING** | Specialist review not recorded |
| A18 | Final economic parameters authorized | EXTERNAL_HUMAN | **MISSING** | Chunk 163 `AUTHORIZED_CANDIDATE ≠ PRODUCTION_ACTIVE` |
| A19 | Launch freeze hash bound to ceremony | INTERNAL_SOFTWARE | **RECORDED_INTERNAL** | Chunk 164 freeze; freeze ≠ activation |
| A20 | Staged activation plan approved | EXTERNAL_HUMAN | **MISSING** | Chunk 166 rehearsal only |

**Tier A result:** `passed: false` — 17 of 20 gates MISSING or EXTERNAL_REQUIRED; 3 RECORDED_INTERNAL only.

### Tier B — Domain-scoped (required per activated capability)

| Domain | Additional gates | Status |
| --- | --- | --- |
| SunRey issuance | `PRODUCTION_SUNREY_ISSUANCE_FORMULA_APPROVED`, human formula approval, PEVE production policy | **BLOCKED** |
| MoonRey issuance | `moonreyIssuanceActivated()`, productive provider quorum, GPUV production policy | **BLOCKED** |
| Fiat ledger | PostgreSQL production, Kernel simulation assertion removal (governed) | **EXTERNAL_REQUIRED** |
| Exchange live | `LIVE_EXCHANGE_ENABLED`, settlement provider, market surveillance | **BLOCKED** |
| Custody live | `LIVE_CUSTODY_ENABLED`, Travel Rule network | **BLOCKED** |
| Banking/payments | `LIVE_BANKING_RAILS`, `LIVE_PAYMENTS_ENABLED` | **BLOCKED** |
| KYC/AML live | `LIVE_EXTERNAL_KYC`, AML vendor | **BLOCKED** |
| Agent execution | `LIVE_AGENT_FINANCIAL_EXECUTION_ENABLED` | **BLOCKED** |
| HIN marketplace | `LIVE_INFORMATION_RIGHTS_MARKETPLACE` | **BLOCKED** |
| Interop | All `LIVE_INTEROP_*` | **BLOCKED** |

### Tier C — Advisory (recommended before limited live)

| Gate | Notes |
| --- | --- |
| Hosted preproduction soak | External; not in repo |
| Performance SLA baselines | Engineering measurements only |
| Provider catalog completeness | 73/126 cataloged; accepted gaps documented |
| Formal verification (TLA+) | Partial model registry; not production gate |

---

## Task 13 — Activation flags audit

### Primary activation flags

| Flag | Location | Value | Bypass risk |
| --- | --- | --- | --- |
| `ENVIRONMENT` | `packages/config/src/flags.ts` | `simulation` | `assertSimulationOnly()` throws if changed |
| `PRODUCTION_READY` | engineering-closure, qualification.json | `false` | CI + architecture-freeze guards |
| `PRODUCTION_ACTIVE` | engineering-closure, services/api, exchange, information-market | `false` | Compiled const; linter checks |
| `MAINNET_ACTIVE` / `MAINNET_INACTIVE` | runtime/identity.ts | inactive | `refuseMainnetRuntimeAction()` fail-closed |
| `LIVE_CONNECTIVITY_ENABLED` | engineering-closure | `false` | Posture linter |
| `PRODUCTION_HSM_KMS_CONFIGURED` | config/flags.ts | `false` | mainnet-gate throws if true in repo |

### LIVE_* capability flags (all `false`)

| Flag | Purpose |
| --- | --- |
| `LIVE_MONEY_ENABLED` | Real money movement |
| `LIVE_PAYMENTS_ENABLED` | Payment execution |
| `LIVE_BANKING_RAILS` | Bank connectivity |
| `LIVE_EXTERNAL_KYC` | Live KYC vendor |
| `LIVE_EXTERNAL_BANK_CONNECTION` | Bank API |
| `REAL_MONEY_ENABLED` | Phase 1 posture |
| `LIVE_TRADING_ENABLED` | Trading execution |
| `LIVE_CRYPTO_ENABLED` | Crypto operations |
| `LIVE_EXCHANGE_ENABLED` | Exchange live |
| `LIVE_DATA_MARKET_ENABLED` | Data market |
| `LIVE_INVESTMENT_EXECUTION` | Brokerage execution |
| `LIVE_INFORMATION_RIGHTS_MARKETPLACE` | HIN marketplace |
| `LIVE_DATA_MONETIZATION_ENABLED` | Data monetization |
| `LIVE_HIN_BASED_ISSUANCE_ENABLED` | HIN-based SunRey issuance |
| `LIVE_MOONREY_PRODUCTIVE_ISSUANCE_ENABLED` | MoonRey productive issuance |
| `LIVE_INTEROP_*` (4 flags) | Bridge/relayer/watcher/external chain |
| `LIVE_CUSTODY_ENABLED` | Institutional custody |
| `LIVE_AGENT_FINANCIAL_EXECUTION_ENABLED` | Agent financial execution |
| `LIVE_CONNECTIVITY_ENABLED` | General live provider connectivity |

### Economy-specific activation flags

| Flag | Location | Value | Prerequisite chain |
| --- | --- | --- | --- |
| `SUNREY_ISSUANCE_ACTIVATED` | Not a standalone flag; enforced via `ACTIVATE_SUNREY_ISSUANCE` action | Refused on MAINNET | mainnet-gate + formula approval + Chunk 71 |
| `MOONREY_ISSUANCE_ACTIVATED` | `moonreyIssuanceActivated()` | `false` | Protocol layer; cannot flip without gate pass |
| `MAINNET_ECONOMICS_AUTHORIZED` | `evaluateMainnetRuntimeGate().productionEconomicsAuthorized` | `false` | Firewall + authorization + ceremony |
| `PRODUCTION_MIGRATION_PERFORMED` | mainnet-gate blocker | `false` | Governed migration manifest only |
| `LIVE_PROVIDER_CONNECTED` | productive-economy-data, economic-data-fabric | `false` | Provider certification + live validation |
| `PRODUCTION_SUNREY_ISSUANCE_FORMULA_APPROVED` | human-economy/types.ts | `false` | Human governance only |
| `PRODUCTION_MOONREY_ISSUANCE_DISABLED` | wave5 monetary-policy | `true` | Explicit disable |
| `LAUNCH_FREEZE_PRODUCTION_ACTIVATED` | launch-freeze/types.ts | `false` | Freeze ≠ activation |
| `LAUNCH_FREEZE_MAINNET_ENABLED` | launch-freeze/types.ts | `false` | Separate from freeze hash |

### Bypass prevention (verified)

1. **Compiled constants** — `LIVE_*` and `PRODUCTION_ACTIVE` are `false as const`; not runtime env toggles in application code.
2. **Kernel simulation assertion** — `assertSimulationOnly()` in kernel path.
3. **Mainnet runtime gate** — `evaluateMainnetRuntimeGate().passed` is always `false` with current blockers.
4. **Production activation firewall** — Evaluator only; no `activateProduction()` export.
5. **Architectural linters** — `production-economic-activation-guards.ts`, `architecture-freeze-guards.ts`, `productization-guards.ts` fail CI on `LIVE_*=true`.
6. **MoonRey protocol guard** — `moonreyIssuanceActivated(): false` typed return.
7. **Agent isolation** — No Execution Authority import from agent package.
8. **No admin bypass** — No god-key or test hook for ledger/accounts (AGENTS.md).

**No single flag bypasses prerequisite validation** — multiple independent gates must be satisfied through governed, external processes.

---

## Activation sequence (when authorized — not now)

This sequence is documented for governance planning only. **Do not execute.**

1. External audits complete; critical findings resolved
2. Human governance approves final economic parameters and methodologies
3. Launch freeze hash recorded; ceremony produces `LAUNCH_AUTHORIZATION_CANDIDATE` (not `MAINNET_ACTIVE`)
4. Production genesis approved and signed offline
5. Validator set and operator acceptance recorded
6. Production HSM/KMS configured; keys never in repository
7. Production infrastructure deployed; monitoring and on-call live
8. DR and incident rehearsals signed off
9. Staged activation (Chunk 166) enables domains independently
10. Per-domain `LIVE_*` flags enabled only through governed configuration outside this repository's simulation posture

---

## Verification commands

```bash
npm run check:production-safety
npm run lint:architecture
node --experimental-strip-types --disable-warning=ExperimentalWarning \
  -e "import { evaluateMainnetRuntimeGate } from './packages/sunrey-chain/src/runtime/mainnet-gate.ts'; console.log(JSON.stringify(evaluateMainnetRuntimeGate(), null, 2))"
```

Expected: `passed: false`, `mainnetActive: false`, non-empty `missingBlockerIds`.

---

## Related documents

- `docs/production/SUNREY_PRODUCTION_READINESS_REPORT.md`
- `docs/productization/sunrey-mainnet-readiness-gate.json`
- `packages/sunrey-chain/src/runtime/mainnet-gate.ts`
- `docs/architecture/constitution.md` — launch authorization semantics
