# Wave 1 Production Readiness Audit

**Date:** 2026-09-02  
**Scope:** Establish exact boundaries between real implementation, production-capable implementation, development implementation, testnet implementation, simulation, sandbox, fixture, stub, interface, placeholder, deprecated code, duplicate code, and dead code — prior to any sovereign blockchain production upgrade.  
**Status:** Audit complete. **No activation performed.** **No code removed.** **No state migrated.**

## Executive boundary model

SunRey uses a layered authority model. A component may be *implemented* without being *production-capable*, and *production-capable* without being *activated*. Activation is blocked at compile time, runtime assertion, evaluator-only firewalls, and CI architectural guards.

```
┌─────────────────────────────────────────────────────────────────────────┐
│ REAL IMPLEMENTATION          Code that executes deterministically today   │
├─────────────────────────────────────────────────────────────────────────┤
│ PRODUCTION-CAPABLE           Core invariants/durability suitable for    │
│                              production when external gates + LIVE_*    │
│                              flags are satisfied under governed ceremony│
├─────────────────────────────────────────────────────────────────────────┤
│ DEVELOPMENT IMPLEMENTATION   Substantial logic scoped to dev/testnet    │
│                              networks; distinct IDs from production     │
├─────────────────────────────────────────────────────────────────────────┤
│ TESTNET IMPLEMENTATION       Reserved test network (net_sunrey_testnet_1)│
│                              In-process replicas; not mainnet           │
├─────────────────────────────────────────────────────────────────────────┤
│ SIMULATION                   Explicit simulation adapters, ENGINEERING_   │
│                              SIMULATION markers, in-memory defaults     │
├─────────────────────────────────────────────────────────────────────────┤
│ SANDBOX                      Provider-candidate conformance; fixture      │
│                              transports; no live regulated providers    │
├─────────────────────────────────────────────────────────────────────────┤
│ FIXTURE / STUB / PLACEHOLDER Schema, zero-value migration manifests,    │
│                              TEST_NETWORK_PLACEHOLDER, FutureChainAdapter │
├─────────────────────────────────────────────────────────────────────────┤
│ INTERFACE_ONLY               Ports, types, reconciliation contracts     │
├─────────────────────────────────────────────────────────────────────────┤
│ DEPRECATED / DUPLICATE       Superseded paths kept for compatibility;   │
│                              documented dual stores in simulation only  │
└─────────────────────────────────────────────────────────────────────────┘
```

**Companion reference:** `docs/architecture/SUNREY_COMPONENT_STATUS_MATRIX.md`

---

## Task 1 — Repository search findings

### Keyword and behavioral indicators

| Indicator | Prevalence | Behavioral finding |
|-----------|------------|-------------------|
| `simulation` / `SIMULATION` | Widespread | Default `ENVIRONMENT`, chain `INITIAL_CHAIN_NETWORK_MODE`, custody/exchange hard-fail on live |
| `sandbox` | Provider-candidate paths | Fixture transports only; `contactsPublicInternet = false` |
| `mock` / `fake` / `fixture` | Oracle, providers, tests | Injected HTTP; rejected by production activation firewall |
| `demo` | `sunrey-coin/demo.ts`, explorer apps | Non-authoritative demonstration entry points |
| `development` | Native assets, testnet, Rust node | Distinct from production; `developmentNetworkDistinct: true` |
| `testnet` | `packages/sunrey-chain/src/testnet/` | In-memory balances; `TESTNET_PRODUCTION_NETWORK_ENABLED = false` |
| `mainnet` | `src/mainnet/`, release-candidate | Readiness/freeze/ceremony only; `MAINNET_ENABLED = false` |
| `production` | Gates, handoff, activation firewall | Evaluator-only; always returns `productionActivated: false` |
| `productionActive` / `productionActivated` | API, firewalls, invariants | Typed `false` literals; CI-enforced |
| `liveEnabled` / `LIVE_*` | `packages/config/src/flags.ts` | All compile to `false`; `assertSimulationOnly()` |
| `NOT_IMPLEMENTED` | `FutureChainAdapter`, growth taxonomy | Explicit stubs; not silent gaps |
| `ENGINEERING_SIMULATION` | SunRey Coin, economics lab | Asset class and legal state markers |
| `moonreyIssuanceActivated()` | `protocol/assets.ts` | Hardcoded `false`; linter enforced |
| `deprecated` / `legacy` | Identity IDs, external-data catalog | `@deprecated` aliases; Solstice naming residue |
| `TODO` / `FIXME` | Sparse in protected paths | No production bypass via TODO |

