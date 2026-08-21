# SunRey canonical implementation inventory

Phase A Prompt 2 — repository-wide technical audit.

**Source commit:** `7a2ead2d03461381e117007595f0fee0d1390252` (`main` at audit start).
Prompt 1 stabilization record now also lives at
[`PHASE_A_01_REPOSITORY_STABILIZATION.md`](./PHASE_A_01_REPOSITORY_STABILIZATION.md)
(merged from `main` after this audit started). That document repairs merge
debris. This document remains the canonical implementation map.
**Machine copy:** [`sunrey-canonical-implementation-inventory.json`](./sunrey-canonical-implementation-inventory.json).
**Backlog:** [`SUNREY_PRODUCTIZATION_BACKLOG.md`](./SUNREY_PRODUCTIZATION_BACKLOG.md).
**Architecture constitution:** [`docs/architecture/constitution.md`](../architecture/constitution.md).
**Capability owners:** [`docs/architecture/manifest.json`](../architecture/manifest.json).

This document records what the tree **actually implements**. It does not invent architecture, activate production, or connect real financial providers.

`ENVIRONMENT` remains `simulation`. Every `LIVE_*` flag remains `false`.

---

## 1. Executive summary

SunRey already has a coherent **authorization spine**: Money → ActionIntent → Compliance Kernel → signed Execution Authority → `Ledger.postJournal` / `openAccount` → Evidence Vault → domain events. That spine is real, tested, and Kernel-gated. It is the only path that may change canonical financial state.

Around that spine the repository is a large **simulation product**: 40 packages, 8 services, one explorer app, one architecture linter, four PostgreSQL bounded databases plus an unwired explorer schema, a Rust chain node, and three distinct HTTP surfaces.

The architecture is **disciplined, not fully productized**.

What is true:

- Protected components have declared single owners. There is one `ExecutionAuthority` type and one `AuthorityIssuer.issue` production caller (`packages/kernel`).
- AI, explorer UI, market-data, and fixture providers cannot obtain Execution Authority or post arbitrary ledger journals.
- Most “duplicates” are intentional simulation doubles, read projections, or domain-specialized policy layers.

What is not true:

- The public `/v1` SDK gateway is **not** the Kernel-gated accounts runtime. It mutates an in-memory `DevelopmentPlatform`.
- Exchange settlement Kernel-authorizes, then moves funds through `InMemoryCoinPort` / `InMemoryFiatPort` (synthetic `journalId`s). It does not call `Ledger.postJournal`.
- Agent `requestExecution` may submit to Kernel via ProposalGate, then writes a synthetic receipt. It does not verify Execution Authority or call a financial service.
- Default demo/CI banking path is in-memory unless `createPostgresSimulationRuntime` is selected.
- Every regulated external adapter (bank, card, FX, KYC/AML, Travel Rule, HSM, oracle HTTP, market data, S3M) is a simulator or fixture. The only `fetch` transport (`NodeExternalHttpTransport`) fails closed in FIXTURE/SANDBOX.

**Productization readiness:** the authorization spine, identity library, ledger, evidence, events, and PostgreSQL adapter are suitable as the Phase B foundation. The public API, Exchange settlement, agent execution, custody journals, and all live providers are **not** production-capable.

---

## 2. Repository map

| Area | What exists | Role |
| --- | --- | --- |
| `packages/` | 40 npm workspaces (`@solstice/*`) | Canonical libraries and simulation engines |
| `services/` | 8 workspaces | Application facades. Only `services/accounts` orchestrates. Others re-export packages |
| `apps/explorer` | Static SPA | Non-authoritative explorer UI |
| `api/` | 3 OpenAPI files + events/webhooks/vectors | Public v1 contracts. Not a running gateway |
| `db/` | 5 migration trees | `customer`, `ledger`, `evidence`, `security` are migrated. `explorer` is unwired |
| `infra/postgres` | Docker Compose + init SQL | Local/simulated PostgreSQL 16 |
| `infra/sunrey-production` | OpenTofu/Helm | Rehearsal plans only; `production_authorized` stays false |
| `deploy/sunrey-testnet` | Docker/k8s/Helm | Testnet deploy artifacts |
| `docs/` | Architecture, runbooks, chunk docs | Constitution + historical build status |
| `scripts/` | CI gates | Integrity, kernel gating, posture, secret scan |
| `tests/` | Chunk exit criteria + persistence integration | Not a second implementation |
| `tools/architectural-linter` | Constitution/manifest enforcement | Canonical linter |
| `.github/workflows/` | `ci.yml` plus rehearsal/audit/fuzz jobs | Seven-stage CI plus specialized jobs |
| `packages/sunrey-chain/node` + `rust/` | Rust BFT node, storage, RPC | Chain consensus/storage; not the application ledger |

Historical GitHub path remains `reyesnick54/solstice`. Public product name is SunRey. npm scope remains `@solstice/*`.

---

## 3. Canonical domain authority table

