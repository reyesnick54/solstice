# SunRey build status (canonical)

**This is the single authoritative build-status document for the repository.**

## 1. Purpose

Record what is implemented, tested, simulated, configured, blocked, or
production-qualified **based on repository evidence**. This document governs
engineering truth for developers, auditors, regulators, investors, and future
automation. It does not activate production, infer regulatory approval, or
replace the architecture constitution.

Machine-readable status metadata lives in [`build-status.json`](./build-status.json).
Per-chunk narrative inventory (pre–Wave 2 Prompt 4) is archived at
[`docs/architecture/historical/build-status-chunk-inventory-pre-wave2-prompt4.md`](./architecture/historical/build-status-chunk-inventory-pre-wave2-prompt4.md).

## 2. Verification record

| Field | Value |
| --- | --- |
| Last verified (UTC) | 2026-08-31 |
| Git commit | `8f4683320e0a0957c8d623ce881634577ac0bff6` |
| Branch context | `main` at Wave 2 / Prompt 4 consolidation |
| CI posture | Seven-stage pipeline; persistence job separate |

Re-verify after any change to protected financial mutators, `LIVE_*` flags,
provider activation, mainnet/genesis paths, or this document's system matrix.

## 3. Status vocabulary

Each label has a fixed meaning. **Code existing ≠ production-ready.**
**Endpoint configured ≠ live. Network reached ≠ production integration validated.**

| Label | Meaning |
| --- | --- |
| `NOT_IMPLEMENTED` | No canonical owner implementation; reserved or absent. |
| `PARTIAL` | Some surfaces exist; required end-to-end path incomplete. |
| `IMPLEMENTED` | Canonical owner code complete for declared simulation scope. |
| `SIMULATED` | Deterministic fixtures, local mocks, or in-process adapters only. |
| `CONFIGURED` | Wiring, schemas, or secret references exist; no live validation. |
| `INTEGRATION_READY` | Contract-complete adapter; awaiting credentials, contracts, or human gate. |
| `LIVE_REACHABLE` | Network path exercised outside fixtures (not claimed in this tree). |
| `LIVE_VALIDATED` | Successful production-like integration with recorded evidence (not claimed). |
| `PRODUCTION_QUALIFIED` | Independent qualification + authorized activation (not claimed). |
| `BLOCKED` | Stop/resume gate, missing dependency, or constitution refusal. |
| `EXTERNAL_DEPENDENCY` | Requires provider contract, counsel, or third-party operation. |
| `REGULATORY_GATED` | Policy pack, corridor, or license not `CONFIRMED_BY_COUNSEL`. |

Test column values: `PASSING`, `PARTIAL`, `ABSENT`.

Production column values: `NOT_PRODUCTION_QUALIFIED` (default),
`ENGINEERING_QUALIFIED`, `PRODUCTION_CANDIDATE`, `PRODUCTION_ACTIVE`.
Only the last two imply human/external authorization; **none apply on current `main`.**

## 4. Repository posture (evidence)

Source: `packages/config/src/flags.ts`, enforced by
`scripts/check-deployment-posture.py` and `scripts/check-production-safety.mjs`.

```
ENVIRONMENT=simulation
SIMULATION_MODE=true
Every LIVE_* flag=false
PRODUCTION_HSM_KMS_CONFIGURED=false
mainnetEnabled=false (all chain release paths)
productionAuthorized=false
```

No PR may flip these without an explicit authorized launch process outside
ordinary engineering.

## 5. System matrix

