# Wave 8 — Integrated Product Completion Report

**Program:** SunRey Sovereign Architecture — Wave 8 (Product Integration)  
**Date:** 2026-09-02  
**Auditor:** Cloud Agent (integrated red-team audit)  
**Environment:** `ENVIRONMENT=simulation`; all `LIVE_*` flags `false`

**Baseline documents read:** Wave 1–7 architecture completion reports, capability matrices, `SUNREY_SOVEREIGN_ARCHITECTURE_UPGRADE_PLAN.md`, `SUNREY_COMPONENT_STATUS_MATRIX.md`, `constitution.md`, and prior wave red-team suites.

**Deliverables produced:**

- `docs/architecture/SUNREY_INTEGRATED_PRODUCT_CAPABILITY_MATRIX.md`
- This report

---

## 1. Executive Summary

Wave 8 attacked the **integrated SunRey product** — not isolated subsystems — across human and productive economy journeys, wallet/ledger/chain reconciliation, exchange settlement, API and agent surfaces, vault consent, frontend authority boundaries, sandbox/production separation, regulated feature gates, failure modes, privacy, operations, and restart/recovery.

**What holds (simulation scope):**

- Monetary authority boundaries remain intact: Chunk 71 is the sole native issuance gate; agents cannot mint, self-approve, or bypass Kernel; exchange red-team reports **zero unauthorized mutations** (102 integrated adversarial tests pass after `npm ci`).
- Reconciliation is detect-only everywhere reviewed; `rejectDatabaseRewrite()` and `autoCorrected: false` patterns prevent secondary stores from rewriting chain or ledger canonical state.
- Sandbox is explicitly labeled (`productionActive: false`, `environment: simulation`); all `LIVE_*` flags compile to `false`.
- End-to-end demo (`npm run demo`) completes with balanced books and verified evidence hash chain.
- Human economy pipeline tests (47) and MoonRey red-team tests (23) pass; Phase G exchange/chain/failure/recovery suites pass.

**What blocks Wave 8 exit:**

1. **Prior wave failures** — Waves 3, 4, and 6 documented FAIL; Wave 7 not started. Sovereign economic proof roots, durable fabric journal, durable anti-replay, and privacy/policy hardening remain incomplete.
2. **Durable product persistence** — PostgreSQL adapters exist but in-memory defaults remain on exchange, custody, issuance replay books, and several product stores. Restart can lose replay protection (Wave 3/6 documented gap).
3. **Platform API auth** — Consumer BFF is authenticated; platform `/api/v1` routes largely use `nullAuthenticator` except `/me` and token-gated internal routes.
4. **Vault third-party consent** — `VaultAccessBroker` fail-closes with `CONSENT_SYSTEM_NOT_IMPLEMENTED` until consent ledger injected.
5. **CI / architecture regressions** — 5 unit-test failures including illegal `packages/external-data` → `packages/events` dependency and duplicate `test` keys in `package.json` files blocking integrity preflight.
6. **Mobile app** — not implemented in repository (`apps/` contains explorer only).
7. **Mainnet** — correctly fail-closed; not a Wave 8 activation target.

**Verdict: WAVE 8 EXIT GATE: FAIL** (see §17 for criterion-by-criterion table and blockers).

---

## 2. Architecture Before/After

| Dimension | Before Wave 8 | After Wave 8 audit |
| --- | --- | --- |
| Integrated product documentation | Per-wave matrices only | Unified capability matrix + this report |
| Cross-subsystem red-team evidence | Phase G + per-wave suites | 102 integrated tests re-run; human + productive journeys verified |
| Authority leak assessment | Scattered in wave reports | End-to-end trace confirms no new bypass paths in product wiring |
| Persistence posture | Documented gaps | Confirmed: PG optional; product default in-memory |
| Production claims | `CORE_CODE_COMPLETE_CANDIDATE` vs `PRODUCTION_READY=false` | Unchanged — simulation-only product integration |

No production flags were flipped. No authority was added to frontend, agents, exchange DB, or operational PostgreSQL.

---

## 3. Service Integration