### Behavioral inspection (beyond keywords)

1. **Kernel path:** All financial mutation requires `ActionIntent` → `ComplianceKernel.submit` → signed `ExecutionAuthority` → `Ledger.postJournal`. No admin skip path found.
2. **Chain path:** `SunReyChainService` uses `SimulationChainAdapter` + `InMemorySunReyChainStore`; settlement anchors declare `chainBalanceAuthoritative: false`.
3. **Exchange path:** Constructor throws if `LIVE_EXCHANGE_ENABLED` or `LIVE_CRYPTO_ENABLED` are not `false`; default `InMemoryCoinPort` / `InMemoryFiatPort`.
4. **Native issuance path:** `ProtocolNativeSupplyAuthority` blocks `MAINNET` economics; proposals terminate `APPLIED_SIMULATION`.
5. **No `activateProduction()` function** exists in economic activation firewall.

---

## Task 2 — Critical component classification

See `SUNREY_COMPONENT_STATUS_MATRIX.md` for the exhaustive table. Summary by domain:

| Domain | Primary owner | Status | Evidence |
|--------|---------------|--------|----------|
| SunRey native asset (protocol) | `sunrey-chain/src/native-assets/` | IMPLEMENTED_NON_PRODUCTION | `SUNREY_COIN` in registry; mainnet blocked |
| SunRey native asset (application) | `packages/sunrey-coin/` | SIMULATION | `ENGINEERING_SIMULATION`, `liveEnabled: false` |
| MoonRey native asset | `sunrey-chain/src/native-assets/` | IMPLEMENTED_NON_PRODUCTION | `MOONREY_COIN`; `moonreyIssuanceActivated(): false` |
| Native supply authority | `native-assets/economic-controls.ts` | IMPLEMENTED_NON_PRODUCTION | `ProtocolNativeSupplyAuthority`; in-memory books |
| Issuance pipelines | `native-assets/issuance-pipelines.ts` | SIMULATION | `APPLIED_SIMULATION`; oracle cannot mint |
| Burn pipeline | `economic-controls.ts`, `supply.ts` | IMPLEMENTED_NON_PRODUCTION | Mainnet burn blocked `BURN_POLICY_UNRESOLVED` |
| Transfer pipeline | `supply.ts`, protocol execution | IMPLEMENTED_NON_PRODUCTION | Conservation invariants; replay `Set` |
| Wallets | `sunrey-chain/src/wallet/`, `custody/` | SIMULATION | `DevelopmentKeystore`; `providerBalanceIsTruth: false` |
| Ledger | `packages/ledger/` | PRODUCTION_CAPABLE | `postJournal` only write path; EA required |
| Exchange | `packages/sunrey-exchange/` | SIMULATION | In-memory store + port doubles |
| Blockchain runtime (TS) | `sunrey-chain/src/service.ts` | SIMULATION | `SimulationChainAdapter` |
| Blockchain runtime (Rust) | `sunrey-chain/rust/crates/` | PARTIAL | Consensus/storage mature; node/RPC simulation |
| Block storage | `rust/crates/storage` | PRODUCTION_CAPABLE | redb ACID; `PRODUCTION_ENGINE_NAME = "redb"` |
| State persistence | `packages/persistence/` | PRODUCTION_CAPABLE | PG adapters; chain snapshots `network_mode='SIMULATION'` |
| Validators | `rust/crates/validators`, `validator-operator/` | IMPLEMENTED_NON_PRODUCTION | Dev sets; economics rehearsal |
| Consensus | `rust/crates/consensus` | IMPLEMENTED_NON_PRODUCTION | BFT engine; WAL; not wired to live mesh |
| Finality | `assurance/consensus.ts`, Rust consensus | PARTIAL | TS test double; Rust engine substantive |
| Genesis | `testnet/genesis.ts`, `mainnet/`, `genesis-execution/` | SANDBOX / REHEARSAL | `MAINNET_GENESIS_BLOCKED` |
| Networking / P2P | — | STUB | P2P keys in validator records; no live gossip mesh |
| HIN | `packages/information-market/` | SIMULATION | `productionActivated: false` on policy |
| Human contribution | `packages/human-economic-contribution/` | SIMULATION | In-memory snapshot store |
| PEVE / PEG | `platform/src/value`, `personal-economic-graph/` | IMPLEMENTED_NON_PRODUCTION | Non-authoritative; optional PG |
| Productive observations | `sunrey-chain/src/productive/` | SIMULATION | `ProductiveEngine` Maps |
| GPUV | `productive/policy-governance/value-function/` | IMPLEMENTED_NON_PRODUCTION | `PRODUCTIVE_VALUE_ENGINE_PRODUCTION_ACTIVATED = false` |
| Oracle layer | `sunrey-chain/src/oracle/` | SIMULATION + SANDBOX | `FakeExternalHttpTransport`; readiness `NOT_PROVIDED` |
| Provider integrations | `provider-sdk`, `*/production-candidate/` | SANDBOX | Fixture-only; activation policy blocks production in simulation |
| Evidence Vault | `packages/evidence/` | PRODUCTION_CAPABLE | Hash chain; PG adapter available |
| Governance | `governance-ops/`, staged-activation, launch-abort | REHEARSAL | All `productionActive: false` |
| Identity | `packages/identity/` | IMPLEMENTED_NON_PRODUCTION | Core complete; `LIVE_EXTERNAL_KYC = false` |
| Consent | `packages/consent/` | IMPLEMENTED_NON_PRODUCTION | Firewall + PG adapter |
| Rights | `information-market/rights-marketplace/` | SIMULATION | Sandbox marketplace |
| API / BFF | `services/api/` | IMPLEMENTED_NON_PRODUCTION | `PRODUCTION_ACTIVE = false`; orchestration only |
| Block explorer | `packages/sunrey-explorer/` | SIMULATION | `ACTIVE_NETWORK_CLASS = 'DEVELOPMENT'` |
| Blockchain intelligence | `chain-intelligence/`, `blockchain-intelligence/` | SANDBOX | Fixture adapters; read-only external chains |

