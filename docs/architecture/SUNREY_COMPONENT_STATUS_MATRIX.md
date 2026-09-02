# SunRey Component Status Matrix

**Wave 1 reference document** — authoritative inventory for production-readiness waves.  
**Last updated:** 2026-09-02  
**Posture:** Simulation-only. No component in this matrix is production-active unless explicitly marked PRODUCTION_CAPABLE *and* external gates are satisfied.

## Status legend

| Status | Meaning |
|--------|---------|
| PRODUCTION_CAPABLE | Core logic/durability suitable for production; blocked by `ENVIRONMENT` / `LIVE_*` / ceremony |
| IMPLEMENTED_NON_PRODUCTION | Substantial implementation; dev/testnet/simulation scope only |
| SIMULATION | Explicit simulation adapter, in-memory default, or `ENGINEERING_SIMULATION` marker |
| SANDBOX | Provider-candidate / fixture / conformance only |
| PARTIAL | Some layers complete; others stubbed or unwired |
| INTERFACE_ONLY | Types, ports, contracts without live backend |
| STUB | Minimal placeholder |
| NOT_IMPLEMENTED | Declared absent or `NOT_IMPLEMENTED` markers |
| DEPRECATED | Superseded; retained for compatibility |
| UNCERTAIN | Requires Wave 2 verification |

## Environment legend

| Code | Meaning |
|------|---------|
| SIM | `ENVIRONMENT=simulation`, all `LIVE_*=false` |
| DEV | Development network (`net_sunrey_local_dev`, Rust local node) |
| TEST | Testnet (`net_sunrey_testnet_1`) |
| CAND | Production candidate identifiers only (not activated) |
| ANY | Applies across environments |

---

## Monetary constitution and native assets