| Service / package | Role in integrated product | Integration status |
| --- | --- | --- |
| `services/api` (Consumer BFF) | Primary authenticated product surface | **SANDBOX_READY** — orchestrates domain services |
| `services/accounts` | Kernel-gated fiat mutations | **WIRED** — EA → `postJournal` |
| `services/identity` | Sessions, ActorContext | **WIRED** to BFF and vault |
| `packages/kernel` | Compliance decisions + EA issuance | **CANONICAL** — all consequential mutations gated |
| `packages/ledger` | Fiat truth | **CANONICAL** — append-only, EA required |
| `packages/sunrey-chain` | Native asset truth (simulation) | **CANONICAL** for natives in dev; TS service non-authoritative anchor |
| `packages/custody` | Wallet read model + withdrawal simulation | **WIRED** — four-plane reconciliation |
| `packages/sunrey-exchange` | Matching, settlement, portfolio | **WIRED** — CoinPort/FiatPort to ledger in product path |
| `packages/sunrey-agent` | Grow proposals, action cards | **ISOLATED** — ProposalGate only |
| `packages/personal-data-vault` | Subject-bound encrypted store | **WIRED** — broker fail-closed |
| `packages/human-economic-contribution` | Human contribution registry | **WIRED** to issuance bridge |
| `packages/information-market` | HIN network | **WIRED** — consent/usage receipts |
| `packages/platform` | Grow orchestration | **WIRED** via BFF |

**Ownership boundaries:** Each protected component has a single canonical owner per `docs/architecture/manifest.json`. No parallel ledger, kernel, exchange, or mint was introduced during Wave 8.

---

## 4. Database Integration

| Database / store | Purpose | Authority | Wave 8 finding |
| --- | --- | --- | --- |
| PostgreSQL (`db/`) | Ledger, evidence, sessions, chain write log, PEVE snapshots | Durable adjunct; **not** chain monetary authority | Adapters exist; not default for all product paths |
| Exchange in-memory Maps | Orders, trades, holds | Simulation only | Lost on restart; reconciliation detects drift |
| Custody in-memory Maps | Operations metadata | Simulation only | `providerBalanceIsTruth: false` |
| Issuance replay Sets | `usedReplayIds`, consumption store | Should be durable for production | In-memory; restart gap confirmed |
| redb (Rust node) | Block/state store | Chain storage candidate | Dev/test scope |

**Criterion 3 (databases ≠ blockchain authority): PASS** — reconciliation code and custody/exchange reconciliation explicitly forbid rewriting chain state from secondary databases.

---

## 5. API / BFF

| Control | Status | Evidence |
| --- | --- | --- |
| Versioned contracts | PASS | `/api/v1` prefix; OpenAPI in `api/` |
| Consumer auth | PASS (sandbox) | Bearer tokens; sandbox personas; session revocation |
| Domain service delegation | PASS | BFF orchestrates; no duplicate ledger logic in handlers |
| Kernel → postJournal on financial mutations | PARTIAL | Accounts service wired; some product-adjacent paths still simulation-local |
| Role spoofing resistance | PASS (BFF) | Principal bound to customerId; restricted personas tested |
| Admin via consumer API | PASS (refused) | Internal routes require operator token + role headers |
| Direct balance update endpoint | PASS (absent) | No ungated balance mutation route found |
| Oversized requests | PASS | 64KB body limit on consumer HTTP |
| Idempotency replay | PASS | Grow commands, ledger journals, settlement coordinator |
| Sandbox/mainnet confusion | PASS | Hardcoded `environment: simulation`; health reports `productionActive: false` |

**Platform API gap:** `nullAuthenticator` on most routes remains a Wave 7 hardening item (risk R6).

---

## 6. Wallet

| Attack / property | Result |
| --- | --- |
| Wallet balance modification without authority | **REFUSED** — custody product reads positions; mutations require Kernel path |
| Provider balance treated as truth | **PREVENTED** — `providerBalanceIsTruth: false` |
| Chain vs wallet mismatch | **DETECTED** — `reconcileWallet()` records break with `autoCorrected: false` |
| Frontend fake balance | **NON-AUTHORITATIVE** — client state does not post journals |

Wallet native balances reconcile **observationally** to chain via four-plane model; canonical native supply remains on chain + Chunk 71 issuance path.

---

## 7. Ledger

| Property | Status |
| --- | --- |
| Append-only | **ENFORCED** — no update/delete on journals |
| EA required | **ENFORCED** — `postJournal()` throws without authority |
| Balanced invariant | **VERIFIED** — demo Step 10: debits = credits |
| Stored balance on Account forbidden | **ENFORCED** — read model projection only |
| Admin ledger rewrite | **REFUSED** — no admin delete path; kernel gating CI |

---

## 8. Exchange