| Domain | Canonical path | Secondary / legacy | Status | Integration dependencies |
| --- | --- | --- | --- | --- |
| MONEY | `packages/money/src/money.ts` | None | IMPLEMENTED (pure lib) | Used by ledger, payments, coin, exchange |
| CURRENCIES | `packages/domain/src/currency.ts` | None | IMPLEMENTED | Domain types only |
| ACCOUNTING / JOURNALS | `packages/ledger/src/journal.ts` | Exchange/custody in-memory books | IMPLEMENTED | Requires verified Execution Authority |
| LEDGER BALANCES | `services/accounts/src/balances.ts` (credits − debits) | Exchange ports, custody maps, PEG snapshots, investment lots | IMPLEMENTED projection | Must not store `Account.balance` |
| HOLDS | `services/accounts/src/hold-store.ts` | Exchange/custody hold maps | IMPLEMENTED, **ephemeral** | No PostgreSQL adapter |
| SETTLEMENT ENTRIES | `Ledger.postJournal` | Exchange `settleTrade` via Coin/Fiat ports; native DVP unwired | PARTIAL | Exchange not ledger-backed |
| IDENTITY | `packages/identity` | `services/identity` facade | IMPLEMENTED simulation | No live KYC vendor |
| AUTHENTICATION | `packages/identity` (passkey / session / `ActorContext`) | None | IMPLEMENTED simulation | WebAuthn RPID still `simulation.solstice.local` |
| AUTHORIZATION | `packages/permissions` (`ActionIntent`, capabilities mapping) | Identity capabilities, agent mandates, chain product capabilities | IMPLEMENTED layered | Only EA mutates financial state |
| KERNEL | `packages/kernel/src/kernel.ts` | Regulatory Twin (counterfactual) | IMPLEMENTED | Seals evidence; issues EA on ALLOW |
| EXECUTION AUTHORITY | `packages/permissions/src/execution-authority.ts` | None (single issuer) | IMPLEMENTED | Kernel is the only production `issue` caller |
| COMPLIANCE | `packages/kernel/src/compliance/fabric.ts` | `services/compliance` facade; market-surveillance case proposals | IMPLEMENTED simulation | Fixture AML/KYC only |
| EVIDENCE | `packages/evidence/src/vault.ts` | Consent ledger; HIN grant store | IMPLEMENTED | Hash chain; PG when sink attached |
| EVENTS | `packages/events` | SDK `/v1/events` fixture stream | IMPLEMENTED | Outbox/inbox/replay; PG when wired |
| PERSISTENCE | `packages/persistence` | In-memory stores (default tests/demo) | IMPLEMENTED adapter | 4 DBs; explorer schema unused |
| ACCOUNTS | `services/accounts` + `packages/domain` | SDK `/v1/accounts` (chain account, not bank account) | IMPLEMENTED library | No HTTP banking API |
| PAYMENTS | `packages/payments` | Production-candidate fixture rails | IMPLEMENTED_SIMULATION_ONLY | Sandbox rails only |
| CARDS | `packages/cards` | `services/cards` facade | IMPLEMENTED_SIMULATION_ONLY | Simulated processor |
| FX | `packages/payments/src/fx-quote.ts` | `SimulationFxProvider` | IMPLEMENTED_SIMULATION_ONLY | No live FX source |
| TREASURY | `packages/treasury` | Protocol treasury under `sunrey-chain/src/economics/treasury` | IMPLEMENTED (app) + chain lab | Customer balances stay on banking ledger |
| INVESTMENTS | `packages/investments` | Paper broker; `SimulatedMarketDataProvider` | IMPLEMENTED_SIMULATION_ONLY | `LIVE_INVESTMENT_EXECUTION` false |
| PERSONAL ECONOMIC GRAPH | `packages/personal-economic-graph` | `services/economic-graph` facade | IMPLEMENTED non-authoritative | Ledger wins on balances |
| GROWTH ORCHESTRATOR | `packages/platform` | Demo/tests only | IMPLEMENTED, **under-integrated** | No service facade; does not issue EA |
| AI RUNTIME | `packages/ai-runtime` | Grok reserved (`GROK_NOT_IMPLEMENTED`) | IMPLEMENTED inference-only | S3M simulator; cannot execute |
| SUNREY AGENT | `packages/sunrey-agent` (ProposalGate) | `packages/agent` (Personal Economy Agent) | IMPLEMENTED isolation | Execution path disconnected from ledger |
| SUNREY CHAIN | `packages/sunrey-chain` | SDK `DevelopmentPlatform`; explorer projection | IMPLEMENTED simulation | Production inactive |
| CONSENSUS | `packages/sunrey-chain/node` + `rust/crates/consensus` | TS wallet local `height++` | IMPLEMENTED Rust; TS sim disconnected | Not application ledger |
| WALLETS | `packages/sunrey-chain/src/wallet` | Cards wallet (Kernel-gated card/tap) | IMPLEMENTED simulation | Separate from EA keys |
| SUNREY COIN | App ledger: `packages/sunrey-coin`. Protocol supply: `packages/sunrey-chain/src/economics/supply.ts` | Exchange `InMemoryCoinPort` | TWO INTENTIONAL LAYERS, **unbridged** | `chainAdapter.implemented = false` |
| MOONREY COIN | `packages/sunrey-chain` productive / monetary constitution | Do not create `packages/moonrey-coin` | IMPLEMENTED schema / sim | Production valuation inactive |
| ISSUANCE | Chunk 71 `packages/sunrey-chain/src/economics` | App coin issuance via Kernel+Ledger; production-candidate packages | IMPLEMENTED, production inactive | Firewall blocks activation |
| ORACLES | `packages/sunrey-chain/src/oracle` | Fixture families; `NodeExternalHttpTransport` gated | IMPLEMENTED_SIMULATION_ONLY | Production inactive |
| SUNREY EXCHANGE | `packages/sunrey-exchange` | SDK gateway mock; V025 SQL unused | IMPLEMENTED_SIMULATION_ONLY | Settlement not ledger-backed |
| MATCHING | `packages/sunrey-exchange/src/matching.ts` | None | IMPLEMENTED in-process | Deterministic; no live liquidity |
| MARKET DATA | `packages/sunrey-exchange/src/ops/market-data.ts` | `SimulatedMarketDataProvider` (investments) | IMPLEMENTED read projection | Cannot obtain EA |
| SETTLEMENT | Canonical: `Ledger.postJournal`. Exchange: port transfers. Native DVP: unwired | `UnwiredNativeAssetSettlementAdapter` | PARTIAL | Native adapter returns `ADAPTER_UNWIRED` |
| CUSTODY | `packages/custody` | In-memory asset port | IMPLEMENTED_SIMULATION_ONLY | Kernel-gated; **no `postJournal`** |
| HIN / INFORMATION RIGHTS | `packages/information-market` | HIN-local consent grants | IMPLEMENTED simulation | Separate from `packages/consent` |
| PERSONAL DATA | `packages/personal-data-vault` + `packages/consent` + `packages/clean-room` | HIN grants | IMPLEMENTED simulation | Some consent ports still `NOT_IMPLEMENTED` |
| OPERATIONS | `packages/sunrey-chain/src/ops` + control-room | GitHub workflows / runbooks | IMPLEMENTED rehearsal | Not live ops |
| DEPLOYMENT | `deploy/sunrey-testnet`, `infra/sunrey-production` | Kind/Helm/OpenTofu | IMPLEMENTED rehearsal | `mainnetEnabled=false` |