| System | Implementation | Tests | Integration | Security | Regulatory | Production |
| --- | --- | --- | --- | --- | --- | --- |
| Authorization spine (Kernel → EA → Ledger) | IMPLEMENTED | PASSING | SIMULATED | ENGINEERING_VERIFIED | REGULATORY_GATED | NOT_PRODUCTION_QUALIFIED |
| Banking accounts / balances | IMPLEMENTED | PASSING | SIMULATED | ENGINEERING_VERIFIED | REGULATORY_GATED | NOT_PRODUCTION_QUALIFIED |
| PostgreSQL persistence | IMPLEMENTED | PASSING | SIMULATED | ENGINEERING_VERIFIED | EXTERNAL_DEPENDENCY | NOT_PRODUCTION_QUALIFIED |
| Identity / authentication | IMPLEMENTED | PASSING | SIMULATED | ENGINEERING_VERIFIED | REGULATORY_GATED | NOT_PRODUCTION_QUALIFIED |
| Compliance screening | IMPLEMENTED | PASSING | SIMULATED | ENGINEERING_VERIFIED | REGULATORY_GATED | NOT_PRODUCTION_QUALIFIED |
| Payments / FX / cards / treasury | PARTIAL | PASSING | SIMULATED | ENGINEERING_VERIFIED | REGULATORY_GATED | NOT_PRODUCTION_QUALIFIED |
| Investments / risk / strategy lab | IMPLEMENTED | PASSING | SIMULATED | ENGINEERING_VERIFIED | REGULATORY_GATED | NOT_PRODUCTION_QUALIFIED |
| Personal Economic Graph / Agent / Growth | IMPLEMENTED | PASSING | SIMULATED | ENGINEERING_VERIFIED | REGULATORY_GATED | NOT_PRODUCTION_QUALIFIED |
| SunRey Chain (simulation trust layer) | IMPLEMENTED | PASSING | SIMULATED | ENGINEERING_VERIFIED | REGULATORY_GATED | NOT_PRODUCTION_QUALIFIED |
| Rust blockchain workspace / dev BFT node | IMPLEMENTED | PASSING | SIMULATED | ENGINEERING_VERIFIED | REGULATORY_GATED | NOT_PRODUCTION_QUALIFIED |
| SunRey Coin (application ledger) | IMPLEMENTED | PASSING | SIMULATED | ENGINEERING_VERIFIED | REGULATORY_GATED | NOT_PRODUCTION_QUALIFIED |
| SunRey Coin / MoonRey Coin (chain-native) | IMPLEMENTED | PASSING | SIMULATED | ENGINEERING_VERIFIED | REGULATORY_GATED | NOT_PRODUCTION_QUALIFIED |
| MoonRey productive issuance engine | IMPLEMENTED | PASSING | SIMULATED | ENGINEERING_VERIFIED | REGULATORY_GATED | NOT_PRODUCTION_QUALIFIED |
| Access Economy / Access Fabric | IMPLEMENTED | PASSING | SIMULATED | ENGINEERING_VERIFIED | REGULATORY_GATED | NOT_PRODUCTION_QUALIFIED |
| Access Ledger (forbidden parallel) | NOT_IMPLEMENTED | PASSING | SIMULATED | ENGINEERING_VERIFIED | REGULATORY_GATED | NOT_PRODUCTION_QUALIFIED |
| SunRey Exchange | IMPLEMENTED | PASSING | SIMULATED | ENGINEERING_VERIFIED | REGULATORY_GATED | NOT_PRODUCTION_QUALIFIED |
| HIN / information marketplace | IMPLEMENTED | PASSING | SIMULATED | ENGINEERING_VERIFIED | REGULATORY_GATED | NOT_PRODUCTION_QUALIFIED |
| External-data framework | IMPLEMENTED | PASSING | SIMULATED | ENGINEERING_VERIFIED | EXTERNAL_DEPENDENCY | NOT_PRODUCTION_QUALIFIED |
| Provider catalogs / runtime | IMPLEMENTED | PASSING | SIMULATED | ENGINEERING_VERIFIED | EXTERNAL_DEPENDENCY | NOT_PRODUCTION_QUALIFIED |
| S3M AI provider | IMPLEMENTED | PASSING | SIMULATED | ENGINEERING_VERIFIED | EXTERNAL_DEPENDENCY | NOT_PRODUCTION_QUALIFIED |
| Grok / xAI provider | PARTIAL | PASSING | CONFIGURED | ENGINEERING_VERIFIED | EXTERNAL_DEPENDENCY | NOT_PRODUCTION_QUALIFIED |
| Security / CryptoSuite / PQC agility | PARTIAL | PASSING | SIMULATED | ENGINEERING_VERIFIED | EXTERNAL_DEPENDENCY | NOT_PRODUCTION_QUALIFIED |
| Interop / relayer | PARTIAL | PASSING | SIMULATED | ENGINEERING_VERIFIED | REGULATORY_GATED | NOT_PRODUCTION_QUALIFIED |
| Mobile wallet sync | IMPLEMENTED | PASSING | SIMULATED | ENGINEERING_VERIFIED | REGULATORY_GATED | NOT_PRODUCTION_QUALIFIED |
| Production deployment / mainnet paths | IMPLEMENTED | PASSING | SIMULATED | ENGINEERING_VERIFIED | REGULATORY_GATED | NOT_PRODUCTION_QUALIFIED |

