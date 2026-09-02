# Wave 1 Monetary Authority Audit

**Date:** 2026-09-02  
**Auditor:** Cloud Agent (Wave 1)  
**Baseline:** `docs/architecture/WAVE1_REPOSITORY_BASELINE.md`  
**Contract:** `docs/architecture/SUNREY_MONETARY_AUTHORITY_CONTRACT.md`

---

## Executive summary

The repository has a **single canonical mint gate** (`authorizeIssuance`) and **single supply book** (`AssetSupplyBook`). Technical controls prevent most forbidden actors from mutating canonical supply through the productized authority path. Several **parallel simulation supply ledgers** exist (Exchange, `sunrey-coin`, fee faucet, rehearsal fixtures) that are labeled non-canonical but could confuse operators. **Rehearsal code** directly mutates `AssetSupplyBook` fields, bypassing the mint gate — acceptable only in labeled fixtures, dangerous if copied to production paths.

**Authority conflicts discovered:** 4 material, 3 informational  
**HARD PREVENTED forbidden actors:** 11 of 15 assessed  
**Invariants with code enforcement:** 38 of 42 assessed  
**Missing tests:** 8 identified

---

## Task 1 — Supply authority trace

### Canonical mutation primitives

| Primitive | File | Total supply effect |
|-----------|------|---------------------|
| `authorizeIssuance` | `packages/sunrey-chain/src/economics/issuance.ts` | `+quantity` via `genesisAllocated` or `issuedPostGenesis` + `creditCirculating` |
| `burn` | `packages/sunrey-chain/src/economics/operations.ts` | `-quantity` via `burned` |
| `burnReservedFee` | `packages/sunrey-chain/src/economics/operations.ts` | `-quantity` (fee reserve → burn) |
| `transfer`, `lock`, `unlock`, `reserveFee`, `releaseFeeReserve`, `moveLive` | `operations.ts`, `supply.ts` | **No** total change |

### Call graphs

#### SunRey issuance (increase total)

```
Entry: runSunReyIssuancePipeline (issuance-pipelines.ts)
  → refuseForbiddenMutator(actor)
  → evaluateHumanGovernanceGate(network, actor)
  → developmentSunReyAuthority(...)
  → ProtocolNativeSupplyAuthority.applyIssuance({ actor, authority })
      → refuseForbiddenMutator(actor)
      → authorizeIssuance(constitution, book, authority)     [MINT GATE]
          → replay check (usedReplayIds)
          → genesisAllocated += qty | issuedPostGenesis += qty
          → creditCirculating(book, recipient, qty)
      → enforceSupplyInvariants([book])
```

Alternate SunRey entry points (all converge on `authorizeIssuance`):

```
HumanContributionMonetaryBridge.attempt (human-contribution-bridge/gate.ts)
  → validateVerifiedContribution + validateSettlementAuthorization
  → refuseStandaloneAttempt (consent/PEVE/AI/valuation alone)
  → settlement replay book checks
  → developmentSunReyAuthority → authorizeIssuance

IntegratedEconomicStack.issueSunRey (economics/stack.ts)
  → developmentSunReyAuthority → authorizeIssuance

MonetaryPolicySimulator ISSUE_SUNREY event (economics/simulator.ts)
  → developmentSunReyAuthority → authorizeIssuance
```

#### MoonRey issuance (increase total)

```
Entry: runMoonReyIssuancePipeline (issuance-pipelines.ts)
  → refuseForbiddenMutator(actor)
  → evaluateOracleSafety (if observations present)
  → evaluateHumanGovernanceGate
  → developmentMoonReyAuthority(...)
  → ProtocolNativeSupplyAuthority.applyIssuance → authorizeIssuance
```

```
MoonReyProductiveSettlementBridge.attempt (value-settlement/bridge.ts)
  → refuseStandaloneAttempt (oracle/fact/claim/GPUV alone)
  → ProductiveSettlementBook replay checks (REPLAY_REJECTED)
  → createProductiveSettlementAuthorization (GPUV conversion)
  → governedValueMoonReyAuthority → authorizeIssuance

IntegratedEconomicStack.issueMoonReyFromClaim (economics/stack.ts)
  → ProductiveEconomyEngine.verifyClaim + authorizeIssuance (productive eligibility)
  → developmentMoonReyAuthority → authorizeIssuance (canonical)
  → ProductiveEconomyEngine.finalizeIssuance → applyIssuance (SHADOW only, productive/supply.ts)

IntegratedEconomicStack.issueMoonReyFromGovernedValue
  → MoonReyProductiveSettlementBridge.attempt → authorizeIssuance
```