| Attack | Result |
| --- | --- |
| Exchange minting | **REFUSED** — red-team 0 unauthorized mutations |
| Trade creating excess assets | **REFUSED** — settlement through CoinPort/FiatPort with EA |
| Duplicate settlement | **BLOCKED** — `DUPLICATE_TRANSFER_BLOCKED`, ledger idempotency |
| SunRey/MoonRey substitution | **REFUSED** — distinct asset IDs and registry entries |
| Market price affecting supply | **REFUSED** — price ≠ issuance; GPUV/PEVE separate |
| GPUV as MoonRey market price | **PREVENTED** — issuance class guards + documentation |
| PEVE as SunRey market price | **PREVENTED** — valuation constitution |

Settlement replay protection: in-memory `postedKeys` + clearing state machine + ledger idempotency keys. **Durable settlement replay across restart: PARTIAL.**

---

## 9. Grow My Money (Agent)

| Attack | Result |
| --- | --- |
| Increase own mandate | **REFUSED** — `SELF_EXPANSION_FORBIDDEN` |
| Access unrelated Vault data | **REFUSED** — purpose/capability/owner checks |
| Change consent | **REFUSED** — agent lacks consent mutation tools |
| Move money without permission | **REFUSED** — ProposalGate; `mayExecute: false` on privileged tools |
| Execute disabled regulated investment | **REFUSED** — `LIVE_INVESTMENT_EXECUTION=false` |
| Mint SunRey / MoonRey | **REFUSED** — structural isolation; no `postJournal` in agent package |
| Approve governance / change policy | **REFUSED** — AI governance approval rejected in human pipeline tests |
| Exchange order beyond mandate | **REFUSED** — `proposalWithinMandate()` asset/market allowlists |

Agent cannot self-approve (`assertAgentCannotSelfApprove`). Human approval required on BFF grow path.

---

## 10. Vault

| Attack | Result |
| --- | --- |
| Read another user's permissions | **REFUSED** — subject-bound `principal.identityId` |
| Revoked consent reuse | **REFUSED** — broker checks active grants |
| Expired permission reuse | **REFUSED** — TTL enforced |
| Purpose expansion | **REFUSED** — purpose mismatch → `PURPOSE_DENIED` |
| Silent data-source connection | **REFUSED** — explicit capability required |
| Raw sensitive data exposure | **MITIGATED** — minimum necessary fields; forbidden keys scanned |
| Agent access after mandate revocation | **REFUSED** — mandate expiry + tool authorization |

**Gap:** Third-party operator access fails closed with `CONSENT_SYSTEM_NOT_IMPLEMENTED` until durable consent ledger wired (Wave 7).

---

## 11. Action Center

| Property | Status |
| --- | --- |
| Backend-backed state | **PARTIAL** — merges agent cards, access events, grow status; some fixture state |
| Kernel states preserved | **PASS** — `KERNEL_HOLD`, `MANUAL_REVIEW`, `STEP_UP` not collapsed |
| Frontend cannot approve regulated actions | **PASS** — approval requires authenticated human on BFF |
| Durable action history | **PARTIAL** — in-memory agent platform default |

---

## 12. Web / Mobile Integration

| Surface | Status |
| --- | --- |
| Consumer BFF for Lovable/preview | **SANDBOX_READY** — preview server, sandbox tokens |
| Static explorer (`apps/explorer`) | **SIMULATION** — read-only demo |
| Mobile app | **NOT_IMPLEMENTED** — Chunk 97 sync types only |
| Client-side state manipulation | **NON-AUTHORITATIVE** — server/chain unchanged by fake client fields |

Preview tests confirm health never reports `LIVE_PAYMENTS_ENABLED: true`.

---

## 13. Admin / Governance

| Attack | Result |
| --- | --- |
| Ordinary admin mint | **REFUSED** |
| Admin change supply | **REFUSED** — Chunk 71 gate |
| Admin enable mainnet | **REFUSED** — `refuseForceActivation()` |
| Admin bypass governance | **REFUSED** — human governance validation on issuance |
| Rewrite finalized claim / block | **REFUSED** — append-only registries |
| Delete ledger history | **REFUSED** |
| Modify EvidenceRoot | **NOT EXPOSED** — roots not production-wired |
| Validator private key access | **REFUSED** — dev keystore only; HSM not configured |

Internal operator routes require `x-sunrey-internal-token` + governance role; consumer clients blocked.

---

## 14. Sandbox Deployment