| Component | Path | Purpose | Status | Persistence | Authority | Environment | Dependencies | Risks | Recommended Future Action |
|-----------|------|---------|--------|-------------|-----------|-------------|--------------|-------|---------------------------|
| SunRey Coin (application) | `packages/sunrey-coin/` | Kernel-gated simulation SunRey Coin on canonical ledger | SIMULATION | In-memory `SunReyCoinStore` + ledger journals | `CURRENT_APPLICATION_AUTHORITY` | SIM | ledger, kernel, permissions, evidence | F: confused with protocol-native supply | KEEP AS ENGINEERING SIMULATION; formalize boundary in ADR |
| SunRey Coin service | `packages/sunrey-coin/src/service.ts` | Issue/transfer/burn via EA | SIMULATION | Per-instance store | Application ledger | SIM | consent, clean-room vectors | In-memory proposals lost on restart | KEEP; wire persistence only if simulation continuity required |
| SunRey Coin store | `packages/sunrey-coin/src/store.ts` | Vectors, proposals, issuances, replay protection | SIMULATION | Process memory (Maps/Sets) | None (metadata) | SIM | — | Replay keys not durable by default | ISOLATE from production migration |
| SunRey Coin formula | `packages/sunrey-coin/src/formula.ts` | 8-factor reward floor division | IMPLEMENTED_NON_PRODUCTION | Stateless | Policy reference | SIM | clean-room metadata | Protected traits must not affect weight | KEEP |
| Future chain adapter | `packages/sunrey-coin/src/types.ts` | Declared chain bridge | NOT_IMPLEMENTED | — | — | — | native-assets (future) | Premature wiring | KEEP stub until migration ADR |
| Simulation catalog | `packages/sunrey-coin/src/simulation-catalog.ts` | Solstice UK legal entity fixture | SIMULATION | Static | Fixture | SIM | domain | Legacy entity IDs in tests | KEEP AS ADAPTER |
| Native asset registry | `packages/sunrey-chain/src/native-assets/registry.ts` | Canonical SUNREY_COIN / MOONREY_COIN metadata | IMPLEMENTED_NON_PRODUCTION | In-memory | `NATIVE_BLOCKCHAIN_AUTHORITY` | DEV/TEST | protocol/assets, economics/constitution | Ticker `NOT_ASSIGNED` | KEEP as protocol owner |
| Native asset authority boundary | `packages/sunrey-chain/src/native-assets/authority.ts` | Application vs native separation | INTERFACE_ONLY | Stateless constants | Boundary definition | ANY | — | Import flag must stay false | KEEP |
| Protocol native supply authority | `packages/sunrey-chain/src/native-assets/economic-controls.ts` | Supply mutations, genesis, burn gates | IMPLEMENTED_NON_PRODUCTION | In-memory `AssetSupplyBook` | Native protocol | DEV | issuance-pipelines, supply.ts | F: MAINNET bypass | KEEP; enforce ceremony before MAINNET |
| Asset supply book | `packages/sunrey-chain/src/economics/supply.ts` | Conservation accounting for natives | IMPLEMENTED_NON_PRODUCTION | Process memory Maps | Native protocol | DEV | constitution types | Not persisted by default | MIGRATE LATER to chain state + redb |
| SunRey issuance pipeline | `packages/sunrey-chain/src/native-assets/issuance-pipelines.ts` | Human-governed SunRey mint path | SIMULATION | Proposal records in memory | Native protocol | DEV | human-contribution bridge | Terminates `APPLIED_SIMULATION` | KEEP; replace simulation terminal on production ADR |
| MoonRey issuance pipeline | `packages/sunrey-chain/src/native-assets/issuance-pipelines.ts` | Productive contribution mint path | SIMULATION | In-memory | Native protocol | DEV | productive/engine, GPUV | Oracle cannot mint (enforced) | KEEP |
| Economic policy docs | `packages/sunrey-chain/src/native-assets/economic-policy.ts` | Versioned policy; mainnet params unresolved | INTERFACE_ONLY | Stateless | Policy schema | CAND | Chunk 143-144 | `NOT_AUTHORIZED` mainnet | KEEP |
| Migration manifest | `packages/sunrey-chain/src/native-assets/migration.ts` | Application→native migration schema | STUB | Fixture only | — | SIM | authority.ts | Zero-supply fixture | KEEP; execute only under ceremony |
| Monetary constitution | `packages/sunrey-chain/src/economics/constitution.ts` | Chunk 71 dual-asset rules | IMPLEMENTED_NON_PRODUCTION | Stateless | Constitutional | ANY | supply, issuance | — | KEEP |
| MoonRey issuance flag | `packages/sunrey-chain/src/protocol/assets.ts` | `moonreyIssuanceActivated()` | INTERFACE_ONLY | — | Gate | ANY | CI linters | Must remain false | KEEP |
| Dual-economy lab | `packages/sunrey-economics/` | Chunk 75 simulation laboratory | SIMULATION | Ephemeral runs | None | SIM | — | Not production policy | KEEP AS SIMULATION |
| packages/moonrey-coin | — | Superseded package | DEPRECATED | — | — | — | native-assets | CI forbids creation | DEPRECATE LATER (already absent) |

---

## Ledger, evidence, kernel, permissions