---

## 4. Package / service inventory

Status key: **canonical** = declared owner; **facade** = re-export; **simulation-lab** = analysis only; **projection** = rebuildable read model.

### 4.1 Packages (40)

| Package | Purpose | Lang | Status | Persistence | Public API | Events | Simulation | Production-capable | Gaps |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `money` | bigint minor-unit money / asset quantity | TS | canonical | none | no | no | n/a | yes (lib) | — |
| `config` | `ENVIRONMENT`, `LIVE_*`, clock, product identity | TS | canonical | none | demo | no | enforced | yes (lib) | Domain clock layering exception |
| `domain` | Customer, Account (no balance), products, Result | TS | canonical | none | demo | no | n/a | yes (lib) | Cycle with permissions via `openAccount` |
| `permissions` | ActionIntent + HMAC Execution Authority | TS | canonical | none | no | no | n/a | yes (lib) | — |
| `security` | KeyProvider, crypto suite, credential plane | TS | canonical | metadata PG / keys in-memory | demo | no | yes | later | No vendor KMS; HSM `SIMULATION`/`PORT_ONLY` |
| `identity` | Identity, sessions, WebAuthn, KYC metadata | TS | canonical | memory / PG | no | yes | yes | later | Simulated KYC |
| `kernel` | Six proofs, policy, ALLOW → EA | TS | canonical | none | no | via evidence | yes | sim-complete | Does not post journals |
| `ledger` | `postJournal`, class bridges, growth attribution | TS | canonical | memory / PG | no | via journals | yes | sim-complete | — |
| `evidence` | Hash-chained vault | TS | canonical | memory / PG | no | no | yes | sim-complete | Separate TX from ledger |
| `events` | Domain events, outbox/inbox/replay | TS | canonical | memory / PG | CLI | yes | yes | sim-complete | — |
| `persistence` | PostgreSQL adapter + recovery | TS | canonical | **postgres** | no | bridges | yes | sim-complete | Explorer DB not in `DATABASES` |
| `payments` | Cross-border, FX, sandbox rails | TS | canonical | memory / PG | demo | yes | yes | later | Fixture transports |
| `cards` | Auth/clear/settle + wallet sim | TS | canonical | memory / PG | demo | yes | yes | later | Simulated processor |
| `treasury` | Liquidity, prefunding, kill switches | TS | canonical | memory / PG | demo | yes | yes | sim-complete | — |
| `investments` | Paper orders, FIFO lots | TS | canonical | memory / PG | demo | yes | yes | later | Paper broker |
| `custody` | Custody + Travel Rule | TS | canonical | memory / ops PG | CLI | yes | yes | later | No `postJournal`; fixture TR |
| `personal-economic-graph` | Non-authoritative PEG | TS | canonical | memory / PG | demo | yes | yes | sim-complete | Not EA |
| `agent` | Personal Economy Agent (propose only) | TS | canonical isolated | none | no | no | yes | later | No kernel/ledger imports |
| `platform` | Growth Orchestrator + PEVE | TS | canonical | memory / PG | demo | yes | yes | later | Growth path demo-only |
| `personal-data-vault` | Subject-bound encrypted store | TS | canonical | memory / PG | demo | yes | yes | later | Some consent stubs |
| `consent` | Consent ledger + purpose firewall | TS | canonical | memory / PG | demo | yes | yes | later | Not legal approval |
| `clean-room` | Privacy compute + egress control | TS | canonical | memory / PG | demo | yes | yes | later | DP `NOT_IMPLEMENTED` |
| `regulatory-twin` | Counterfactual policy lab | TS | simulation-lab | memory / PG | demo | yes | yes | lab | Never issues EA |
| `risk` | Deterministic portfolio risk | TS | canonical | memory / PG | demo | yes | yes | sim-complete | Feeds Kernel Risk proof |
| `model-registry` | Versioned model artifacts | TS | canonical | memory / PG | no | no | yes | sim-complete | No `LIVE_APPROVED` |
| `strategy-lab` | Backtest / shadow / paper | TS | simulation-lab | memory / PG | demo | yes | yes | lab | No live trading |
| `agentic-capital-mesh` | Multi-agent allocation proposals | TS | simulation-lab | memory / PG schema | demo | partial | yes | later | Near-orphan |
| `sunrey-chain` | Chain, oracles, MoonRey, ops, Rust node | TS+Rust | canonical | mixed redb/PG/memory | many CLI | yes | yes | later | Production inactive |
| `sunrey-coin` | Kernel-gated application coin books | TS | canonical app coin | memory / PG | demo | yes | yes | sim-complete | `chainAdapter` unimplemented |
| `sunrey-exchange` | Matching, holds, clearing | TS | canonical | memory; V025 unused | demo/CLI | yes | yes | later | In-memory settlement ports |
| `sunrey-explorer` | Rebuildable chain projection | TS | projection | memory; SQL unwired | CLI+HTTP | no | yes | later | Not in migrator |
| `sunrey-economics` | Dual-economy laboratory (Chunk 75/76) | TS | simulation-lab | scenario files | CLI | no | yes | lab | Not monetary constitution |
| `sunrey-sdk` | Public API adapter + gateway + developer platform | TS | canonical contract | in-memory gateway | **HTTP + CLI** | types | yes | later | Gateway ≠ accounts runtime |
| `sunrey-agent` | Mandates + ProposalGate | TS | canonical | **in-memory only** | CLI | yes | yes | later | No ledger after ALLOW |
| `sunrey-range` | Adversarial test range | TS | simulation-lab | none | CLI | artifacts | yes | lab | In-process only |
| `information-market` | HIN marketplace + chain anchor | TS | canonical | memory / PG | CLI | yes | yes | later | Local consent grants |
| `human-economic-contribution` | Contribution registry + valuation | TS | canonical | in-memory | demo | partial | yes | later | Not issuance |
| `economic-asset-registry` | Asset metadata/rights registry | TS | canonical | in-memory | demo | partial | yes | later | Not a blob store |
| `ai-runtime` | Inference plane, S3M-primary | TS | canonical | none | demo | tracing | yes | later | Grok reserved; no execute |
| `market-surveillance` | Alerts → compliance cases | TS | canonical | in-memory | demo | yes | yes | later | Cannot freeze or journal |