| Control | Status |
| --- | --- |
| Sandbox transaction → mainnet | **REFUSED** — network_id / chain_id guards |
| Sandbox key reuse on mainnet | **REFUSED** — mainnet identity separate |
| Sandbox governance approval reuse | **REFUSED** — environment-scoped records |
| Client flag enabling production rail | **REFUSED** — compile-time `LIVE_*` false |
| Malformed environment switch | **REFUSED** — hardcoded simulation in BFF context |
| Sandbox provider as production-approved | **REFUSED** — certification gate + `productionActive: false` |

---

## 15. Reconciliation

| Cross-check | Detects mismatch? | Rewrites canonical? |
| --- | --- | --- |
| Chain ↔ secondary DB | **YES** | **NO** |
| Custody ↔ chain | **YES** | **NO** |
| Exchange ↔ ledger | **YES** | **NO** |
| Issuance receipts ↔ supply book | **YES** | **NO** |
| Claims ↔ consumption store | **YES** (in-memory) | **NO** |
| Economic proof roots | **N/A** — roots not in block headers |

Phase G recovery test: reconciliation mismatch **persists** until controlled compensating snapshot — no silent heal.

---

## 16. Privacy

| Surface | Finding |
| --- | --- |
| Frontend/API responses | Minimum necessary; no PAN/CVV; wallet last4 only |
| Logs | Sensitive key redaction patterns in `services/api` logging |
| HIN → chain anchors | Hashed refs only; forbidden personal keys rejected in tests |
| Agent prompts | No raw vault DB credentials |
| Metrics | Human economy monitoring excludes sensitive personal data |
| Graph/events | PEG non-authoritative; no bulk surveillance path activated |

No Wave-8-scope privacy leak requiring immediate code fix was found in integrated paths. Durable consent and RightsRoot production remain Wave 7 gaps.

---

## 17. Red-Team Findings

### Task 1 — Full user journey

**Human economy:** identity → HIN contribution → verification → consent → economic claim → PEVE → dev monetary proposal → governance → SunRey issuance → finality → wallet → ledger → API — **VERIFIED in simulation** via `tests/wave6-sunrey-human-economy-monetary.test.ts` (4 domain E2E scenarios + failure cases).

**Productive economy:** productive source → provider → observations → oracle mesh → event resolution → productive claim → GPUV → governance → MoonRey issuance → wallet → exchange — **VERIFIED in simulation** via Wave 5 red-team + `tests/chunk-147-parameterized-dual-economy-rehearsal.test.ts` (`suppliesReconciled: true`).

### Tasks 2–14 summary

| Task area | Outcome |
| --- | --- |
| Wallet/ledger/chain red team | No canonical supply alteration; intentional mismatches detected |
| Exchange red team | 0 unauthorized mutations; asset isolation holds |
| API red team | Safe failure on spoofing, oversize, unauthorized access |
| Agent red team | All escalation/mint paths refused |
| Vault red team | Fail-closed; consent gap for third-party |
| Frontend red team | Non-authoritative client state |
| Sandbox/production separation | Strict isolation |
| Regulated feature gates | DISABLED / SANDBOX_ONLY / PROVIDER_REQUIRED |
| Service failure | Safe refusal; no fabricated balances (Phase G failures suite) |
| Data consistency | Mismatches detected; no chain rewrite |
| Privacy | No new integrated leaks |
| Operations | No admin bypass |
| Restart/recovery | Supply/claims preserved in tested scenarios; in-memory replay gap on cold restart |

---

## 18. Failure / Recovery Findings

| Simulated failure | Product behavior |
| --- | --- |
| Exchange unavailable | `SAFE_REFUSED`; no silent fills |
| Provider unavailable | Circuit breakers; connector open; no mint side effects |
| Kernel/policy unavailable | Mutations refused; no bypass |
| DB unavailable | Persistence tests separate; in-memory paths continue in dev only |
| Chain query down | Read degradation; no fabricated finality in tested paths |

`tests/phase-g-recovery.test.ts`: no duplicate fills, postings, or chain txs after recovery scenarios.

**Gap:** Full-stack restart with PostgreSQL as default not demonstrated end-to-end in this audit.

---

## 19. Remaining Simulations

- All monetary execution (`ENVIRONMENT=simulation`)
- Exchange matching/settlement default in-memory store
- Custody provider sandbox balances
- Oracle mesh and productive registry in-memory
- Human attestation mesh (not built)
- Information consensus (distributed, not unified layer)
- Mobile client
- Production BFT validator mesh
- HSM/KMS (`PRODUCTION_HSM_KMS_CONFIGURED=false`)
- Mainnet ceremony (Chunks 164–167 rehearsal only)