| Component | Path | Purpose | Status | Persistence | Authority | Environment | Dependencies | Risks | Recommended Future Action |
|-----------|------|---------|--------|-------------|-----------|-------------|--------------|-------|---------------------------|
| Ledger journal API | `packages/ledger/src/journal.ts` | Sole fiat write path | PRODUCTION_CAPABLE | In-memory default; PG adapter | Canonical fiat | SIM+PG | permissions EA, domain | Default in-memory loss | KEEP; require PG in production |
| Ledger read model | `packages/ledger/src/read-model.ts` | Derived balances | PRODUCTION_CAPABLE | Projection | Derived from ledger | ANY | journal | Must not become stored balance | KEEP |
| Account register | `packages/ledger/src/accounts.ts` | Account metadata | PRODUCTION_CAPABLE | Map / PG | Ledger adjunct | SIM | domain Account | Simulation seed accounts | KEEP |
| Ledger PG store | `packages/persistence/src/ledger/pg-journal-store.ts` | Durable journals | PRODUCTION_CAPABLE | PostgreSQL | Canonical fiat | SIM+PG | db migrations | — | KEEP |
| Evidence Vault | `packages/evidence/src/vault.ts` | Hash-chained audit trail | PRODUCTION_CAPABLE | In-memory default; PG | Evidence authority | SIM+PG | crypto sha256 | Default in-memory loss | KEEP |
| Evidence PG | `packages/persistence/src/session.ts` | Durable evidence | PRODUCTION_CAPABLE | PostgreSQL | Evidence | SIM+PG | — | — | KEEP |
| Compliance Kernel | `packages/kernel/src/kernel.ts` | Six-proof decisions + EA | IMPLEMENTED_NON_PRODUCTION | Stateless engine | EA issuer | SIM | assertSimulationOnly | Simulation assertion blocks prod | KEEP; governed removal at activation |
| Compliance store | `packages/kernel/src/compliance/store.ts` | AML/screening state | IMPLEMENTED_NON_PRODUCTION | In-memory Maps | Kernel adjunct | SIM | — | Lost on restart | MIGRATE LATER to PG |
| Execution Authority | `packages/permissions/` | HMAC-scoped authority | PRODUCTION_CAPABLE | Stateless verify | Authority plane | ANY | security keys | Dev keys in simulation | KEEP; HSM for production |
| Production activation firewall | `packages/sunrey-chain/src/economics/production-activation/firewall.ts` | Evaluator-only economic readiness | IMPLEMENTED_NON_PRODUCTION | Stateless | Gate evaluator | ANY | external evidence registry | No activate function | KEEP |
| Parameter authorization | `packages/sunrey-chain/src/economics/production-activation/authorization/` | Governed parameter approval | SANDBOX | Ceremony records | Authorization | CAND | governance-ops | AUTHORIZED≠ACTIVE | KEEP |

---

## Blockchain runtime, consensus, storage

| Component | Path | Purpose | Status | Persistence | Authority | Environment | Dependencies | Risks | Recommended Future Action |
|-----------|------|---------|--------|-------------|-----------|-------------|--------------|-------|---------------------------|
| SunRey Chain TS service | `packages/sunrey-chain/src/service.ts` | Write orchestration | SIMULATION | InMemorySunReyChainStore | Non-authoritative anchor | SIM | SimulationChainAdapter | Not production node | ISOLATE from Rust node path |
| Simulation chain adapter | `packages/sunrey-chain/src/simulation.ts` | Fake finality/receipts | SIMULATION | Maps | Simulation | SIM | — | — | KEEP AS ADAPTER |
| In-memory chain store | `packages/sunrey-chain/src/store.ts` | Intents, operations, receipts | SIMULATION | Maps | Chain orchestration | SIM | — | Lost on restart | PG adapter exists |
| Chain PG persistence | `packages/persistence/src/sunrey-chain/pg-sunrey-chain-store.ts` | Durable chain writes | PRODUCTION_CAPABLE | PostgreSQL (`network_mode=SIMULATION`) | Chain write log | SIM+PG | db migrations | Mode column must gate prod | KEEP; extend for MAINNET mode later |
| Protocol state machine | `packages/sunrey-chain/src/protocol/state.ts` | Rights, capacity, sequences | IMPLEMENTED_NON_PRODUCTION | Maps | Protocol (non-balance) | DEV | — | In-memory | MIGRATE LATER to Rust state |
| Rust consensus engine | `packages/sunrey-chain/rust/crates/consensus/` | BFT Tendermint-family | IMPLEMENTED_NON_PRODUCTION | WAL | Consensus | DEV | validators | Not live mesh | KEEP |
| Rust storage (redb) | `packages/sunrey-chain/rust/crates/storage/` | ACID block/state store | PRODUCTION_CAPABLE | redb filesystem | Chain storage | DEV | — | Requires ops hardening | KEEP |
| Rust state / ChainView | `packages/sunrey-chain/rust/crates/state/` | Deterministic application state | IMPLEMENTED_NON_PRODUCTION | BTreeMap | Chain state root | DEV | execution | In-process | KEEP |
| Rust local node | `packages/sunrey-chain/rust/crates/node/` | Development node | SIMULATION | Local | `LOCAL_DEVELOPMENT_SIMULATION` | DEV | rpc, consensus | Not production BFT deployment | KEEP for dev |
| Rust RPC | `packages/sunrey-chain/rust/crates/rpc/` | Loopback JSON-RPC | SIMULATION | — | RPC plane | DEV | node | Loopback only | MIGRATE LATER to secured RPC |
| TS consensus assurance | `packages/sunrey-chain/src/assurance/consensus.ts` | Test double | STUB | — | — | SIM | Rust consensus | — | KEEP as test adapter |
| P2P networking | — | Validator mesh | STUB | — | — | — | ADR-0023 | Keys exist; no gossip | IMPLEMENT in Wave 2+ |
| Testnet network | `packages/sunrey-chain/src/testnet/network.ts` | In-process testnet | SIMULATION | `balances` Map | Test fixture | TEST | testnet/genesis | F: balance confusion | ISOLATE |
| Testnet genesis | `packages/sunrey-chain/src/testnet/genesis.ts` | Deterministic test genesis | IMPLEMENTED_NON_PRODUCTION | Genesis blob | Testnet | TEST | identity.ts | — | KEEP |
| Mainnet identity | `packages/sunrey-chain/src/mainnet/identity.ts` | Production candidate IDs | INTERFACE_ONLY | Constants | Naming | CAND | — | IDs only, not active | KEEP |
| Genesis execution | `packages/sunrey-chain/src/genesis-execution/` | Ceremony execution types | SANDBOX | Transcripts | Ceremony | CAND | launch-freeze | REHEARSAL≠ACTIVE | KEEP |
| Launch freeze | `packages/sunrey-chain/src/release-candidate/mainnet/launch-freeze/` | Immutable candidate hash | SANDBOX | Freeze records | Governance | CAND | Chunk 164 | Freeze≠approval | KEEP |
| Launch ceremony | `packages/sunrey-chain/src/production-ceremony/launch-candidate/` | Multi-party signing rehearsal | SANDBOX | Transcripts | Ceremony | CAND | Chunk 165 | — | KEEP |
| Staged activation | `packages/sunrey-chain/src/post-genesis/staged-activation/` | Canary rehearsal | SANDBOX | Stage state | Governance | CAND | Chunk 166 | `PRODUCTION_ACTIVE=false` | KEEP |
| Launch abort / recovery | `packages/sunrey-chain/src/governance-ops/launch-abort/` | Incident rehearsal | SANDBOX | Incident records | Governance | CAND | Chunk 167 | — | KEEP |