#### Burn (decrease total)

```
ProtocolNativeSupplyAuthority.applyBurn
  → authorizedBurn (economic-controls.ts)
      → refuseForbiddenMutator(actor)
      → MAINNET → BURN_POLICY_UNRESOLVED
      → replay: BURN:{assetId}:{replayIdentifier}
      → burn(book, account, qty, burnClass)
      → enforceSupplyInvariants

IntegratedEconomicStack fee path → burn / burnReservedFee on sunrey book
MonetaryPolicySimulator BURN/FEE events
```

#### Genesis (increase total, GENESIS_ONLY class)

```
authorizeIssuance with issuanceClass: 'GENESIS_ONLY'
  → genesisAllocated += quantity

Gates (no mutation):
  verifyGenesisAllocationManifest (economics/genesis.ts) — audit only
  evaluateGenesisAllocation (economic-controls.ts) — blocks mainnet non-zero
  zeroProductionGenesisManifest (mainnet/allocation.ts) — production = 0
```

### Alternative supply / balance implementations

| Implementation | Path | Canonical? | Mutation API |
|------------------|------|------------|--------------|
| `AssetSupplyBook` | `economics/supply.ts` | **Yes** | `authorizeIssuance`, `burn` |
| `ProtocolNativeSupplyAuthority` | `native-assets/economic-controls.ts` | **Yes** (facade) | `applyIssuance`, `applyBurn` |
| `NativeAssetSupplyState` | `productive/supply.ts` | No (shadow) | `applyIssuance`, `applyBurn` |
| `InMemoryCoinPort` | `sunrey-exchange/src/adapters.ts` | No | `seed()` |
| `InMemoryNativeChain` | `sunrey-exchange/src/native-clearing/chain.ts` | No | `issue()` |
| `SunReyCoinService` | `packages/sunrey-coin/` | No (ledger plane) | Kernel-gated `ISSUE_SUNREY_COIN` |
| `FeeEngine` | `fees/engine.ts` | No | `faucet`, `creditAuthorized` |
| `TestnetFaucet` | `testnet/faucet.ts` | No | `request()` |
| `AssetSupplySlice` | `sunrey-economics/layers.ts` | No (lab mirror) | sync from stack |
| `CanonicalChainSource.setBalance` | `wallet/mobile-sync/chain-source.ts` | No (fixture) | `setBalance()` |
| Rehearsal runtime | `production-handoff/full-platform-candidate/runtime.ts` | No (fixture) | **Direct** `issuedPostGenesis +=`, `creditCirculating` |

### Dangerous mutation surface

**Direct book field mutation bypassing `authorizeIssuance`:**

- `production-handoff/full-platform-candidate/runtime.ts` lines ~400–481
- `release-candidate/economic/production-constitution/rehearsal.ts` (`issueRehearsal`)
- `post-genesis/staged-activation/fixtures.ts`
- `governance-ops/launch-abort/recovery.ts`

These are labeled rehearsal/fixture paths. **Risk:** any production wiring that imports these helpers would bypass the mint gate. No CI gate currently forbids direct `creditCirculating` outside `authorizeIssuance` in non-fixture code.

---

## Task 2 — Forbidden actor verification