---

## 20. Regulated Provider Dependencies

| Rail | Gate | Provider status |
| --- | --- | --- |
| Banking / payments | `LIVE_BANKING_RAILS` | Fixture adapters in `packages/payments/src/production-candidate` |
| FX | `LIVE_PAYMENTS_ENABLED` | Sandbox conformance only |
| Cards | External issuer | `packages/cards` simulation |
| Investment / grow execution | `LIVE_INVESTMENT_EXECUTION` | Brokerage adapters fixture-only |
| Custody / crypto | `LIVE_CUSTODY_ENABLED` | `packages/custody/src/provider-candidate` |
| KYC | `LIVE_EXTERNAL_KYC` | Identity provider-candidate fixtures |
| Market data | Exchange live mode | Phase D contract; fixtures |

Catalog: ~73/126 providers; 53 accepted gaps. Trust engine does not fabricate canonical values.

---

## 21. Wave 9 Requirements (handoff — do not implement)

**WAVE 9 — Adversarial Security, Economic Invariants, and Production Readiness**

### Prerequisites

- Wave 8 blockers closed (durable persistence, prior wave FAIL items, CI green)
- Chunks 164–167 ceremony rehearsal complete
- External security audit package assembled (`docs/security/audit-readiness/`)

### Required workstreams

1. **Threat modeling** — STRIDE + economic threat model expansion; validator Byzantine model; agent prompt-injection matrix
2. **Application penetration testing** — Consumer BFF, platform API (post-auth hardening), internal gates
3. **Blockchain adversarial tests** — `packages/sunrey-range` scenarios; reorg safety; supply invariant fuzzing
4. **Validator Byzantine tests** — BFT fault injection beyond dev four-validator harness
5. **Economic attacks** — double issuance, settlement replay across restart, dual-supply migration attacks
6. **Oracle attacks** — quorum disagreement, stale fact promotion, Sybil provider registration
7. **Sybil attacks** — human contribution mesh; cross-wallet monetization
8. **Claim fraud** — fingerprint collision, cross-domain duplicate, governance forgery
9. **Privacy attacks** — vault purpose bypass, consent replay, log/metrics exfiltration
10. **Agent attacks** — mandate expansion, tool injection, cross-tenant vault access
11. **Exchange attacks** — settlement race, asset substitution, market manipulation vs supply
12. **Reconciliation attacks** — operator pressure to auto-correct; DB→chain rewrite attempts
13. **Load/performance testing** — Wave 6 Prompt 16 baselines extended to full product on PostgreSQL
14. **Chaos testing** — `access-41-chaos` pattern extended to ledger, evidence, kernel, agent
15. **Disaster recovery** — full-stack restart; redb + PG; wallet projection rebuild; event bus replay
16. **Mainnet readiness** — Chunk 143 firewall + 164 freeze + 165 ceremony + 166 staged activation + 167 abort/recovery
17. **Security audit preparation** — independent audit scope (`INDEPENDENT_SECURITY_AUDIT_SCOPE.md`)
18. **Operational incident response** — runbooks exercised under fault injection
19. **Final production activation checklist** — human ceremony authorization; still does not auto-activate mainnet

### Exit criteria (Wave 9)

- Adversarial range suite green on PostgreSQL-backed product paths
- No P0/P1 open in vulnerability register
- Economic invariants verified under chaos (`docs/economics/economic-invariants.md`)
- DR rehearsal proves no duplicate issuance after recovery
- Mainnet readiness gate passes — **activation still requires explicit human ceremony**

---

## Wave 8 Exit Gate (38 criteria)