### 4.2 Services (8)

| Service | Purpose | Status | Persistence | HTTP? | Gaps |
| --- | --- | --- | --- | --- | --- |
| `services/accounts` | Kernel-gated open/deposit/withdraw/transfer/balances/holds | **canonical app owner** | memory or PG runtime | **no** | Not exposed on `/v1` |
| `services/identity` | Re-exports `packages/identity` | facade | delegated | no | — |
| `services/compliance` | Re-exports kernel compliance | facade | delegated | no | — |
| `services/economic-graph` | Re-exports PEG | facade | delegated | no | — |
| `services/cards` | Re-exports cards + hold gateway | facade + wiring | delegated | no | — |
| `services/treasury` | Re-exports treasury | facade | delegated | no | — |
| `services/investments` | Re-exports investments | facade | delegated | no | — |
| `services/strategy-lab` | Re-exports strategy-lab | facade | delegated | no | — |

Missing facades (consumed as packages/demos): platform/growth, regulatory-twin, sunrey-coin, information-market, custody, sunrey-exchange, sunrey-agent, agentic-capital-mesh.

### 4.3 Apps, tools, infra

| Path | Purpose | Authoritative? |
| --- | --- | --- |
| `apps/explorer` | Static UI over explorer `/v1/*` | No |
| `tools/architectural-linter` | Constitution/manifest/chunk guards | Tooling yes |
| `infra/postgres` | Local PG | Dev/CI only |
| `infra/sunrey-production` | Production-shaped plans | Rehearsal only |
| `deploy/sunrey-testnet` | Testnet deploy | Testnet only |

---

## 5. API inventory

### 5.1 HTTP surfaces

| Surface | Paths | Backing store | Auth | Durable? |
| --- | --- | --- | --- | --- |
| `packages/sunrey-sdk` gateway | `/v1/*`, `/operator/v1/*`, `/health` | `DevelopmentPlatform` Maps | Public: none. Consumer: header **presence**. Operator: token | **No** |
| `packages/sunrey-explorer` | `/v1/home`, `/v1/blocks`, … | `InMemoryExplorerIndex` | none | **No** (rebuildable) |
| Rust `sunrey-chain` RPC | `/wallet/*`, `/block/*`, `/tx`, `/admin/*` | redb when `--data-dir` | none on local node | Yes if data-dir set |
| All `services/*` | none | Kernel/ledger libraries | EA | N/A — no HTTP |

### 5.2 OpenAPI vs implementation