---

## Task 3 — Duplicate authority investigation

### 3.1 `packages/sunrey-coin/` vs `packages/sunrey-chain/src/native-assets/`

| Aspect | `sunrey-coin` | `native-assets` |
|--------|---------------|-----------------|
| Authority label | `CURRENT_APPLICATION_AUTHORITY` | `NATIVE_BLOCKCHAIN_AUTHORITY` |
| Asset ID | `asset:sunrey-coin` | `SUNREY_COIN` |
| Persistence | In-memory store + ledger journals | In-memory `AssetSupplyBook` |
| Supply imported | N/A | `applicationSupplyImported: false` |
| Classification | **A** legitimate separate concern + **C** simulation | **A** canonical protocol-native path (not activated) |

**Verdict:** Not a dangerous duplicate if boundaries are respected. **Risk F** if integrators treat application ledger balances as chain-native supply without migration ceremony.

### 3.2 Legacy Solstice economic modules vs current SunRey modules

| Legacy artifact | Current owner | Classification |
|-----------------|---------------|----------------|
| `@solstice/*` npm scope | All packages | **D** migration compatibility (workspace naming) |
| `le_solstice_*` legal entities | Fixtures in coin, exchange, treasury | **C** simulation fixtures |
| `LEGACY_MASTER_BRAND_ACTIVE` | `false` in `product-identity.ts` | **D** compatibility |
| `packages/moonrey-coin` | **Absent** (forbidden by CI) | **E** obsolete — superseded by `native-assets` |

### 3.3 Application-level supply vs protocol-native supply

Explicit boundary in `native-assets/authority.ts`:

```typescript
applicationSupplyImported: false,
productionMigrationPerformed: false,
developmentNetworkDistinct: true,
```