| # | Criterion | Result | Notes |
| --- | --- | --- | --- |
| 1 | Explicit ownership boundaries | **PASS** | manifest.json + constitution |
| 2 | Durable persistence where required | **FAIL** | In-memory defaults on product paths |
| 3 | DBs not blockchain monetary authority | **PASS** | reconciliation fail-closed |
| 4 | Consumer API uses domain services | **PASS** | BFF orchestration |
| 5 | API contracts versioned/governed | **PASS** | `/api/v1`, OpenAPI |
| 6 | Wallet reconciles to chain | **PARTIAL** | observational; simulation |
| 7 | Ledger balanced/append-only | **PASS** | demo + tests |
| 8 | Exchange cannot alter native supply | **PASS** | red-team |
| 9 | Exchange price ≠ PEVE/GPUV | **PASS** | issuance guards |
| 10 | Native transfers reflect finality | **PARTIAL** | dev harness only |
| 11 | Transaction replay blocked | **PARTIAL** | in-memory; restart gap |
| 12 | Exchange settlement replay blocked | **PARTIAL** | in-memory keys |
| 13 | SunRey/MoonRey isolated | **PASS** | registry + tests |
| 14 | Regulated rails gated | **PASS** | LIVE_* false |
| 15 | Grow agents use explicit mandates | **PASS** | engine + policy |
| 16 | Agents cannot escalate permissions | **PASS** | SELF_EXPANSION_FORBIDDEN |
| 17 | Agents cannot mint/govern issuance | **PASS** | isolation guards |
| 18 | Vault backend consent/rights | **PARTIAL** | third-party consent unwired |
| 19 | Revoked vault permissions stop access | **PASS** | broker checks |
| 20 | Action Center durable backend | **PARTIAL** | mixed fixture/durable |
| 21 | Frontend cannot alter canonical state | **PASS** | orchestration only |
| 22 | Sandbox/production isolated | **PASS** | flags + health |
| 23 | Sandbox distinguishable from live | **PASS** | catalog labels |
| 24 | Full-stack health observable | **PARTIAL** | fragmented metrics |
| 25 | Critical failures degrade safely | **PASS** | Phase G failures |
| 26 | Reconciliation detects mismatches | **PASS** | all planes |
| 27 | Reconciliation cannot rewrite chain | **PASS** | explicit refusal |
| 28 | Restart/recovery preserves supply/claims | **PARTIAL** | tested scenarios; replay gap |
| 29 | No duplicate issuance after recovery | **PARTIAL** | in-memory consumption |
| 30 | Admin cannot bypass monetary governance | **PASS** | kernel gating |
| 31 | Privacy controls intact | **PARTIAL** | Wave 7 items open |
| 32 | Wave 2 blockchain invariants | **PASS** | simulation |
| 33 | Wave 3 proof invariants | **FAIL** | roots/registry durable gaps |
| 34 | Wave 4 Awareness invariants | **FAIL** | fabric journal |
| 35 | Wave 5 MoonRey invariants | **PASS** | simulation scope |
| 36 | Wave 6 SunRey invariants | **FAIL** | replay, mesh, proof bundle |
| 37 | Wave 7 privacy/policy invariants | **FAIL** | not started |
| 38 | Mainnet fail-closed | **PASS** | all gates |

### Blocking failures (enumerated)

1. Criterion 2 — Product paths default to in-memory persistence; PostgreSQL not mandatory for staging integration.
2. Criterion 11 — Transaction/issuance replay protection not durable across restart.
3. Criterion 12 — Exchange settlement idempotency not durable across restart.
4. Criterion 28–29 — Recovery does not prove duplicate-issuance prevention after cold restart with durable stores.
5. Criterion 33 — Wave 3 sovereign proof architecture incomplete (five roots, claim registry, proof bundles).
6. Criterion 34 — Wave 4 unified Awareness Fabric journal incomplete.
7. Criterion 36 — Wave 6 durable anti-replay, attestation mesh, proof-bound bridge wiring incomplete.
8. Criterion 37 — Wave 7 privacy/policy hardening not delivered (API auth, RightsRoot, mandate persistence).
9. CI integrity — illegal package dependency and duplicate JSON keys prevent clean `npm run ci`.

---

## Validation Results

| Command / suite | Result |
| --- | --- |
| `npm ci` | PASS |
| `npm run demo` | PASS — balanced books, evidence chain verified |
| Integrated red-team (102 tests) | PASS — phase-g + wave5 red-team + wave4 exit-gate + chaos |
| Wave 6 human economy monetary (47 tests) | PASS |
| Wave 3 economic proof red-team (29/32 in subset) | PASS on authority/replay tests |
| Full unit suite (`npm test`) | **5 FAIL** — architecture lint, integrity baseline, wave-4 fabric, chain guards |
| `npm run ci` | **FAIL** at integrity preflight (duplicate package.json keys) |

---

## Files Created / Modified

| File | Action |
| --- | --- |
| `docs/architecture/SUNREY_INTEGRATED_PRODUCT_CAPABILITY_MATRIX.md` | **Created** |
| `docs/architecture/WAVE8_INTEGRATED_PRODUCT_COMPLETION_REPORT.md` | **Created** |

No production code, flags, or authority paths were modified in this Wave 8 audit branch.

---

**WAVE 8 EXIT GATE: FAIL**

Do not begin Wave 9 until blockers in §17 are addressed and CI is green.