| Spec | Declared | HTTP reality |
| --- | --- | --- |
| `api/sunrey-chain-v1.openapi.yaml` | Chain/accounts/assets/fees/validators/governance/oracles/productive/machines/interop/monetary/treasury/tx/events/faucet | Gateway implements a **subset** against in-memory fixtures. Many declared paths have no dedicated handler |
| `api/sunrey-exchange-v1.openapi.yaml` | Institutional + consumer exchange | Partial. Cancel can succeed without an order book. Auctions/capacity return empty |
| `api/sunrey-developer-platform-v1.openapi.yaml` | `/v1/developer/*` | **CLI only** (`sunrey-dev`). No gateway routes |
| `api/sunrey-events-v1.md` | SSE/JSON stream | Gateway `GET /v1/events` is fixture-backed |
| `api/sunrey-webhooks-v1.json` | Signing + idempotency | Engine exists; not HTTP-mounted |
| `api/sunrey-sdk-vectors-v1.json` | Cross-language IDs | Spec only |

### 5.3 Classification

| Class | Examples |
| --- | --- |
| Implemented HTTP (fixture) | Most `PUBLIC_ROUTES` in `gateway/server.ts` (~75 routes) |
| Specification-only | `/v1/developer/*`; many chain OpenAPI paths (locks, supply, oracles/providers, productive objects, interop clients, …) |
| Implemented undocumented | `/v1/network/*`, `/v1/fees/{policy,price,estimate-v2}`, `/v1/information/*`, `/v1/exchange/sandbox/orders`, per-id treasury GETs, `/operator/v1/*` |
| Internal library (no HTTP) | All `services/*` banking/identity/compliance/cards/treasury/investments |
| CLI-only | `sunrey-dev`, `sunrey-exchange`, `sunrey-wallet`, `sunrey-ops`, `sunrey-agent`, most chain CLIs |
| Demo-only | `/v1/dev/faucet`, sandbox orders, `produce-block`, `npm run demo` |
| Alternate unversioned HTTP | Explorer `/v1/blocks` vs chain `/v1/chain/blocks`; Rust `/block/height/{h}` vs OpenAPI server `18480` (Rust default `18432`) |

### 5.4 Contract gaps

- **Versioning:** `/v1` prefix and `x-sunrey-api-version` exist. No v2. Explorer/Rust are alternate surfaces.
- **Auth:** Chain OpenAPI has no `securitySchemes`. Developer API key is specified but not wired. Consumer routes accept any non-empty `Authorization`.
- **Idempotency:** Documented and in-memory for `POST /v1/transactions` only. Banking journals have durable idempotency **off the HTTP path**.
- **Errors:** `ApiErrorEnvelope` on SDK gateway. Explorer/Rust use `{ error }`. Developer OpenAPI has no error schema.

**Do not build the API Gateway in this prompt.** Phase B must choose one mutation authority (Kernel → accounts/ledger) and stop treating `DevelopmentPlatform` as product state.

---

## 6. Persistence inventory

### 6.1 PostgreSQL (canonical durable adapter)

| Database | Migrations | Migrator domain? | Contents |
| --- | --- | --- | --- |
| `solstice_customer` | V001–V028 | yes | Customer, identity, policy, payments, cards, PEG, growth, PEVE, treasury, investments, risk, models, mesh, strategy-lab, PDV, consent, clean-room, coin, HIN, chain metadata, exchange schema, operational tables |
| `solstice_ledger` | V001–V006 | yes | Journals, postings, intents, authority audit, events, outbox/inbox, banking core, digital-asset journals, operation execution |
| `solstice_evidence` | V001 | yes | Evidence hash chain |
| `solstice_security` | V001–V002 | yes | Key metadata, credential descriptor refs (never private keys) |
| explorer (`sunrey_explorer`) | V001 | **no** | Projection tables; no `PostgresExplorerIndex` |

`packages/persistence/src/env.ts` `DATABASES` lists four names only. Historical DB names are `INTERNAL_SAFE_TO_KEEP`.

Transaction order (accounts postgres runtime): customer → ledger unit (state + outbox) → evidence. Crash between ledger and evidence leaves a durable journal. That window is accepted.

### 6.2 What is durable vs ephemeral

| Component | Default | Durable when |
| --- | --- | --- |
| Banking ledger / accounts / evidence / events | In-memory `createSimulationRuntime` | `createPostgresSimulationRuntime` |
| Holds | In-memory `HoldStore` | **never today** |
| Exchange matching/orders | `ExchangeStore` Maps | File `DurableExchangeStore` or ops PG (`operational_*` only) |
| Exchange V025 tables | Schema exists | **No application writes found** |
| Agent mandates | `InMemoryAgentMandateStore` | **never today** |
| PEG | In-memory | `persistEconomicGraphState` when called |
| SDK gateway | `DevelopmentPlatform` Maps | never |
| Developer platform | Maps | never |
| RPC idempotency | In-memory | never |
| Explorer index | In-memory | never (rebuildable if chain reader exists) |
| Rust chain | — | redb `--data-dir` |
| Secrets | `InMemorySecretProvider` | never (simulation fixtures) |

### 6.3 Production-critical silent loss after restart

These lose state if the process restarts on the **default** path:

1. Banking journals and balances (`createSimulationRuntime`)
2. Evidence chain (same)
3. Domain outbox
4. Public `/v1` gateway state (blocks, txs, orders, idempotency)
5. Exchange books
6. Agent mandates and proposals
7. Active holds
8. Developer apps/keys/webhooks
9. Explorer index (acceptable if rebuildable)

PostgreSQL exists and is tested (`npm run test:persistence`). It is not the default public API path.

---