**Verdict:** **A** legitimate separate concern. Migration manifest exists as **fixture only** (`developmentMigrationFixture()` with zero supply).

### 3.4 Database balances vs ledger-derived vs chain balances

| Store | Authority | Classification |
|-------|-----------|----------------|
| `Ledger.postJournal` | Canonical fiat | **A** authoritative |
| `projectPostedBalance` | Derived from ledger | **A** projection |
| `AssetSupplyBook.positions` | Native protocol supply | **A** authoritative for chain natives |
| `InMemoryFiatPort` / `InMemoryCoinPort` | Exchange simulation | **C** simulation |
| `TestnetNetwork.balances` | Test fixture | **C** simulation |
| Custody `providerBalanceIsTruth: false` | Read model | **C** simulation |

**Verdict:** Documented separation. **Risk F** if exchange/custody in-memory balances are mistaken for canonical holdings in production wiring.

### 3.5 Exchange balances vs wallet balances vs canonical asset holdings

Four-plane model in `custody/src/provider-candidate/authority.ts`:

- `SUNREY_CHAIN_PROTOCOL_STATE`
- `CUSTODY_PROVIDER_REPORTED_STATE`
- `EXCHANGE_INTERNAL_POSITION`
- `CUSTOMER_PRODUCT_READ_MODEL`

`autoCorrectedLedger: false`, `autoMinted: false`.

**Verdict:** **A** legitimate separate concerns with **B** adapter reconciliation contract.

### 3.6 Old token identifiers vs `SUNREY_COIN` / `MOONREY_COIN`

| Identifier | Status |
|------------|--------|
| `asset:sunrey-coin` | Application simulation asset |
| `SUNREY_COIN` / `MOONREY_COIN` | Protocol native IDs |
| Invented tickers (`SUNREY`, `SRN`, etc.) | Forbidden by taxonomy |
| `NATIVE_ASSET_TICKER_STATUS` | `NOT_ASSIGNED` |

**Verdict:** **D** migration compatibility layer for application asset; **F** if tickers assigned without ADR.

---

## Task 4 — In-memory state inventory

Objects with production-significant semantics currently held only in process memory unless explicitly wired to PostgreSQL:

| Domain | Store / location | Structures | Lost on restart? |
|--------|------------------|------------|------------------|
| SunRey Coin supply metadata | `sunrey-coin/src/store.ts` | 8 Maps, 1 Set, array | **Yes** (ledger journals may persist separately) |
| Native asset supply books | `economics/supply.ts` | `AssetSupplyBook` Maps/Sets per asset | **Yes** |
| Chain write intents/ops | `sunrey-chain/src/store.ts` | intents, operations, receipts Maps | **Yes** (PG adapter exists for snapshots) |
| Protocol rights/capacity | `protocol/state.ts` | actors, rights, capacities Maps | **Yes** |
| Testnet balances | `testnet/network.ts` | `balances` Map | **Yes** |
| Exchange state | `sunrey-exchange/src/store.ts` | 20+ Maps (orders, holds, trades) | **Yes** |
| Exchange port doubles | `sunrey-exchange/adapters.ts` | positions, holds, fiat books | **Yes** |
| Custody operations | `custody/src/store.ts` | deposits, withdrawals Maps | **Yes** |
| Oracle observations | `oracle/engine.ts` | providers, facts, observations Maps | **Yes** |
| Productive economy | `productive/engine.ts` | objects, claims, contributions Maps | **Yes** |
| HIN network | `information-market/network/store.ts` | 15+ Maps | **Yes** |
| Human contributions | `human-economic-contribution/store.ts` | single snapshot | **Yes** |
| Kernel compliance | `kernel/compliance/store.ts` | screenings, velocity Maps | **Yes** |
| Evidence (default) | `evidence/vault.ts` | `records[]` | **Yes** unless PG wired |
| Ledger (default) | `ledger/journal.ts` | `journals[]` | **Yes** unless PG wired |
| Governance ops | `governance-ops/` engines | case/timeline Maps | **Yes** |
| Provider runtime health | `provider-runtime/universal/store.ts` | registrations, health Maps | **Yes** |
| Access solvency | `access-economy/` | funding/entitlement Maps | **Yes** |
| PEG (default) | `personal-economic-graph/store.ts` | graphs, nodes Maps | **Yes** (PG optional) |
| PEVE (default) | `platform/src/value/store.ts` | in-memory | **Yes** (PG optional) |
| Explorer index | `sunrey-explorer/store.ts` | 19 Maps | **Yes** |
| Rust chain view | `rust/crates/state` | `ObjectStore` BTreeMap | **Yes** unless redb snapshot |