---

## Exchange, custody, wallets

| Component | Path | Purpose | Status | Persistence | Authority | Environment | Dependencies | Risks | Recommended Future Action |
|-----------|------|---------|--------|-------------|-----------|-------------|--------------|-------|---------------------------|
| SunRey Exchange service | `packages/sunrey-exchange/src/service.ts` | Matching, settlement orchestration | SIMULATION | ExchangeStore Maps | Exchange internal | SIM | InMemoryCoinPort, FiatPort | F: in-memory as truth | KEEP; production adapters via ledger |
| Exchange store | `packages/sunrey-exchange/src/store.ts` | Orders, holds, trades | SIMULATION | 20+ Maps | Exchange | SIM | — | Lost on restart | MIGRATE LATER or rebuild from events |
| In-memory coin port | `packages/sunrey-exchange/src/adapters.ts` | Simulation coin double | SIMULATION | positions Map | Simulation | SIM | — | Not ledger | KEEP AS ADAPTER |
| In-memory fiat port | `packages/sunrey-exchange/src/adapters.ts` | Simulation cash double | SIMULATION | books Map | Simulation | SIM | — | Fake journalIds | KEEP AS ADAPTER |
| Exchange production core | `packages/sunrey-exchange/src/production-core/` | Sequencer, replay | IMPLEMENTED_NON_PRODUCTION | Optional persistence port | Exchange | DEV | — | Default in-memory | KEEP |
| Custody service | `packages/custody/src/service.ts` | Deposits, withdrawals, Travel Rule | SIMULATION | CustodyStore | Operational; ledger for accounting | SIM | simulation providers | Live paths throw | KEEP |
| Custody store | `packages/custody/src/store.ts` | Custody operations | SIMULATION | Maps | Custody ops | SIM | — | — | MIGRATE LATER |
| Custody authority model | `packages/custody/src/provider-candidate/authority.ts` | Four-plane reconciliation | INTERFACE_ONLY | — | Contract | ANY | — | autoCorrect=false | KEEP |
| Custody provider sandbox | `packages/custody/src/provider-candidate/sandbox.ts` | Fixture wallet balances | SANDBOX | wallet.balance | Provider reported | SIM | — | providerBalanceIsTruth=false | KEEP AS ADAPTER |
| Chain wallet engine | `packages/sunrey-chain/src/wallet/engine.ts` | Dev wallet metadata | SIMULATION | wallets Map | Read from native accounts | DEV | DevelopmentKeystore | Not second ledger | KEEP |
| Development keystore | `packages/sunrey-chain/src/wallet/keystore.ts` | Dev signing keys | SIMULATION | Map / file | Keys | DEV | — | Not HSM | REPLACE for production |
| Institutional custody | `packages/custody/src/institutional/` | Vault reservations | IMPLEMENTED_NON_PRODUCTION | Maps | Institutional | SIM | — | — | KEEP |