| Actor | Classification | Evidence |
|-------|----------------|----------|
| Frontend | **HARD PREVENTED** | `FORBIDDEN_SUPPLY_MUTATORS`; `refuseForbiddenMutator('FRONTEND')`; no supply mutation routes in BFF |
| Consumer BFF | **HARD PREVENTED** | Read-only adapter; `consumer-economy.test.ts` — no mint/burn/issuance routes |
| API route (`/api/v1`) | **HARD PREVENTED** | Consumer economy surface read-only; platform API orchestration only |
| Exchange | **PREVENTED BY CONVENTION** | No import of `authorizeIssuance` in exchange productization; red-team refuses `direct_supply_mutation`; but `InMemoryCoinPort.seed()` mutates local supply |
| Exchange database | **HARD PREVENTED** | `EXCHANGE_DATABASE` in `FORBIDDEN_SUPPLY_MUTATORS`; `exchangeCannotChangeSupply` |
| Wallet service | **PREVENTED BY CONVENTION** | Mobile sync `setBalance` is test fixture; no wallet service mint path to `AssetSupplyBook` |
| Operational PostgreSQL | **PARTIALLY PREVENTED** | `RECOVERY_AUTHORITY.postgresCannotMutateAssetSupplyBook: true` — declarative + test; no runtime interceptor on DB writes |
| HIN engine | **HARD PREVENTED** | `HIN_CONSENT_ALONE_CANNOT_ISSUE`; bridge requires settlement authorization |
| PEVE | **HARD PREVENTED** | `PEVE_SCORE_CANNOT_BECOME_ISSUANCE_QUANTITY` |
| Productive Value Engine | **HARD PREVENTED** | `PRODUCTIVE_VALUE_ALONE_CANNOT_ISSUE`; GPUV bridge chain required |
| GPUV calculation | **HARD PREVENTED** | `GPUV_ALONE_CANNOT_ISSUE`; conversion policy separate from mint |
| AI agent | **HARD PREVENTED** | `AI_MONETARY_AUTHORIZATION_REJECTED`; `AGENT` forbidden mutator; no mint tools in catalog |
| Grow My Money agent | **HARD PREVENTED** | Same as AI agent (`sunrey-agent`); ProposalGate never issues Execution Authority for mint |
| Oracle | **HARD PREVENTED** | `ORACLE` forbidden mutator; `ORACLE_OBSERVATION_CANNOT_MINT` |
| External API | **PREVENTED BY CONVENTION** | No live provider wiring; Chunk 150 injected transports only; `LIVE_*` false |
| Administrator without governance | **PARTIALLY PREVENTED** | No admin mint flag; production gates block; but rehearsal fixtures allow direct mutation without governance object |

---

## Task 3 — SunRey issuance invariants

| Invariant | Holds? | Enforcing code | Test |
|-----------|--------|----------------|------|
| Raw personal data cannot mint | **Yes** | `privacySafeHumanEvidence`, `FORBIDDEN_PERSONAL_KEYS`, pipeline `RAW_USER_DATA` | `economics.test.ts`, `productization.test.ts` |
| Contribution event cannot directly mint | **Yes** | `HumanContributionMonetaryBridge` requires `authorization` | `human-contribution-bridge.test.ts` |
| Unverified contribution cannot mint | **Yes** | `validateVerifiedContribution`, pipeline `UNVERIFIED_CONTRIBUTION` | `productization.test.ts` |
| AI-generated valuation cannot mint | **Yes** | Pipeline `AI_VALUATION_CANNOT_MINT`, bridge `AI_CANNOT_AUTHORIZE_ISSUANCE` | `productization.test.ts`, `human-contribution-bridge.test.ts` |
| PEVE output ≠ coin quantity | **Yes** | `PEVE_SCORE_CANNOT_BECOME_ISSUANCE_QUANTITY` | `human-contribution-bridge.test.ts` |
| Contribution eligibility ≠ issuance | **Yes** | `SETTLEMENT_AUTHORIZATION_REQUIRED` | `human-contribution-settlement.test.ts` |
| Consent distinguishable from valuation | **Yes** | `CONSENT_ALONE_CANNOT_ISSUE`, `VALUATION_RESULT_CANNOT_MINT` | `human-contribution-bridge.test.ts` |
| Purpose authorization distinguishable from monetary authorization | **Yes** | `purposeClass` vs `MonetaryIssuanceAuthority` types | **MISSING TEST** (type-only) |
| Governance required | **Yes** | `evaluateHumanGovernanceGate`, MAINNET blocks | `productization.test.ts` |
| AI cannot self-approve governance | **Yes** | `AI_CANNOT_APPROVE`, `createIssuanceProposal` throw | `productization.test.ts` |
| Replay cannot repeat issuance | **Yes** | `usedReplayIds`, `DUPLICATE_ISSUANCE`, settlement replay keys | `productization.test.ts`, `human-contribution-bridge.test.ts` |
| Issuance reconciles to canonical supply | **Yes** | `supplyReconciles`, `enforceSupplyInvariants` | `economics.test.ts`, `stack.test.ts` |