**PostgreSQL persistence available for:** ledger journals, evidence records, consent, PEVE, PEG, sunrey-chain write intents/operations (with `network_mode='SIMULATION'` constraint in adapter).

---

## Task 5 — Production activation gates inventory

### 5.1 Global compile-time flags (`packages/config/src/flags.ts`)

| Gate | File | Current value | Protection | If incorrectly changed | Prerequisites |
|------|------|---------------|------------|------------------------|---------------|
| `ENVIRONMENT` | `flags.ts:8` | `'simulation'` | Blocks real-world deployment posture | CI fails; regulated paths may activate | ADR-governed ceremony |
| `SIMULATION_MODE` | `flags.ts:9` | `true` | Deployment posture CI | Same | — |
| `LIVE_MONEY_ENABLED` | `flags.ts:11` | `false` | Real money movement | Kernel/accounts could attempt live journals | Banking permissions, HSM, counsel |
| `LIVE_PAYMENTS_ENABLED` | `flags.ts:12` | `false` | Payment rails | Live rail adapters | Provider contracts, corridor counsel |
| `LIVE_BANKING_RAILS` | `flags.ts:13` | `false` | Banking connectivity | — | `reg.banking-payment-permission` |
| `LIVE_EXTERNAL_KYC` | `flags.ts:14` | `false` | Live identity verification | KYC vendor calls | `prv.identity-kyc.*` |
| `LIVE_EXTERNAL_BANK_CONNECTION` | `flags.ts:15` | `false` | Bank linking | — | Provider agreement |
| `LIVE_TRADING_ENABLED` | `flags.ts:19` | `false` | Securities trading | — | Broker-dealer permission |
| `LIVE_CRYPTO_ENABLED` | `flags.ts:20` | `false` | Crypto operations | Exchange/custody live paths | Custody + exchange gates |
| `LIVE_EXCHANGE_ENABLED` | `flags.ts:21` | `false` | Exchange matching live | `SunReyExchangeService` throws | Market permissions |
| `LIVE_DATA_MARKET_ENABLED` | `flags.ts:22` | `false` | Data marketplace | — | HIN legal gates |
| `LIVE_INVESTMENT_EXECUTION` | `flags.ts:23` | `false` | Investment orders | — | Investment permission |
| `LIVE_INFORMATION_RIGHTS_MARKETPLACE` | `flags.ts:25` | `false` | HIN marketplace economics | Phase H surfaces | Consent language approval |
| `LIVE_DATA_MONETIZATION_ENABLED` | `flags.ts:26` | `false` | Data monetization | — | Legal review |
| `LIVE_HIN_BASED_ISSUANCE_ENABLED` | `flags.ts:27` | `false` | HIN→issuance bridge | SunRey issuance from HIN | Human governance evidence |
| `LIVE_MOONREY_PRODUCTIVE_ISSUANCE_ENABLED` | `flags.ts:28` | `false` | MoonRey productive mint | Productive pipeline | GPUV policy authorization |
| `LIVE_INTEROP_*` (3) | `flags.ts:31-33` | `false` | Bridge/relayer/watcher | `assertInteropDevelopmentOnly` | Interop ADR gates |
| `LIVE_EXTERNAL_CHAIN_INTERACTION_ENABLED` | `flags.ts:34` | `false` | External chain writes | — | Security review |
| `LIVE_CUSTODY_ENABLED` | `flags.ts:37` | `false` | Institutional custody | — | `prv.custody.*` |
| `LIVE_AGENT_FINANCIAL_EXECUTION_ENABLED` | `flags.ts:40` | `false` | Agent execution | ProposalGate bypass risk | Mandate + human approval |
| `LIVE_CONNECTIVITY_ENABLED` | `flags.ts:43` | `false` | External connectivity | Provider HTTP | Network egress policy |
| `PRODUCTION_HSM_KMS_CONFIGURED` | `flags.ts:46` | `false` | Real signing keys | Software keys only | HSM provisioning |