## 7. Simulation / placeholder inventory

Classification of non-test findings:

| Class | Meaning | Dominant examples |
| --- | --- | --- |
| TEST_ONLY | Test doubles | `*.test.ts` mocks (expected) |
| EXPECTED_SIMULATION | Designed simulation | `ENVIRONMENT=simulation`; Kernel `assertSimulationOnly`; Simulated* rails/cards/KYC; S3M local server; Dual-economy lab; range; RDT |
| PROVIDER_PLACEHOLDER | Fixture shaped like a vendor | Chunk 149–153 candidate adapters; `FixturePaymentTransport`; `FakeIdentityTransport`; oracle family adapters |
| PRODUCTIZATION_BLOCKER | Required for a real product path, currently refused or unwired | Native DVP `ADAPTER_UNWIRED`; Grok `NOT_IMPLEMENTED`; HSM `PORT_ONLY`; Exchange ports not ledger-backed; Agent execution receipt; gateway ≠ ledger; PDV consent stubs; live flags false |
| DEAD_CODE | Unused with no owner | No broad dead packages. `agentic-capital-mesh` is near-orphan. Exchange V025 writers absent |
| UNKNOWN | Nullable reads / taxonomy markers | Oracle `return null` latest-fact; ticker `NOT_ASSIGNED` placeholders |

Pattern scan (packages, excluding tests): `TODO`/`FIXME`/`STUB` = **0**. Simulation is expressed as typed refusals (`NOT_IMPLEMENTED`, `ADAPTER_UNWIRED`, `networkEnabled: false`), not leftover TODOs.

---

## 8. Provider placeholder inventory

No default path makes a live bank, KYC, FX, Travel Rule, card, HSM, or market-data network call.

| Domain | Simulation class | Candidate / fixture | Real network? |
| --- | --- | --- | --- |
| AI | `SimulatedS3mServer`, `S3mInferenceProvider` (`networkEnabled: false`) | `XaiGrokAiProvider` → `GROK_NOT_IMPLEMENTED`; `LocalTestAiProvider` | No |
| Banking / rails | `SimulatedRailAdapter` | `CandidateRailAdapter` + `FixturePaymentTransport` | No |
| FX | `SimulationFxProvider` | same payments candidate plane | No |
| Screening | `SimulationScreeningAdapter` | fixture sanctions/PEP/fraud | No |
| Cards | `SimulatedCardProcessor`, simulated Apple/Google wallet adapters | — | No |
| KYC | `SimulatedIdentityAdapter` | `FixturePersonVerificationProvider`, `FakeIdentityTransport` | No |
| AML | `SimulatedSanctionsProvider` et al. | `FixtureSanctionsProvider` and siblings | No |
| Travel Rule | `SimulationTravelRuleNetwork` | `FixtureTravelRuleCandidate`, `FakeTravelRuleTransport` | No |
| Custody assets | `InMemoryCustomerAssetPort` | dual-asset provider-candidate | No |
| Oracles | `LocalProviderSimulator` + family adapters | `ExternalProviderCandidateRegistry`; `NodeExternalHttpTransport` | `fetch` exists, **fails closed** in FIXTURE/SANDBOX |
| Market data | `SimulatedMarketDataProvider`; exchange in-process book | — | No |
| Exchange liquidity | `measureLiquidity` on local book | `commercialPricing: false` | No |
| HSM / signing | `DevelopmentHsmSimulator`, `SimulationKeyProvider` | `CeremonySimulationHsm`, `LocalTestPqSigningProvider` | No |
| Chain / settlement | `DevelopmentPlatform`, `InMemoryNativeChain` | `UnwiredNativeAssetSettlementAdapter` | No |

Provider count used in the Prompt 2 summary: **32 named placeholder/simulator classes** in the table above (including Grok reserved and unwired native DVP).

---

## 9. Duplicated architecture findings

Do **not** delete the secondary side. Canonical owner is listed first.

| # | Concern | Canonical | Secondary | Specialized? | Migration? |
| --- | --- | --- | --- | --- | --- |
| 1 | Fiat/coin balances | Ledger + accounts balance projection | Exchange `InMemoryFiatPort` / `InMemoryCoinPort` | Yes — labeled “not a second ledger” | **Yes** before live exchange |
| 2 | Custody positions | Ledger / future custody journals | `InMemoryCustomerAssetPort` | Yes | **Yes** before live custody |
| 3 | Native vs bank money | Wallet: chain state. Fiat: ledger | `InMemoryNativeChain` Map holdings | Yes — authority split documented | **Yes** to replace unwired DVP |
| 4 | SunRey Coin supply | Protocol: `AssetSupplyBook`. App: `SunReyCoinService.supply()` from ledger | Exchange `InMemoryCoinPort.supply()` | Two layers intentional; ports are not | **Partial** — bridge `chainAdapter` + exchange CoinPort |
| 5 | Agent runtimes | Isolation layers: `agent` (ideas), `sunrey-agent` (ProposalGate), `ai-runtime` (inference), `platform` (growth) | None competing for EA | **Yes — keep all four** | No |
| 6 | Policy engines | Kernel `PolicyEngine` | MoonRey policy, RDT, Growth `PolicyControlPort` | Yes | No |
| 7 | Evidence / consent | Evidence Vault | Consent ledger; HIN grant Map | Partially | **Maybe** bridge HIN → consent |
| 8 | Tx history | Banking history from journals | SDK chain receipts; explorer | Yes | No |
| 9 | Chain state machines | Rust node + redb | TS wallet local finalize; SDK `DevelopmentPlatform` | Rehearsal vs product API | **Yes** for one product RPC |
| 10 | HTTP path conventions | Intended: `api/*` v1 | Explorer `/v1/blocks`; Rust `/block/*` | Ops vs public | **Yes** for gateway unification (Phase B) |
| 11 | Execution Authority | Single type + Kernel issuer | ActorContext, wallet signing, credential plane | Yes — different purposes | No |
| 12 | Dual-economy labs | Chain economics = constitution | `sunrey-economics` = laboratory | Yes | No — constitution line “Do not create `packages/sunrey-economics`” is stale vs Chunk 75; **do not delete the lab** |