**Design intent only (no dedicated test):** `PDV_CONSENT_CLEAN_ROOM_CANNOT_MINT` rejection code exists; pipeline checks `pdvOrCleanRoomOnly` flag but not end-to-end PDV integration path.

---

## Task 4 — MoonRey issuance invariants

| Invariant | Holds? | Enforcing code | Test |
|-----------|--------|----------------|------|
| Raw oracle observation cannot mint | **Yes** | `rejectOracleOnlyMint`, `evaluateOracleSafety` | `productization.test.ts`, `economics.test.ts` |
| Single-source observation cannot mint | **Yes** | `SINGLE_ORACLE_CANNOT_MINT` | `productization.test.ts` |
| Configured provider ≠ trusted provider | **Partial** | Certification sandbox (`oracle/production/certification`); no auto-mint on configure | **MISSING TEST** for configure≠trust boundary |
| Verified observation ≠ productive contribution | **Yes** | Productive engine `verifyClaim`; evidence class gate | `moonrey-policy.test.ts` |
| Productive contribution ≠ GPUV | **Yes** | Separate settlement chain stages | `moonrey-value-settlement.test.ts` |
| GPUV ≠ MoonRey quantity | **Yes** | `GPUV_ALONE_CANNOT_ISSUE`; conversion authorization | `moonrey-value-settlement.test.ts` |
| GPUV ≠ Exchange price | **Yes** | `separateValuationFromMarketPrice` | `productization.test.ts` |
| Productive valuation ≠ monetary supply | **Yes** | Bridge → `authorizeIssuance` only after full chain | `moonrey-value-settlement.test.ts` |
| Market price ≠ monetary supply | **Yes** | Exchange isolation | `exchange.test.ts` (trade unchanged supply on CoinPort) |
| Stale/disputed/invalid observations blocked | **Yes** | `evaluateOracleSafety` | `productization.test.ts` |
| AI cannot self-authorize | **Yes** | Same as SunRey AI boundary | `economics.test.ts` |
| Governance required | **Yes** | `evaluateHumanGovernanceGate`; `PRODUCTION_V2_UNAVAILABLE` | `productization.test.ts` |
| Replay/double counting controlled | **Yes** (simulation) | `ProductiveSettlementBook`, `REPLAY_REJECTED` | `moonrey-value-settlement.test.ts` |
| Production issuance disabled | **Yes** | `PRODUCTION_ISSUANCE_UNCONFIGURED`, `productionIssuanceActivated: false` | `production-policy-candidate.test.ts`, `economics.test.ts` |

**Gap:** Productive shadow `NativeAssetSupplyState` can diverge if `finalizeIssuance` called without constitutional issuance — mitigated in `IntegratedEconomicStack` reconciliation but not globally enforced.

---

## Task 5 — Supply invariants

| Invariant | Implementation | Test |
|-----------|----------------|------|
| supply >= 0 | `enforceSupplyInvariants` `NEGATIVE_SUPPLY` | `productization.test.ts` |
| circulating <= total | Conservation identity in `supplyReconciles` | `economics.test.ts` |
| wallet holdings <= issued supply | `WALLET_EXCEEDS_SUPPLY` | **MISSING TEST** (logic exists, no dedicated case) |
| holdings reconcile with supply model | `supplyReconciles` position sums | `economics.test.ts` |
| burned supply cannot reappear | `burned` monotonic increase only | `economics.test.ts` (burn scenario) |
| unauthorized actor cannot alter supply | `refuseForbiddenMutator` | `productization.test.ts` |
| unsigned governance cannot authorize mainnet | `MISSING_GOVERNANCE` | `productization.test.ts` |
| AI cannot impersonate governance | `AI_CANNOT_APPROVE` | `productization.test.ts` |
| duplicate transaction cannot execute twice | Transfer has no replay ID | **NOT PREVENTED** for transfers |
| duplicate issuance cannot execute twice | `usedReplayIds` | `productization.test.ts` |
| environment gates cannot authorize production | Multiple layers (see contract §14) | `production-economic-authorization.test.ts` |