**Callers:** `assertSimulationOnly()` in kernel, range production-safety, treasury; `assertRegulatedFeaturesFailClosed()` in activation-gates; CI `scripts/check-deployment-posture.py`.

### 5.2 Chain / economic gates

| Gate | File | Value | Protection |
|------|------|-------|------------|
| `moonreyIssuanceActivated()` | `protocol/assets.ts:52` | `false` | MoonRey mint |
| `applicationSupplyImported` | `native-assets/authority.ts` | `false` | Supply collision |
| `productionMigrationPerformed` | `migration.ts` | `false` | Silent migration |
| `MAINNET_ECONOMICS_NOT_AUTHORIZED` | `economic-controls.ts` | enforced on MAINNET | Mainnet issuance |
| `MAINNET_GENESIS_BLOCKED` | `economic-controls.ts` | enforced | Genesis allocation |
| `FORBIDDEN_SUPPLY_MUTATORS` | `economic-controls.ts` | EXCHANGE_DATABASE, AGENT, AI, ORACLE, etc. | Unauthorized mint |
| `productionActivated` (firewall) | `production-activation/firewall.ts:93` | `false` | Economic activation |
| `AUTHORIZATION_PRODUCTION_ACTIVATED` | `authorization/types.ts` | `false` | Parameter authorization |
| `PRODUCTION_ACTIVE` (staged activation) | `post-genesis/staged-activation/types.ts` | `false` | Domain canary |
| `TESTNET_PRODUCTION_NETWORK_ENABLED` | `testnet/identity.ts` | `false` | Testnet≠production |
| `production_network_enabled()` | Rust `protocol` | `false` | Rust mainnet |
| `INITIAL_CHAIN_NETWORK_MODE` | `taxonomy.ts` | `'SIMULATION'` | TS chain service |
| HIN `productionActivated` | `information-market/network/policy.ts` | `false` | HIN production |
| GPUV `PRODUCTIVE_VALUE_ENGINE_PRODUCTION_ACTIVATED` | `value-function/constitution.ts` | `false` | GPUV→settlement |
| Provider `production_enabled` | `provider-sdk/activation-policy.ts` | blocked in simulation | Live providers |

### 5.3 API / service gates

| Gate | File | Value |
|------|------|-------|
| `PRODUCTION_READY` | `services/api/src/config.ts` | `false` |
| `PRODUCTION_ACTIVE` | `services/api/src/config.ts` | `false` |
| `production_authorized` | `services/api/src/config.ts` | `false` |
| Readiness `productionActive` | `services/api/src/readiness.ts` | `false` |
| Production gate snapshot | `production-handoff/production-gates/evaluate.ts` | `productionActive: false` |

---

## Task 6 — Migration risk analysis

| Question | Answer | Evidence |
|----------|--------|----------|
| **APPLICATION SUPPLY HAS BEEN IMPORTED** | **NO** | `applicationSupplyImported: false` in `authority.ts` |
| **PRODUCTION MIGRATION HAS BEEN PERFORMED** | **NO** | `productionMigrationPerformed: false` in `migration.ts`; `assertMigrationNotExecuted()` |
| **SIMULATED ASSETS COULD COLLIDE WITH PRODUCTION ASSETS** | **YES, if gates fail** — mitigated today | Distinct authority labels; `NOT_ASSIGNED` tickers; separate network IDs; firewall rejects fixture evidence; no import path wired |
| **SANDBOX DATA COULD ENTER PRODUCTION** | **Blocked by design** — residual risk if gates bypassed | `isFixtureEvidence()` in firewall; `developmentFixturesAreProductionFeeds: false`; CI linters |

### Collision vectors (theoretical)