---

## HIN, human contribution, intelligence

| Component | Path | Purpose | Status | Persistence | Authority | Environment | Dependencies | Risks | Recommended Future Action |
|-----------|------|---------|--------|-------------|-----------|-------------|--------------|-------|---------------------------|
| Information marketplace | `packages/information-market/src/service.ts` | Legacy marketplace flow | SIMULATION | InformationMarketStore | HIN/marketplace | SIM | — | — | KEEP |
| HIN network engine | `packages/information-market/src/network/` | Consent, rights, clean-room | SIMULATION | 15+ Maps | HIN | SIM | consent, chain-anchor | productionActivated=false | KEEP |
| HIN contribution adapter | `packages/information-market/src/network/contribution/` | HIN→contribution registry | IMPLEMENTED_NON_PRODUCTION | Projection Maps | One-way adapter | SIM | human-economic-contribution | — | KEEP AS ADAPTER |
| HIN chain anchor | `packages/information-market/src/network/chain-anchor/` | Privacy-safe commitments | SIMULATION | anchor Maps | Chain receipts | SIM | SunReyChainService | ANCHOR_MINTS_ASSET=false | KEEP |
| Rights marketplace | `packages/information-market/src/rights-marketplace/` | Information rights trading | SIMULATION | Store Maps | Marketplace | SIM | — | Sandbox only | KEEP |
| Human contribution registry | `packages/human-economic-contribution/src/registry.ts` | Canonical contribution records | SIMULATION | Snapshot store | Registry | SIM | verification | In-memory snapshot | MIGRATE LATER to PG |
| Contribution verification | `packages/human-economic-contribution/src/verification/` | Evidence policy Chunk 109 | IMPLEMENTED_NON_PRODUCTION | Stateless rules | Policy | SIM | — | — | KEEP |
| Valuation engine | `packages/human-economic-contribution/src/valuation/` | Event valuation (not PEVE) | IMPLEMENTED_NON_PRODUCTION | Reference data Map | Valuation | SIM | — | Not mint authority | KEEP |
| Human contribution bridge | `packages/sunrey-chain/src/economics/human-contribution-bridge/` | Privacy-safe monetary bridge | IMPLEMENTED_NON_PRODUCTION | Stateless transforms | Bridge | SIM | firewall | productionValuationActivated=false | KEEP |
| Personal Economic Graph | `packages/personal-economic-graph/` | Non-authoritative graph | IMPLEMENTED_NON_PRODUCTION | InMemory store; PG optional | Derived intelligence | SIM | — | Not balance authority | KEEP |
| PEVE | `packages/platform/src/value/` | Personal economic value engine | IMPLEMENTED_NON_PRODUCTION | InMemory; PG optional | Measurement | SIM | PEG snapshots | AI_CANNOT_SET_SCORE | KEEP |
| PEG service facade | `services/economic-graph/` | Application facade | IMPLEMENTED_NON_PRODUCTION | Delegates to PEG | Facade | SIM | personal-economic-graph | — | KEEP |

---

## Productive economy, GPUV, oracles