**Additional invariants identified:**

| Invariant | Status | Notes |
|-----------|--------|-------|
| Source/live class double-count forbidden | Enforced | `assertNoDoubleCount` |
| Validator misconduct cannot burn customers | Enforced | `VALIDATOR_MISCONDUCT_CUSTOMER_BURN_FORBIDDEN` |
| Access fabric cannot mint | Enforced | `access-chain-rights.test.ts` static analysis |
| Governance proposals cannot set supply | Enforced | `governance-malicious.test.ts` |
| Custody provider balance ≠ supply book | Enforced | `dual-asset.test.ts` |
| Postgres cannot mutate supply book | Declarative | `recovery.test.ts` — not runtime enforced |

---

## Task 6 — Authority matrix

Legend: **C** = current behavior, **T** = target behavior (Wave 1 contract)

| Actor | Observe | Submit evidence | Verify | Calculate value | Propose issuance | Approve issuance | Execute issuance | Change total supply | Set market price | Alter canonical state |
|-------|---------|-----------------|--------|-----------------|------------------|------------------|------------------|---------------------|------------------|----------------------|
| External Provider | C/T Yes | C/T Yes | C No / T No | C No | C No | C No | C No | C No | C No | C No |
| Oracle | C Yes | C Yes | C Partial | C No | C No | C No | C No | C No | C No | C No |
| HIN | C Yes | C Yes | C Yes | C No | C No | C No | C No | C No | C No | C No |
| PEVE | C Yes | C Yes | C Partial | C Yes (reference) | C No | C No | C No | C No | C No | C No |
| Productive Value Engine | C Yes | C Yes | C Yes | C Yes | C No | C No | C No | C No | C No | C No |
| GPUV | C Yes | C Via PVE | C Via chain | C Yes | C No | C No | C No | C No | C No | C No |
| AI Agent | C Yes (read tools) | C No | C No | C No | C No (human review only) | C No | C No | C No | C No | C No |
| Consumer API | C Yes (read) | C No | C No | C No | C No | C No | C No | C No | C No | C No |
| Exchange | C Yes | C No | C No | C No | C No | C No | C No | C No (sim local only) | C Yes (last trade) | C No |
| Exchange Database | C Yes | C No | C No | C No | C No | C No | C No | C No (sim) | C No | C No |
| Wallet | C Yes | C No | C No | C No | C No | C No | C No | C No | C No | C No |
| PostgreSQL Ledger | C Yes (fiat) | C Via outbox | C No | C No | C No | C No | C No (fiat only via EA) | C No | C No | C No (fiat journals) |
| Evidence Vault | C Yes | C Yes (sealed) | C No | C No | C No | C No | C No | C No | C No | C Append-only |
| Human Governance | C Yes | C Yes | C Yes | C No | C/T Yes | C/T Yes | C No (delegates to protocol) | C No (delegates) | C No | C Parameter only |
| Protocol (`authorizeIssuance`) | C Yes | C Yes | C Yes | C No | C Yes | C Yes (with authority object) | C Yes | C Yes | C No | C Yes (supply book) |
| Validator | C Not impl | C Not impl | C Not impl | C No | C Not impl | C Not impl | C Not impl | T Only via consensus | C No | T Future |
| Frontend | C Yes (read) | C No | C No | C No | C No | C No | C No | C No | C No | C No |

---

## Task 7 — Documents produced

| Document | Path | Purpose |
|----------|------|---------|
| Repository baseline | `docs/architecture/WAVE1_REPOSITORY_BASELINE.md` | Validation reference snapshot |
| Monetary authority contract | `docs/architecture/SUNREY_MONETARY_AUTHORITY_CONTRACT.md` | Permanent architectural specification |
| This audit | `docs/architecture/WAVE1_AUTHORITY_AUDIT.md` | Repository findings and discrepancies |

---

## Task 8 — Invariant-to-test matrix