1. **Identifier reuse:** Application `asset:sunrey-coin` vs protocol `SUNREY_COIN` — different namespaces; collision requires explicit migration manifest + ADR.
2. **Ledger journals in simulation:** Persisted journals reflect simulation legal entities (`le_solstice_*`); must not be replayed as mainnet genesis state without human ceremony.
3. **Exchange in-memory positions:** Not authoritative; no migration hook to chain state.
4. **Testnet `balances` Map:** Isolated to testnet module; forbidden ID overlap with production candidate IDs.

---

## Task 7 — Deprecation recommendations (no removals)

| Area | Recommendation | Rationale |
|------|----------------|-----------|
| `packages/sunrey-coin` | **KEEP AS ENGINEERING SIMULATION**; formalize as `CURRENT_APPLICATION_AUTHORITY` only | Ledger-backed simulation laboratory; not protocol-native owner |
| `packages/sunrey-chain/src/native-assets/` | **KEEP** as canonical protocol-native path | ADR-0026 owner; supersedes `packages/moonrey-coin` |
| `packages/moonrey-coin` | **DEPRECATE LATER** (already forbidden) | CI prevents creation |
| Solstice legal entity fixtures | **KEEP AS ADAPTER** / isolate in simulation catalog | Required for regression tests |
| `@solstice/*` npm scope | **RENAME LATER** (low priority) | Cosmetic; `LEGACY_MASTER_BRAND_ACTIVE = false` |
| `FutureChainAdapter` in sunrey-coin | **KEEP** until native migration ADR | Explicit `NOT_IMPLEMENTED` stub |
| Exchange `InMemoryCoinPort`/`InMemoryFiatPort` | **KEEP AS ADAPTER**; replace with ledger-bridging adapters for production | Documented simulation doubles |
| TS `SunReyChainService` simulation layer | **KEEP** for orchestration; **ISOLATE** from Rust production node path | Dual runtime intentional |
| `chain-intelligence` vs `blockchain-intelligence` | **KEEP** both; document integrator guidance | Different wave surfaces |
| `apps/explorer` vs `packages/sunrey-explorer` | **KEEP** both; fix authority map drift | UI client vs indexer |
| Authority map explorer entry | **RENAME** owner to `packages/sunrey-explorer` | Documentation correction |
| Testnet in-memory balances | **ISOLATE**; never wire to mainnet supply | Fixture-only |
| Old external-data deprecated providers | **DEPRECATE LATER** per catalog | Already marked DEPRECATED |

---

## Task 8 — Documents created

1. `docs/architecture/WAVE1_PRODUCTION_READINESS_AUDIT.md` (this file)
2. `docs/architecture/SUNREY_COMPONENT_STATUS_MATRIX.md`

---

## Task 9 — Safety check

This audit prompt did **NOT**:

- [x] Activate mainnet
- [x] Activate MoonRey issuance (`moonreyIssuanceActivated()` remains `false`)
- [x] Authorize production economics (firewall unchanged)
- [x] Import simulation supply (`applicationSupplyImported: false`)
- [x] Alter supply or balances
- [x] Change governance requirements
- [x] Weaken an invariant

### Validation results (2026-09-02)

| Check | Result | Notes |
|-------|--------|-------|
| `npm run integrity:check` | **PASS** | Provider catalog population incomplete (informational); validation PASS |
| `npm test` | **PASS** | 5384 passed, 0 failed, 1 skipped |
| `npm run typecheck` | **Pre-existing errors** | Errors in wave-5/6/7 test files; unchanged by this audit (documentation only) |
| Git diff | **Docs only** | No source, flag, or state changes |

**Baseline comparison:** Integrity baseline (`docs/architecture/integrity-baseline.json`) unchanged. Test count and pass rate consistent with repository health. No Wave 1 prior audit document existed; this establishes the baseline for subsequent waves.

---

## Summary statistics

| Metric | Count |
|--------|-------|
| Production-capable components | **12** |
| Simulation / sandbox components | **47** |
| Partial / interface-only / stub / not-implemented | **31** |
| Important in-memory state stores | **22** |
| Duplicate authority risks (F-class) | **4** |
| Legacy / deprecation candidates | **11** |
| Production activation gates (enumerated) | **45+** |

See `SUNREY_COMPONENT_STATUS_MATRIX.md` for per-component detail and recommended future actions.

**Wave 2 is not started.**