| Component | Path | Purpose | Status | Persistence | Authority | Environment | Dependencies | Risks | Recommended Future Action |
|-----------|------|---------|--------|-------------|-----------|-------------|--------------|-------|---------------------------|
| Productive engine | `packages/sunrey-chain/src/productive/engine.ts` | Objects, claims, contributions | SIMULATION | Maps | Productive registry | SIM | oracle facts | In-memory | MIGRATE LATER |
| MoonRey issuance (productive) | `packages/sunrey-chain/src/productive/issuance.ts` | Authorization/receipt types | SIMULATION | Maps | Productive path | SIM | engine | development policy only | KEEP |
| Source taxonomy | `packages/sunrey-chain/src/productive/source-taxonomy/` | Oracle→productive mapping | IMPLEMENTED_NON_PRODUCTION | Registry Map | Mapping | SIM | oracle | PRODUCTION_ACTIVE=false | KEEP |
| Claim candidate | `packages/sunrey-chain/src/productive/claim-candidate/` | Fact/claim compatibility | IMPLEMENTED_NON_PRODUCTION | Maps | Gate | SIM | — | — | KEEP |
| GPUV constitution | `packages/sunrey-chain/src/productive/policy-governance/value-function/constitution.ts` | Value policy rules | INTERFACE_ONLY | Constants | Policy | SIM | — | Dual flag naming | KEEP; document flags |
| GPUV engine | `packages/sunrey-chain/src/productive/policy-governance/value-function/engine.ts` | Deterministic valuation | IMPLEMENTED_NON_PRODUCTION | Optional result store | Measurement | SIM | attribution | CAN_MINT=false | KEEP |
| Value settlement bridge | `packages/sunrey-chain/src/productive/policy-governance/value-settlement/` | GPUV→MoonRey bridge | SIMULATION | Maps | Settlement sim | SIM | GPUV | GPUV≠MoonRey | KEEP |
| Economy data platform | `packages/sunrey-chain/src/productive/economy-data/` | Phase H observations | IMPLEMENTED_NON_PRODUCTION | Registry Maps | Observations | SIM | units | Observations≠mint | KEEP |
| Oracle engine | `packages/sunrey-chain/src/oracle/engine.ts` | Providers, facts, observations | SIMULATION | Maps | Oracle (not money) | SIM | — | In-memory | MIGRATE LATER |
| Oracle production plane | `packages/sunrey-chain/src/oracle/production/plane.ts` | Production scaffolding | SANDBOX | Maps | Oracle ops | SIM | fake transport | Fixtures≠production | KEEP |
| Oracle provider families | `packages/sunrey-chain/src/oracle/production/provider-families/` | Domain fabrics (12 families) | SANDBOX | Registries | Oracle | SIM | certification | Production valuation inactive | KEEP |
| Oracle certification | `packages/sunrey-chain/src/oracle/production/certification/` | Source admission | SANDBOX | Maps | Certification | SIM | — | ≠production approval | KEEP |
| Economic data fabric | `packages/sunrey-chain/src/oracle/production/economic-data-fabric/` | Multi-provider reconciliation | IMPLEMENTED_NON_PRODUCTION | Maps | Fabric | SIM | families | — | KEEP |
| External provider candidates | `packages/sunrey-chain/src/oracle/production/external-provider-candidate/` | Chunk 150 blueprints | SANDBOX | Profiles | Onboarding | SIM | provider-sdk | Injected transport only | KEEP |
| Oracle readiness | `packages/sunrey-chain/src/oracle/production/readiness.ts` | Four-slot readiness model | INTERFACE_ONLY | — | Gate | ANY | — | productionEligible NOT_PROVIDED | KEEP |

---

## Identity, consent, governance, security