| Invariant ID | Description | Test file | Status |
|--------------|-------------|-----------|--------|
| INV-SUP-01 | Conservation identity | `economics.test.ts` | Covered |
| INV-SUP-02 | supply >= 0 | `productization.test.ts` | Covered |
| INV-SUP-03 | Wallet <= total supply | — | **MISSING TEST** |
| INV-SUP-04 | Unauthorized actor blocked | `productization.test.ts` | Covered |
| INV-SUP-05 | Duplicate issuance blocked | `productization.test.ts` | Covered |
| INV-SUP-06 | Burn decreases total only | `economics.test.ts` | Covered |
| INV-SUP-07 | Transfer preserves total | `economics.test.ts` | Covered |
| INV-SUN-01 | Raw personal data rejected | `economics.test.ts` | Covered |
| INV-SUN-02 | AI cannot authorize | `economics.test.ts` | Covered |
| INV-SUN-03 | Unverified contribution blocked | `productization.test.ts` | Covered |
| INV-SUN-04 | PEVE ≠ issuance | `human-contribution-bridge.test.ts` | Covered |
| INV-SUN-05 | Consent alone blocked | `human-contribution-bridge.test.ts` | Covered |
| INV-SUN-06 | Settlement required | `human-contribution-settlement.test.ts` | Covered |
| INV-SUN-07 | Replay settlement blocked | `human-contribution-bridge.test.ts` | Covered |
| INV-SUN-08 | Purpose vs monetary auth | — | **MISSING TEST** |
| INV-MOO-01 | Oracle alone blocked | `economics.test.ts` | Covered |
| INV-MOO-02 | Single oracle blocked | `productization.test.ts` | Covered |
| INV-MOO-03 | Stale/disputed blocked | `productization.test.ts` | Covered |
| INV-MOO-04 | GPUV alone blocked | `moonrey-value-settlement.test.ts` | Covered |
| INV-MOO-05 | Productive claim alone blocked | `moonrey-value-settlement.test.ts` | Covered |
| INV-MOO-06 | GPUV ≠ market price | `productization.test.ts` | Covered |
| INV-MOO-07 | Production V2 blocked | `moonrey-value-settlement.test.ts` | Covered |
| INV-MOO-08 | Configure provider ≠ trust | — | **MISSING TEST** |
| INV-ACT-01 | BFF no mint routes | `consumer-economy.test.ts` | Covered |
| INV-ACT-02 | Agent no mint tools | `sunrey-agent/tools.test.ts` | Covered |
| INV-ACT-03 | Exchange red-team | `sunrey-exchange/productization` | Covered |
| INV-ACT-04 | Custody ≠ supply book | `dual-asset.test.ts` | Covered |
| INV-ACT-05 | Postgres authority declarative | `recovery.test.ts` | Covered (declarative) |
| INV-ACT-06 | Access fabric no mint | `access-chain-rights.test.ts` | Covered |
| INV-ACT-07 | Governance no supply param | `governance-malicious.test.ts` | Covered |
| INV-ACT-08 | Production candidate no mutate | `production-policy-candidate.test.ts` | Covered |
| INV-ACT-09 | Rehearsal direct mutation gated | — | **MISSING TEST** (no CI forbids) |
| INV-ACT-10 | Exchange CoinPort ≠ canonical | `exchange.test.ts` | Partial |
| INV-ACT-11 | sunrey-coin ledger ≠ AssetSupplyBook | `sunrey-coin.test.ts` | **MISSING TEST** (parallel path documented only) |
| INV-ENV-01 | Mainnet issuance blocked | `productization.test.ts` | Covered |
| INV-ENV-02 | Genesis zero production | `economics.test.ts` | Covered |
| INV-ENV-03 | Simulation cannot authorize production | `productization.test.ts` | Covered |
| INV-ENV-04 | LIVE flags simulation | deployment posture CI | Covered |

---

## Task 9 — Validation results

Compared against `WAVE1_REPOSITORY_BASELINE.md`:

| Check | Result | Notes |
|-------|--------|-------|
| `npm ci` | **PASS** | 193 packages |
| `npm run integrity:check` | **PASS** | JSON, merge, YAML, catalog validation |
| `npm test economics` | **PASS** | 85 tests, 0 failures |
| Targeted authority unit tests (49 tests) | **PASS** | productization, economics, consumer-economy, dual-asset, recovery |
| Documentation-only changes | **No regression** | No code or test modifications |