Detailed evidence paths are in [`build-status.json`](./build-status.json).

## 6. Phase 1 exit criterion

**Status: PASSING** (verified by `tests/phase-1-exit-criterion.test.ts` and `npm run demo`).

All six points hold in running code with no assertion relaxed:

1. Account opening requires valid Kernel Execution Authority.
2. Balances are class-segregated.
3. Every state change seals evidence.
4. Evidence hash chain verifies end-to-end.
5. Deposit journals balance.
6. Refused opening seals evidence and creates no account.

Historical note: at commit `de3c633` on early `main`, none of these held.
The consolidated authorization spine (PR #12 lineage) satisfies them now.

## 7. Major subsystems (evidence summary)

### Authorization spine

- **Owner:** `packages/kernel`, `packages/permissions`, `packages/ledger`, `packages/evidence`, `services/accounts`
- **Status:** IMPLEMENTED / SIMULATED — sole path for financial mutation.
- **Not claimed:** counsel-confirmed policy packs, live AML vendors.

### SunRey Blockchain / Rust workspace

- **Owner:** `packages/sunrey-chain`, `packages/sunrey-chain/rust`, `packages/sunrey-chain/node`
- **Status:** IMPLEMENTED development node, P2P, mempool, four-validator BFT rehearsal, formal/fuzz smoke.
- **Not claimed:** production mainnet, public testnet, production BFT, `mainnetEnabled=true`.
- Chunk 31 protocol freeze is architecture-only; production node/consensus are rehearsal-scoped.

### SunRey Coin / MoonRey Coin

- **Application coin:** `packages/sunrey-coin` — Kernel-gated Clean Room issuance on canonical Ledger.
- **Chain-native:** `packages/sunrey-chain/rust/crates/native-assets` — `SUNREY_COIN` / `MOONREY_COIN`, precision 6, tickers `NOT_ASSIGNED`.
- **MoonRey issuance:** productive contributions via `packages/sunrey-chain/src/productive`; production quantities `UNCONFIGURED`.
- **Not claimed:** public ticker, production mint, live Exchange price setting.

### Access Economy / Access Fabric

- **Owners:** `packages/access-economy`, `packages/access-fabric`, `packages/sunrey-access`, `packages/sunrey-access-fabric`, `packages/sunrey-chain/src/access`, `packages/sunrey-exchange/src/access-fabric`
- **Status:** IMPLEMENTED simulation; qualification lab passes on `main` (`ACCESS_FABRIC_CODE_COMPLETE_CANDIDATE` set only by passing runs).
- **Domain status doc:** [`docs/architecture/ACCESS_FABRIC_STATUS.md`](./architecture/ACCESS_FABRIC_STATUS.md) — subordinate to this file.
- **Not claimed:** `PRODUCTION_READY`, live provider connectivity, Access Ledger package (forbidden).

### HIN / Grow My Money / financial agents

- **HIN:** `packages/information-market` — IMPLEMENTED simulation; `productionActivated=false`.
- **Grow / Agent:** `packages/platform`, `packages/agent`, `packages/sunrey-agent` — proposal-only; ProposalGate isolation enforced structurally.
- **Not claimed:** agent Execution Authority, auto-trading, HIN-based live issuance.

### SunRey Exchange

- **Owner:** `packages/sunrey-exchange` — institutional ops, consumer trading, capacity/access markets (ACCESS-09).
- **Status:** IMPLEMENTED simulation; settlement uses in-memory coin/fiat ports in parts — not fully ledger-backed for all paths.
- **Not claimed:** licensed exchange, live market data, production consumer trading.

### External-data / opportunity APIs / providers

- **Owner:** `packages/external-data`, `packages/provider-sdk`, `packages/sunrey-chain/src/provider-runtime`, production-candidate fixtures under regulated packages.
- **Status:** IMPLEMENTED simulation; `NodeExternalHttpTransport` fails closed outside explicit preview.
- **Not claimed:** live bank, FX, oracle HTTP, or provider `PRODUCTION_ELIGIBLE`.

### AI: S3M / Grok

- **S3M (Chunk 102):** `packages/ai-runtime/src/providers/s3m` — IMPLEMENTED; local simulator default; advisory only.
- **Grok/xAI (Chunk 103):** `packages/ai-runtime/src/providers/xai-grok` — adapter IMPLEMENTED; default `available=false`, `FixtureHttpsTransport`; optional preview via `SUNREY_EXTERNAL_AI_PREVIEW_ENABLED=true` with secret references. **Not claimed:** Grok live and production-ready, successful production inference certified, S3M production deployment.
- **Runtime (Chunk 101):** `packages/ai-runtime` — inference plane only; cannot execute, sign, or mint.

### Security / PQC

- **Owner:** `packages/security` — KeyProvider, envelope encryption, ceremony simulation, CryptoSuite agility (Chunk 33R).
- **Status:** PARTIAL — engineering simulation complete; `PRODUCTION_HSM_KMS_CONFIGURED=false`.
- **Not claimed:** commercial HSM certification, production PQC library, completed external security audit.

### Interop / relayer

- **Owner:** `packages/sunrey-chain/src/interop` — development engine and demo.
- **Status:** PARTIAL / SIMULATED — audit scope marks production interoperability **not implemented** (`docs/audit/` threat catalog).

### Mobile / backend integration

- **Owner:** `packages/sunrey-chain/src/wallet/mobile-sync`, `services/api` consumer BFF.
- **Status:** IMPLEMENTED simulation sync; BFF orchestrates, does not replace Kernel or Ledger.

### Production deployment configuration

- **Owner:** `packages/sunrey-chain/src/infra`, release-candidate/mainnet, genesis/pregenesis/handoff paths, `infra/sunrey-production`, `deploy/sunrey-testnet`.
- **Status:** IMPLEMENTED rehearsal artifacts; `productionAuthorized=false`, `observedProduction=false`.
- **Not claimed:** mainnet launch, real genesis keys, live infrastructure.

## 8. Test status

| Area | Evidence |
| --- | --- |
| Unit / chunk tests | `npm test` — broad package coverage |
| Architecture / constitution | `npm run lint:architecture`, Python invariant linter |
| Kernel gating | `npm run gate` / `scripts/check-kernel-gating.mjs` |
| Phase 1 exit | `tests/phase-1-exit-criterion.test.ts` |
| Persistence | `npm run test:persistence` (PostgreSQL job) |
| Rust chain | `cargo test` in `packages/sunrey-chain/rust` |
| Demos | `npm run demo` and subsystem demos listed in §17 |
| Fuzz / formal smoke | `npm run test:fuzz-smoke`, `npm run test:formal-smoke` |
| Access qualification | `tests/access-economy-e2e-qualification.test.ts`, ACCESS-13 suites |
| Build-status metadata | `node scripts/check-build-status.mjs` |

## 9. External integration status

All regulated external integrations are **SIMULATED** or **CONFIGURED** at best.
No subsystem is `LIVE_VALIDATED` or `PRODUCTION_QUALIFIED` in this repository.

| Integration class | Status | Notes |
| --- | --- | --- |
| Banking / payment rails | SIMULATED | Chunk 10 fixture adapters |
| KYC / AML / sanctions | SIMULATED | Chunk 7; no live vendor |
| FX sources | SIMULATED | `SimulationFxProvider` |
| Card networks / wallets | SIMULATED | No Apple/Google certification |
| Custody / Travel Rule | SIMULATED | Institutional simulators |
| Oracles (HTTP) | SIMULATED | Production oracle framework; no live agreements |
| Market data | SIMULATED | Fixture feeds |
| HSM / KMS | SIMULATED | `PRODUCTION_HSM_KMS_CONFIGURED=false` |
| S3M inference | SIMULATED | Local simulator default |
| xAI Grok | CONFIGURED | Adapter + optional preview transport; CI uses fixtures |
| Access providers (travel, food, etc.) | SIMULATED | Partner-gated scaffolds only |

## 10. Security qualification status

- Engineering controls: Kernel gating, secret scan, static security lint, adversarial range (Chunk 57/157), audit remediation framework (Chunk 83).
- **Not claimed:** independent third-party audit completion, penetration test sign-off, production PQC deployment, FIPS/Common Criteria certification.

## 11. Regulatory and partner dependencies

- No jurisdiction pack rule is `CONFIRMED_BY_COUNSEL` (ADR-0006 / 0007 / 0008 PROPOSED).
- Access corridors, treasury concentration, and monitoring thresholds remain `RESEARCH_REQUIRED` where labeled.
- Provider activation requires human `HUMAN_ACCEPTED` / governance ceremony — not AI-marked.
- Operating scope matrix: Chunk 161 simulation; not legal advice.

## 12. Production-readiness state

**Overall: NOT_PRODUCTION_QUALIFIED.**

Engineering rehearsal layers (mainnet RC, economic RC, genesis ceremony, handoff, staged activation) are IMPLEMENTED as **simulation and qualification artifacts only**. They do not activate production.

Productization audit (implementation vs canonical HTTP/runtime gaps):
[`docs/productization/SUNREY_CANONICAL_IMPLEMENTATION_INVENTORY.md`](./productization/SUNREY_CANONICAL_IMPLEMENTATION_INVENTORY.md).

## 13. Known blockers

1. All `LIVE_*` flags compiled false — intentional simulation lock.
2. Counsel-confirmed regulatory packs absent.
3. No live provider contracts or `PRODUCTION_ELIGIBLE` human acceptance.
4. Exchange settlement not fully unified on `Ledger.postJournal` for all paths.
5. Public API `/v1` SDK gateway uses in-memory `DevelopmentPlatform` — not banking runtime.
6. Mainnet / public network / production BFT not authorized.
7. External AI production inference not certified (S3M and Grok remain simulation-primary).

## 14. Next engineering milestone

Wave 2 productization: align public API and Exchange settlement with the
authorization spine without weakening Kernel gating or simulation locks.
See `docs/productization/SUNREY_PRODUCTIZATION_BACKLOG.md`.

## 15. Status governance

### What constitutes IMPLEMENTED

Canonical owner path exists, matches `docs/architecture/manifest.json`, has
automated tests or demo proving declared scope, and does not violate
constitution boundaries.

### What constitutes LIVE

Requires `LIVE_*` or explicit connectivity flag **true** with signed human
authorization **and** recorded external validation evidence outside this
repository. Fixture or preview transport alone is not LIVE.

### What constitutes PRODUCTION_QUALIFIED

Requires independent qualification, governance authorization ceremony,
operating-scope activation, and explicit promotion policy —
`docs/productization/SUNREY_RELEASE_PROMOTION_POLICY.md`. Engineering RC
passing is `ENGINEERING_QUALIFIED` at most, not production active.

### Who may update status

- **Human maintainers** via PR updating `docs/BUILD_STATUS.md` and
  `docs/build-status.json` together.
- **Automation** may only verify or reject; it must not promote production
  states without human-authored evidence links.

### Evidence required before promotion

| Target state | Minimum evidence |
| --- | --- |
| IMPLEMENTED → INTEGRATION_READY | Contract tests + adapter owner + secret reference schema |
| INTEGRATION_READY → LIVE_REACHABLE | Recorded non-fixture connectivity log (stored outside repo secrets) |
| LIVE_REACHABLE → LIVE_VALIDATED | Passing integration test suite against live sandbox + incident runbook |
| LIVE_VALIDATED → PRODUCTION_QUALIFIED | Governance authorization + operating-scope matrix + promotion policy sign-off |

CI enforces vocabulary and posture via `scripts/check-build-status.mjs`.

## 16. Related documents (not authoritative for build status)

| Document | Role |
| --- | --- |
| `docs/architecture/constitution.md` | Architecture law |
| `docs/architecture/manifest.json` | Machine ownership |
| `docs/productization/SUNREY_CANONICAL_IMPLEMENTATION_INVENTORY.md` | Productization audit |
| `docs/architecture/ACCESS_FABRIC_STATUS.md` | Access subsystem detail |
| `docs/providers/PRODUCTION_READINESS_SCORECARD.md` | Provider checklist (simulation) |
| `docs/architecture/historical/*` | Historical snapshots |

If any document conflicts with this file **on implementation or production
posture**, this file wins until a deliberate PR updates both narrative and JSON.

## 17. How to verify

```bash
npm install
node scripts/check-build-status.mjs
npm run gate
npm test
npm run demo
npm run ci
```

Persistence (separate CI job):

```bash
npm run db:up
npm run db:migrate
npm run test:persistence
npm run db:down
```