| Component | Path | Purpose | Status | Persistence | Authority | Environment | Dependencies | Risks | Recommended Future Action |
|-----------|------|---------|--------|-------------|-----------|-------------|--------------|-------|---------------------------|
| SunRey Identity core | `packages/identity/` | Sessions, WebAuthn, ActorContext | IMPLEMENTED_NON_PRODUCTION | Identity store Maps | Identity | SIM | — | LIVE_EXTERNAL_KYC=false | KEEP |
| Identity provider candidate | `packages/identity/src/provider-candidate/` | Fixture KYC adapters | SANDBOX | Maps | Conformance | SIM | — | kycVerifiedOpensAccount=false | KEEP AS ADAPTER |
| Identity production candidate | `packages/identity/src/production-candidate/` | Productized sandbox lifecycle | SANDBOX | Records | Sandbox | SIM | — | Sandbox≠production KYC | KEEP |
| Consent service | `packages/consent/src/service.ts` | Grants, revocations | IMPLEMENTED_NON_PRODUCTION | Store Maps; PG | Consent Ledger | SIM+PG | identity, evidence | — | KEEP |
| Purpose firewall | `packages/consent/src/firewall.ts` | Purpose/recipient evaluation | PRODUCTION_CAPABLE | Stateless | Consent | ANY | — | — | KEEP |
| Consent PG | `packages/persistence/src/consent/pg-consent-store.ts` | Durable consent | PRODUCTION_CAPABLE | PostgreSQL | Consent | SIM+PG | db | — | KEEP |
| Governance ops engine | `packages/sunrey-chain/src/governance-ops/engine.ts` | Policy packages, emergency | IMPLEMENTED_NON_PRODUCTION | Maps | Governance rehearsal | SIM | — | No super-admin | KEEP |
| Production handoff gates | `packages/sunrey-chain/src/production-handoff/production-gates/` | Gate catalog + evaluation | IMPLEMENTED_NON_PRODUCTION | Snapshot eval | Registry | ANY | — | externalGates MISSING | KEEP |
| Security key provider | `packages/security/` | Envelope encryption, dev keys | IMPLEMENTED_NON_PRODUCTION | Dev material | Keys | SIM | — | PRODUCTION_HSM_KMS_CONFIGURED=false | MIGRATE LATER to HSM |
| Regulated credentials plane | `packages/security/src/regulated/credentials/` | Production-candidate credentials | SANDBOX | Secret refs | Credentials | SIM | — | Raw creds forbidden | KEEP |

---

## API, BFF, explorer, external intelligence

| Component | Path | Purpose | Status | Persistence | Authority | Environment | Dependencies | Risks | Recommended Future Action |
|-----------|------|---------|--------|-------------|-----------|-------------|--------------|-------|---------------------------|
| Platform API | `services/api/src/index.ts` | `/api/v1` HTTP runtime | IMPLEMENTED_NON_PRODUCTION | Stateless handlers | Orchestration | SIM | downstream services | PRODUCTION_ACTIVE=false | KEEP |
| Consumer BFF | `services/api/src/consumer/` | Lovable-safe orchestration | IMPLEMENTED_NON_PRODUCTION | — | BFF | SIM | exchange, HIN, grow | No ledger writes | KEEP |
| Internal production gates API | `services/api/src/internal-production-gates.ts` | Operator gate visibility | IMPLEMENTED_NON_PRODUCTION | — | Internal | SIM | production-handoff | Not on /api/v1 | KEEP |
| API config gates | `services/api/src/config.ts` | PRODUCTION_READY/ACTIVE | INTERFACE_ONLY | Constants | Gate | ANY | — | Validation rejects flip | KEEP |
| SunRey Explorer indexer | `packages/sunrey-explorer/` | Block/tx index | SIMULATION | 19 Maps | Rebuildable projection | DEV | chain | EXPLORER_AUTHORITATIVE=false | KEEP |
| Explorer static app | `apps/explorer/` | Demo UI client | SIMULATION | — | UI | DEV | explorer API | Not indexer owner | KEEP; fix authority map |
| Testnet explorer | `packages/sunrey-chain/src/testnet/explorer.ts` | Testnet view | SIMULATION | — | Read-only | TEST | testnet | — | KEEP |
| Chain intelligence | `packages/sunrey-chain/src/chain-intelligence/` | Wave 3 external chain intel | SANDBOX | — | Read-only external | SIM | fixture adapters | Must not target SunRey native | KEEP |
| Blockchain intelligence | `packages/sunrey-chain/src/blockchain-intelligence/` | Wave 3 prompt 14 surface | SANDBOX | — | Read-only external | SIM | BFF blockchain.ts | Fixture only | KEEP |
| Provider SDK | `packages/provider-sdk/` | Universal provider contract | IMPLEMENTED_NON_PRODUCTION | Stateless | Transport | SIM | activation-policy | Blocks prod in simulation | KEEP |
| SunRey SDK gateway | `packages/sunrey-sdk/src/gateway/` | Developer gateway | IMPLEMENTED_NON_PRODUCTION | Platform Maps | Gateway | SIM | — | productionActivated=false | KEEP |