Low-risk removals performed: none of the above. Only merge-artifact and doc corrections (see § files changed in the PR).

---

## 10. Disconnected integration findings

### A. User identity flow

`IdentityService.authenticatePasskey` → session → `ActorContext` → capabilities → `AccountsService.open` → `kernel.submit` → `issuer.verify` → `openAccount` → ledger account register → evidence.

| Edge | Status |
| --- | --- |
| Identity → Kernel on login | Disconnected (correct: login is not a financial intent) |
| Identity HTTP | **Missing** — library only |
| Explorer → identity | Disconnected |
| `services/identity` | Facade only |

### B. Money flow

`MoneyMovementService` / `PaymentsService` / banking ops: validate → `kernel.submit` → `issuer.verify` → `Ledger.postJournal` → events → evidence.

| Edge | Status |
| --- | --- |
| Accounts/payments library path | **Connected** |
| HTTP request → this path | **Disconnected** (gateway uses DevelopmentPlatform) |
| Live rail settlement | Disconnected by design (`LIVE_*` false) |
| Accounts runtime → PaymentsService | Separate compositions, not one process |

### C. AI action flow

Inference (`grantsExecutionAuthority: false`) → `createProposalFromInference` → human approve → `ProposalGate.toActionIntent` → optional `kernel.submit` → **synthetic receipt**.

| Edge | Status |
| --- | --- |
| AI → EA / ledger | **Forbidden and absent** (correct isolation) |
| ALLOW → financial service → `postJournal` | **Disconnected** — productization gap |
| `packages/agent` → kernel | Absent by isolation (correct) |
| Evidence on agent execute | Absent |

### D. Exchange flow

Eligibility → `authorizeIntent` → reserve → match → `settleTrade` → coin/fiat **port** transfer → evidence.

| Edge | Status |
| --- | --- |
| Kernel on open/order/settle | Connected |
| Port → `Ledger.postJournal` | **Disconnected** |
| Settlement → custody service | **Disconnected** |
| Native DVP | `ADAPTER_UNWIRED` |
| Market data → EA | Absent (correct) |

### E. Native asset flow

Wallet sign/submit finalizes in TS (`height++`) or Rust consensus. `SunReyCoinService` is a separate Kernel+ledger path with `chainAdapter.implemented = false`.

| Edge | Status |
| --- | --- |
| Wallet → Rust consensus | Not invoked from TS `WalletEngine.submit` |
| Wallet → application Kernel/Ledger | **Disconnected** |
| Coin service → chain | **Disconnected** |
| Chain balances treated as bank balances | Guarded (wallet/mobile-sync refuses merge) |

---

## 11. Legacy / deprecated components

Naming source: `docs/architecture/sunrey-naming-inventory.md` (1303 legacy-token hits). **Do not mass-rename.**

| Classification | What | Action |
| --- | --- | --- |
| INTERNAL_SAFE_TO_KEEP | `@solstice/*`, `solstice_*` DB names, `solstice.<event>/1` schemaRefs, `le_solstice_*`, hash domains, GitHub `solstice` | Keep |
| USER_VISIBLE_MUST_CHANGE | Inventory still lists 9 MUST_MIGRATE keys; several display strings already say SunRey (root README/package/AGENTS/constitution titles). Remaining review: persistence log prefix, SDK/explorer metadata if any Solstice string remains | Cosmetic; not this prompt |
| API_COMPATIBILITY_DO_NOT_CHANGE_YET | `SolsticeIdentityId` alias, `SOLSTICE_PG_*` / `SOLSTICE_PERSISTENCE_TEST`, npm scope | Keep aliases |
| DEPRECATED | Historical ADRs; `docs/BUILD-STATUS.md` pointer; open historical PRs in `historical-implementation.md` | Keep as history |
| MIGRATION_REQUIRED | WebAuthn RPID `simulation.solstice.local`; PDV export format `SolsticePersonalDataExportV1`; legal entity display “Solstice UK Ltd (simulation)” | Later, with alias |

Obsolete-but-keep:

- `docs/BUILD-STATUS.md` — historical pointer to `docs/build-status.md`
- Constitution Chunk 71 sentence “Do not create `packages/sunrey-economics`” — superseded by Chunk 75 laboratory owner. Manifest already distinguishes lab vs constitution. Left in place (not a safe silent delete).

---

## 12. Productization blockers

These are engineering facts, not feature ideas.