---

## Authority conflicts

### Material

1. **Parallel SunRey supply (`packages/sunrey-coin`)** — Kernel-gated ledger issuance for `ISSUE_SUNREY_COIN` is a second SunRey quantity model not reconciled to `AssetSupplyBook` in application code. Documented in productization inventory as intentional partial bridge.

2. **Exchange simulation mint (`InMemoryCoinPort.seed`, `InMemoryNativeChain.issue`)** — Creates spendable native asset balances without `authorizeIssuance`. Red-team and lifecycle tests treat these as simulation-only, but there is no compile-time separation from canonical paths.

3. **Rehearsal direct book mutation** — `production-handoff/full-platform-candidate/runtime.ts` increments `issuedPostGenesis` and calls `creditCirculating` without `authorizeIssuance`. Labeled fixture but exported helpers (`creditCirculating`) increase misuse risk.

4. **Productive shadow supply divergence** — `productive/supply.ts` `NativeAssetSupplyState` can be updated independently; only `IntegratedEconomicStack.reconcile()` checks alignment.

### Informational

5. **Postgres authority is declarative** — `RECOVERY_AUTHORITY` constants and tests assert boundaries; no database-level or middleware enforcement prevents a buggy service from writing supply-like state to Postgres.

6. **Transfer replay** — `transfer()` has no idempotency key; duplicate transfer is application responsibility.

7. **Fee faucet confusion** — `FeeEngine.faucet` credits fee accounts; operators could confuse with protocol issuance.

---

## Invariants: enforced vs design intent

### Technically enforced (code throws/returns refusal)

- All `authorizeIssuance` rejection codes
- `refuseForbiddenMutator` for six forbidden actors
- `supplyReconciles` / `enforceSupplyInvariants`
- Human contribution and MoonRey settlement replay books
- Production issuance firewall (`PRODUCTION_ISSUANCE_UNCONFIGURED`)
- AI/Agent actor kind rejection
- Oracle safety evaluation
- Genesis zero mainnet

### Design intent / comments only

- Exchange "does not mutate canonical supply" — convention + red-team, not type system
- Wallet service boundary — no dedicated wallet mint module, but mobile-sync fixture can `setBalance`
- External API — `LIVE_*` false by policy, not cryptographic isolation
- Administrator — no super-admin mint flag, but rehearsal paths lack governance object
- Configure provider ≠ trusted — certification schema exists; no test proving configure cannot mint

---

## Dangerous mutation surfaces (priority order)

1. `production-handoff/full-platform-candidate/runtime.ts` — direct `issuedPostGenesis` mutation
2. `packages/sunrey-exchange/src/adapters.ts` — `InMemoryCoinPort.seed()`
3. `packages/sunrey-exchange/src/native-clearing/chain.ts` — `issue()`
4. `packages/sunrey-coin/` — ledger `ISSUE_SUNREY_COIN` journal path
5. `packages/sunrey-chain/src/fees/engine.ts` — `faucet()`
6. `packages/sunrey-chain/src/productive/supply.ts` — shadow `applyIssuance`
7. `packages/sunrey-chain/src/wallet/mobile-sync/chain-source.ts` — `setBalance()`

---

## Files created/changed

| File | Action |
|------|--------|
| `docs/architecture/WAVE1_REPOSITORY_BASELINE.md` | Created |
| `docs/architecture/SUNREY_MONETARY_AUTHORITY_CONTRACT.md` | Created |
| `docs/architecture/WAVE1_AUTHORITY_AUDIT.md` | Created |

No source code, tests, or CI configuration modified.

---

## Recommendations (documentation only — not implemented in Wave 1)

1. Add CI architectural rule: forbid `creditCirculating` / `issuedPostGenesis +=` outside `authorizeIssuance` and labeled fixture directories.
2. Add `INV-SUP-03` and `INV-ACT-09` tests.
3. Document explicit reconciliation contract between `sunrey-coin` ledger and `AssetSupplyBook`.
4. Mark Exchange simulation ports with a type brand preventing import from production-handoff paths.
5. Wave 2: consensus-level replay and durable `usedReplayIds`.

**Wave 1 complete. Do not proceed to Wave 2 from this deliverable.**