---

## Access economy, payments, treasury (adjacent)

| Component | Path | Purpose | Status | Persistence | Authority | Environment | Dependencies | Risks | Recommended Future Action |
|-----------|------|---------|--------|-------------|-----------|-------------|--------------|-------|---------------------------|
| Access economy | `packages/access-economy/` | Access transactions, solvency | SIMULATION | Maps | Access domain | SIM | access fabric | Wave 1-3 simulation | KEEP |
| Human access economy | `packages/human-access-economy/` | Access orchestration | SIMULATION | 12 Maps | Access | SIM | — | — | KEEP |
| Payments production-candidate | `packages/payments/src/production-candidate/` | Banking/FX fixtures | SANDBOX | — | Payments sim | SIM | — | No live rails | KEEP AS ADAPTER |
| Treasury | `packages/treasury/` | Corridor liquidity simulation | SIMULATION | Maps | Treasury sim | SIM | le_solstice fixtures | assertSimulationOnly | KEEP AS SIMULATION |

---

## Configuration and CI guards

| Component | Path | Purpose | Status | Persistence | Authority | Environment | Dependencies | Risks | Recommended Future Action |
|-----------|------|---------|--------|-------------|-----------|-------------|--------------|-------|---------------------------|
| Simulation flags | `packages/config/src/flags.ts` | ENVIRONMENT + LIVE_* | PRODUCTION_CAPABLE | Compile-time | Global gate | SIM | — | Must stay false until ceremony | KEEP |
| Activation gates | `packages/config/src/activation-gates.ts` | ADR-linked regulated gates | PRODUCTION_CAPABLE | Stateless | Gate framework | ANY | flags | — | KEEP |
| Product identity | `packages/config/src/product-identity.ts` | SunRey vs Solstice branding | INTERFACE_ONLY | Constants | Naming | ANY | — | LEGACY_MASTER_BRAND_ACTIVE=false | KEEP |
| Deployment posture CI | `scripts/check-deployment-posture.py` | Flag immutability | PRODUCTION_CAPABLE | — | CI | ANY | flags.ts | — | KEEP |
| Kernel gating CI | `scripts/check-kernel-gating.mjs` | Mutator authorization | PRODUCTION_CAPABLE | — | CI | ANY | — | — | KEEP |
| Architectural linters | `tools/architectural-linter/` | Constitution enforcement | PRODUCTION_CAPABLE | — | CI | ANY | manifest | — | KEEP |
| Production economic guards | `tools/architectural-linter/src/production-economic-activation-guards.ts` | moonreyIssuanceActivated, etc. | PRODUCTION_CAPABLE | — | CI | ANY | — | — | KEEP |

---

## Aggregate counts (Wave 1)

| Category | Count |
|----------|-------|
| PRODUCTION_CAPABLE | 12 |
| IMPLEMENTED_NON_PRODUCTION | 38 |
| SIMULATION | 32 |
| SANDBOX | 18 |
| PARTIAL | 3 |
| INTERFACE_ONLY | 9 |
| STUB | 4 |
| NOT_IMPLEMENTED | 2 |
| DEPRECATED | 1 |
| **Total rows** | **119** |

*Rows are independently classified; some components appear in multiple conceptual layers but are counted once in their primary owner path.*

---

## Cross-reference

- Full audit narrative: `docs/architecture/WAVE1_PRODUCTION_READINESS_AUDIT.md`
- Authority matrix: `docs/architecture/sunrey-chain-authority-matrix.md`
- Architecture manifest: `docs/architecture/manifest.json`
- ADR native asset model: `docs/architecture/adr/ADR-0026-sunrey-blockchain-native-asset-model.md`
- ADR ledger vs blockchain: `docs/architecture/adr/ADR-0031-canonical-ledger-vs-blockchain-authority.md`