1. **Public HTTP mutates the wrong store.** `/v1` → `DevelopmentPlatform`, not Kernel → accounts → ledger.
2. **Exchange settlement is not a ledger journal.** Synthetic `journalId`s from in-memory ports.
3. **Agent ALLOW is not execution.** No EA verify, no financial service, no journal, no evidence seal.
4. **Banking/identity/payments have no HTTP.** Phase B must expose the spine, not invent a second one.
5. **Default process state is ephemeral** for gateway, exchange, agent, holds.
6. **Exchange V025 SQL and explorer SQL are unused.**
7. **Custody does not `postJournal`.**
8. **Application coin and protocol supply are unbridged.**
9. **All regulated providers are fixtures.** Live launch is impossible until real adapters exist *and* counsel/flags allow them. Flags must stay false until then.
10. **Three HTTP/RPC dialects** (SDK v1, explorer v1, Rust wallet paths).
11. **HSM is simulation/port-only.**
12. **Native DVP adapter is unwired.**

---

## 13. Components already suitable for Phase B

Phase B (API Gateway / product surface) may **compose** these; it must not reimplement them.

| Component | Why it is usable |
| --- | --- |
| `packages/money`, `domain`, `permissions` | Stable types; bigint money; EA types |
| `packages/kernel` | Real decision layer; simulation-asserted |
| `packages/ledger` + `services/accounts` | Canonical mutation path |
| `packages/evidence`, `packages/events` | Seal and outbox model |
| `packages/persistence` + `db/*` (four DBs) | Durable adapter already tested |
| `packages/identity` | ActorContext + capability derivation |
| `packages/config` flags | Fail-closed production switches |
| `packages/security` KeyProvider | EA/session/wallet purpose split |
| `tools/architectural-linter` + kernel-gating script | Prevents a second mutator |
| Isolation of `ai-runtime` / `agent` / `sunrey-agent` | Keep; gateway must not grant them EA |
| OpenAPI v1 files | Contract starting point — remap mutations onto the spine |

Not suitable as the Phase B source of truth: `DevelopmentPlatform`, Exchange in-memory ports, explorer as ledger, Rust admin RPC as banking API.

---

## 14. Unresolved questions

1. Should the public product RPC be the SDK gateway rewritten onto `createPostgresSimulationRuntime`, or a new gateway that *only* fronts `services/*`? Phase B decides; this audit only forbids a second ledger.
2. Is `packages/sunrey-coin` the customer-visible coin, or is protocol `AssetSupplyBook` the only native asset? Today both exist and are unbridged.
3. Must HIN consent grants become rows in `packages/consent`, or is marketplace consent a separate bounded context?
4. When (if ever) should TS wallet submit enlist Rust consensus in-process? They are different runtimes today.
5. Is `apps/explorer` the long-term UI, or only a demo shell?
6. Should `agentic-capital-mesh` remain a lab package or gain a service facade?
7. Which OpenAPI paths are committed public surface vs rehearsal documentation?
8. Who owns mapping SDK `/v1/accounts` (chain account) vs banking `services/accounts` so the names do not collide in Phase B?
9. Is Exchange V025 a future durable store or a leftover schema?
10. Remaining MUST_MIGRATE naming keys vs already-migrated display strings — inventory counts may be stale relative to current files.

---

## Security authority boundary (audit)

Verified: **no path** for AI model, explorer frontend, external provider adapters, or market-data services to obtain Execution Authority or post arbitrary canonical ledger entries.

| Actor | Obtain EA? | `Ledger.postJournal`? |
| --- | --- | --- |
| `packages/ai-runtime` | No (`grantsExecutionAuthority: false`) | No imports |
| `packages/agent` | No | No imports |
| `packages/sunrey-agent` | No (ProposalGate does not issue) | No |
| `apps/explorer` | No | Static JS |
| Provider candidates | `kycVerifiedIssuesExecutionAuthority(): false` | Tests forbid issuer/journal |
| Market data | No | Read-only matching/types |
| Kernel | **Yes — only production issuer** | Does not post |
| Accounts / payments / cards / investments / treasury / sunrey-coin / information-market fiat | Consume **verified** EA | Yes — kernel-gating registry |

---

## Low-risk cleanup performed in this prompt

| Change | Why it is safe |
| --- | --- |
| Merged duplicate root `package.json` `"test"` scripts | `scripts/check-json-integrity.mjs` requires exactly one `"test"` key. The two keys were a merge artifact; JSON.parse kept only the second and dropped `native-assets` tests |
| Added `sunrey-economics` to constitution workspace inventory | Package already exists as Chunk 75 owner in the manifest |
| Linked this inventory from the constitution | Documentation pointer only |
| Merged duplicate `solstice_customer` rows in `docs/architecture/persistence.md` | Same database documented twice |
| Merged duplicate `notes` keys on `sunrey-production-handoff` in `manifest.json` | JSON integrity rejected the file; both Chunk 167 and Chunk 168 facts kept |
| Deduplicated `docs/architecture/integrity-baseline.json` counts | Duplicate keys; rewritten from current manifest/chunk totals |
| `compose-ceremony.ts` `privateKeysReused === true` | Type is literal `false`; comparison was a merge leftover that failed `tsc` |
| Launch-freeze test PEM header split | Secret-scan false positive; detector still exercises `BEGIN PRIVATE KEY` at runtime |

No architectural migrations. No provider activation. No `LIVE_*` or `ENVIRONMENT` changes.

---

## Validation note

See the pull request and Prompt 2 close-out for commands actually run. Do not treat this file as a CI green certificate.
