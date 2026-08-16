# Build status

This document describes only what is implemented and tested in this tree.

## Implemented

- Customer domain (prospect through closed, typed status transitions, KYC state modelled not executed).
- Thirteen typed account classes, product catalog, and legal-entity records in `packages/domain`.
- Account entity with no balance field. Opening requires a verified Execution Authority.
- Money primitive (`bigint` minor units) with FLOOR / CEILING / HALF_EVEN rounding in `packages/money`.
- Action intents `OPEN_ACCOUNT`, `POST_DEPOSIT`, `POST_WITHDRAWAL`, `INTERNAL_TRANSFER`, `CREATE_BENEFICIARY`, `CREATE_FX_QUOTE`, `ACCEPT_FX_QUOTE`, `INITIATE_PAYMENT`, `CANCEL_PAYMENT` on the single `ActionIntent` envelope, plus structural well-formedness checks in `packages/permissions`.
- Compliance Kernel: six proofs, monotonic escalation, signed Execution Authority, evidence sealed on every decision.
- Deterministic policy engine and versioned jurisdiction-pack framework implemented in simulation (`packages/kernel/src/policy/`). US/GB/EU/SA/AE pack shells exist. No rule is `CONFIRMED_BY_COUNSEL`. This is not legal approval in any jurisdiction.
- In-memory ledger: balanced journals, append-only, authority-required, named class bridges, no commingling, idempotency keys.
- Simulated funding source `SIMULATION.FUNDING_SOURCE` (named simulation source; not corporate).
- Evidence Vault hash chain; versioned domain events.
- Accounts service: Kernel-gated opening, deposits, withdrawals, same-owner internal transfers.
- Read-only class-segregated balances and customer position (breakdown + grand total in one object).
- Architectural invariant linter (TypeScript + Python), extraction dry-run, deployment-posture check, kernel-gating check, secret scan, and Phase 1 exit-criterion test.
- Architecture constitution and machine-readable manifest (`docs/architecture/constitution.md`, `docs/architecture/manifest.json`) with CI checks for duplicate protected systems, illegal package dependencies, unregistered workspace packages, and authorized mutation paths. Future bounded contexts are reserved as PLANNED only.
- Chunk/capability evaluator so a later task can see whether a required capability is IMPLEMENTED, PARTIAL, PLANNED, or ABSENT. A protected requirement that is not IMPLEMENTED is a stop, not a license to reimplement.
- ADR index at `docs/architecture/adr/README.md`. ADR-0006 / 0007 / 0008 remain PROPOSED. No legal position is CONFIRMED_BY_COUNSEL.
- End-to-end demo at `packages/domain/src/demo.ts`.
- PostgreSQL persistence fabric (`packages/persistence`, `db/` migrations):
  customers, accounts (no balance column), journals, postings, action-intent
  audit, execution-authority audit (no signing secret), evidence chain, and
  domain events survive process restart. In-memory adapters remain for unit
  tests. ADR-0008 Addendum A records engineering acceptance of Option A.
- Durable event fabric (Chunk 3): canonical envelope on the existing
  `VersionedEvent` model, taxonomy, PostgreSQL transactional outbox in the
  same ledger unit as journals, consumer inbox, dead letters, explicit
  replay, and an in-process dispatcher. Events are not financial execution.
- Canonical security / cryptographic infrastructure (Chunk 4):
  `packages/security` KeyProvider, typed key purposes, lifecycle and
  rotation, AES-256-GCM envelope encryption, SecretReference /
  SecretProvider, DEVELOPMENT/SIMULATION local provider, service-identity
  foundations, redacted sensitive types, and key-metadata persistence.
  Execution Authority signs and verifies through the KeyProvider.
  Evidence Vault hashing uses the shared SHA-256 helper and stays
  deterministic. No live KMS/HSM.
- Multi-currency banking core (Chunk 8): USD/EUR/GBP/SAR/AED registry,
  currency-separated CustomerPosition, available/held/pending/settled
  semantics, Kernel-gated holds, explicit fees, compensating reversals,
  interest event framework (no product APY), statements from journals,
  reconciliation items that never auto-correct, and synthetic account
  coordinates. No FX execution and no external rails.
- Solstice Identity (`packages/identity`, `services/identity`): person/business
  identity, simulated passkey registration/authentication, sessions, device
  trust, versioned KYC metadata, capability grants, signed ActorContext.
  Accounts consume authoritative capabilities. Kernel identity proof reads
  IdentityFacts. ADR-0007 remains PROPOSED; no KYC vendor is selected.
- Compliance screening fabric (Chunk 7, `packages/kernel/src/compliance`,
  `services/compliance`): provider-neutral sanctions/PEP/adverse-media/AML/
  fraud/velocity/case control plane with deterministic simulation adapters.
  Policy packs declare required screenings. Kernel Compliance and Risk proofs
  consume the facts. No live vendor. No OFAC/UN/EU/HMT claim.
  Transaction-monitoring thresholds are engineering test rules labeled
  RESEARCH_REQUIRED.
- Canonical bank-rail adapter framework (Chunk 10, `packages/payments`):
  one `RailAdapter` port, simulated rail-class adapters, capability
  registry, provider idempotency, `SUBMISSION_UNKNOWN`, authenticated
  webhooks, inbound foundation, settlement reports, returns as
  compensating journals, and rail reconciliation. Simulation/sandbox
  architecture only. No live network membership.
- Simulated card platform (Chunk 11, `packages/cards`, `services/cards`):
  one canonical card model, processor-token references only, Kernel-gated
  authorization that reserves funds through existing banking holds,
  clearing/settlement journals, refunds, disputes, network-token metadata,
  and HMAC processor-callback security.
  No real PAN/CVV, live network, or issuer SDK.
- Personal Economic Graph (Chunk 14, `packages/personal-economic-graph`,
  `services/economic-graph`): typed nodes/edges, provenance, confidence,
  temporal facts, event-driven projection, recurring detection, goals,
  proposal-only opportunities, snapshot API, rebuildable derived
  projection, and ActorContext access control. Non-authoritative. Does
  not execute.
- Personal Economy Agent (Chunk 16, `packages/agent`): natural-language
  mandate interpretation, candidate ideas, and plan/goal explanation.
  Proposal-only. Cannot execute, post journals, or issue Execution
  Authority. Must not depend on `packages/platform`.
- Growth Orchestrator and mandate compiler (Chunk 16, `packages/platform`):
  versioned machine-verifiable mandates, user confirmation bound to
  ActorContext, deterministic feasibility and ranking, explainable
  GrowthPlans, event-driven staleness, and a non-auto-executing
  ActionIntent bridge. Does not post journals or issue Execution
  Authority. Investment candidates may now identify a simulation
  investment account or paper review; they still cannot auto-trade.
  Authority. Investment execution remains unimplemented.
- Personal Economic Value Engine (Chunk 17, `packages/platform/src/value`):
  multi-dimensional EconomicValueVector, immutable snapshots, versioned
  formulas, Growth Attribution Ledger (non-financial), realized vs
  projected separation, counterfactual baselines, double-count
  prevention, resilience/capacity/goal-progress views, and read-only
  agent/Growth access. Not a human-worth score, credit score, or
  execution authority. No money movement.
- Simulated mobile wallet provisioning and merchant SoftPOS / Tap-to-Pay
  (Chunk 12, still inside `packages/cards`): provider-neutral wallet
  port with Apple-style and Google-style simulation adapters,
  DevicePaymentToken lifecycle bound to Identity devices, Kernel-gated
  `PROVISION_CARD_TO_WALLET`, step-up via existing Identity assurance,
  authenticated token callbacks, and a separate merchant-acceptance
  module (device, session, simulated contactless result, pending
  settlement, explicit fees, ledger credit, reconciliation).
  No Apple/Google certification, EMV/NFC kernel, or acquiring license.
  Chunk 12 initially stopped while Cards was absent; it was subsequently
  resumed and is IMPLEMENTED in simulation. See
  `docs/architecture/chunk-12-stop.md` (historical) and
  `docs/architecture/chunk-12-resume.md`.
- Simulated treasury, corridor liquidity, and payment routing
  intelligence (Chunk 13, `packages/treasury`, `services/treasury`):
  system-owned treasury books (never CUSTOMER ownership),
  currency-separated positions, destination prefunding, treasury
  liquidity reservations distinct from customer holds, two-stage
  routing (compliance hard filter then deterministic scoring),
  explainable route decisions, concentration snapshots labeled
  RESEARCH_REQUIRED, settlement-exposure states, operational kill
  switches, FX inventory, Kernel-gated rebalance proposals, cash
  forecast, read-only routing simulator, and treasury reconciliation.
  Chunk 13 initially stopped on a process gate; it is now resumed.
  See `docs/architecture/chunk-13-stop.md` (historical) and
  `docs/architecture/chunk-13-resume.md`. Capability `treasury` is
  IMPLEMENTED. Bounded context TREASURY is PARTIAL simulation.
- Canonical investment account and portfolio core (Chunk 19,
  `packages/investments`, `services/investments`): Kernel-gated
  investment profiles linked to canonical `BROKERAGE_CASH` and
  `SECURITIES` accounts, authorized class-bridge funding, deterministic
  instrument fixtures, fixed-point quantity/price arithmetic, paper
  orders, simulated fills, FIFO simulation lots, realized P&L,
  valuation-only unrealized P&L, settlement records, explicit fees,
  dividend/split framework, and reconciliation that never auto-adjusts.
  Agent and Growth cannot trade. PEG/PEVE/RDT consume read ports only.
  No live broker, margin, leverage, shorting, or derivatives.
  Capability `investments` is IMPLEMENTED. Bounded context INVESTMENTS
  is PARTIAL simulation.
  is PARTIAL simulation. Pre-trade Risk is required (Chunk 20).
- Regulatory Digital Twin (Chunk 18, `packages/regulatory-twin`):
  frozen regulatory snapshots, current-vs-candidate policy evaluation,
  decision-transition matrix, batch impact analysis, invariant suites,
  product/corridor/card readiness, legal assumption register, and
  simulation evidence/events. Reuses the existing policy engine.
  Never issues Execution Authority, posts journals, or activates
  candidate packs. PEVE impact is hypothetical only. Investments are
  implemented as paper simulation (Chunk 19).
  candidate packs. PEVE impact is hypothetical only. Capability
  `regulatory-digital-twin` is IMPLEMENTED.
- Investment Risk Engine (Chunk 20, `packages/risk`): deterministic
  paper-portfolio concentration, RiskBudget, stress, cash-reserve, and
  pre-trade facts for the existing Kernel Risk proof. Does not issue
  Execution Authority or post journals. Capability `risk` is
  IMPLEMENTED.
- Model Registry (Chunk 20, `packages/model-registry`): versioned
  simulation-approval registry. No `LIVE_APPROVED`. Models cannot
  self-approve. Capability `model-registry` is IMPLEMENTED.
- Strategy Lab (Chunk 22R, `packages/strategy-lab`,
  `services/strategy-lab`): constrained strategy DSL, deterministic
  compiler, immutable market-dataset registry, reproducible backtests
  with explicit costs, train/validation/out-of-sample partitions,
  walk-forward validation, bounded experiments, overfitting warnings,
  Risk stress reuse, human-gated shadow and paper, paper kill switch,
  and no LIVE path. Mesh integration is a typed CapitalProposal port;
  Mesh cannot set the validation result. PEVE does not treat
  backtest/shadow/projected gain as realized user value. Capability
  `strategy-lab` is IMPLEMENTED. Bounded context STRATEGY_LAB is
  PARTIAL (no live trading). Historical stop:
  `docs/architecture/chunk-22-stop.md`. Resume:
  `docs/architecture/chunk-22-resume.md`.
- Agentic Capital Mesh (Chunk 21R, `packages/agentic-capital-mesh`):
  capital-intelligence and proposal system. Specialist nodes, subject-bound
  CapitalContext, structured theses, deterministic allocation compiler,
  adversarial review, and a deterministic arbiter. Cannot issue Execution
  Authority, post journals, or submit orders. Chunk 21 originally stopped
  before Chunk 20 merged; that stop is historical
  (`docs/architecture/chunk-21-stop.md`). Resume:
  `docs/architecture/chunk-21-resume.md`.
- Personal Data Vault (Chunk 23, `packages/personal-data-vault`):
  subject-bound vaults, versioned DataAssets, schema registry,
  envelope-encrypted payloads via canonical `KeyProvider`,
  provenance, access broker, consent-port integration, access audit,
  export manifest, technical deletion / crypto-shred, derivation
  lineage, PEG references without raw payload, and
  contribution-review metadata without marketplace or tokens.
  Not GDPR/CCPA/PDPL/HIPAA compliance.
- Consent Ledger and Purpose Firewall (Chunk 24, `packages/consent`):
  append-only consent history, versioned Purpose Registry, granular
  scope, subject confirmation, immutable receipts, revocation,
  expiration, deterministic Purpose Firewall (default DENY),
  short-lived signed DataUsePermits, and PDV
  `DataUseAuthorizationPort` integration. Internal services cannot
  bypass consent. Raw data-contribution transfer remains denied;
  authorized aggregate computation is the Privacy Clean Room.
  Not GDPR/CCPA/PDPL legal approval.
- Privacy Clean Room (Chunk 25R, `packages/clean-room`):
  consent-gated sessions, per-subject cohort authorization,
  minimized ephemeral PDV views, versioned query templates,
  no arbitrary SQL/code, Egress Firewall, RAW_ROW_EXPORT default
  DENY, engineering cohort/cell/dimension/budget controls,
  recipient+purpose HMAC join tokens, immutable computation
  receipts, and contribution-computation metadata without coin
  issuance. Historical stop: `docs/architecture/chunk-25-stop.md`.
  Resume: `docs/architecture/chunk-25-resume.md`. Not GDPR/CCPA/
  PDPL/HIPAA/DP/TEE compliance.
- SunRey Coin (Chunk 26R, `packages/sunrey-coin`): simulation
  economic ledger for authorized Clean Room contributions.
  `AssetQuantity` on the canonical Ledger, Kernel-gated issue /
  transfer / burn, FLOOR formula v1, derived custody positions,
  supply reconciliation without auto-correction, metadata schema
  `sunrey_coin`, and a read-only agent tool. Public ticker is
  `NOT_ASSIGNED`. Historical stop: `docs/architecture/chunk-26-stop.md`.
  Resume: `docs/architecture/chunk-26-resume.md`. Not a security,
  commodity, deposit, e-money, or priced token. SunRey Exchange
  remains PLANNED. SunRey Chain is Chunk 28.
- SunRey Chain (Chunk 28, `packages/sunrey-chain`): simulation
  trust, provenance, permission, attestation, policy, and
  settlement-anchor layer. `ChainWriteIntent` + default-deny policy
  gate, scoped subject commitments, `CHAIN_OPERATION_SIGNING`,
  in-process `SimulationChainAdapter`, async finality,
  `CHAIN_SUBMISSION_UNKNOWN`, reorg observation without ledger
  rewrite, and metadata schema `sunrey_chain`. Not a second ledger,
  wallet, exchange, or live network. Canonical ledger remains
  authoritative. ADR-0015 remains PROPOSED.
  Local deterministic node, P2P, mempool, and state sync are not
  implemented. Chunk 35 stopped: `docs/architecture/chunk-35-stop.md`.
- SunRey transaction protocol (Chunk 32R, `packages/sunrey-chain`):
  canonical actor / object / rights model, envelope v1, deterministic
  protobuf codec, domain-separated SHA-256, replay protection,
  rejection codes, and `validateStateless` / `validateStateful` /
  `apply`. Language-neutral schema and test vectors live under
  `packages/sunrey-chain/protocol/`. MoonRey issuance is unavailable.
  Public tickers remain `NOT_ASSIGNED`. Historical stop:
  `docs/architecture/chunk-32-stop.md`. Resume:
  `docs/architecture/chunk-32-resume.md`.
- SunRey Blockchain production architecture freeze (Chunk 31):
  protocol ADR pack ADR-0016–ADR-0033, authority matrix, and
  machine-readable spec at
  `docs/architecture/sunrey-blockchain-protocol.json`.
  Architecture only. Production node, consensus, P2P, and native
  execution are **not implemented**. Mainnet remains disabled.
  SunRey Coin and MoonRey Coin tickers remain `NOT_ASSIGNED`.
  MoonRey Coin is distinct and not implemented. Canonical Ledger
  remains authoritative for fiat and current Coin journals.

- Personal Data Vault (Chunk 23, `packages/personal-data-vault`):
  subject-bound vaults, versioned DataAssets, schema registry,
  envelope-encrypted payloads via canonical `KeyProvider`,
  provenance, access broker, consent-port fail-closed default,
  access audit, export manifest, technical deletion / crypto-shred,
  derivation lineage, PEG references without raw payload, and
  contribution-review metadata without marketplace or tokens.
  Not GDPR/CCPA/PDPL/HIPAA compliance. Consent Ledger is Chunk 24.

## Not implemented (present on other PRs; not in this consolidated tree)

- Chunk 34 (SunRey sovereign blockchain node core) is **stopped**.
  Latest green `main` is Chunk 30R (`#58`). Chunks 31–33 — sovereign
  chain architecture, canonical protocol/block schema, and the
  CryptoSuite registry — are not declared or merged. There is no
  local development node, no block producer, no chain state store,
  and no node CLI. See `docs/architecture/chunk-34-stop.md`.
  Do not invent `packages/sunrey-blockchain`, `packages/sunrey-node`,
  `packages/blockchain-v2`, `packages/l1`, or a competing chain.
  Do not replace `packages/sunrey-chain`. No BFT consensus, public
  network, mainnet, or MoonRey issuance. Canonical Ledger remains
  the financial source of truth.
- Kafka, Kinesis, Pub/Sub, SNS/SQS, or another production broker. The
  Chunk 3 fabric uses a simulated in-process transport behind a portable
  dispatcher port.
- Live / production policy loading of counsel-confirmed packs. ADR-0006 remains PROPOSED for human acceptance. No rule is `CONFIRMED_BY_COUNSEL`.
- Live AML/sanctions/PEP vendors, real SAR filing, and counsel-confirmed
  screening thresholds. The Chunk 7 fabric is simulation control architecture.
- Live payment rails or production ACH / instant / SWIFT / SEPA / Saudi /
  UAE network connections. Chunk 10 is simulation connectivity only.
- Phase 2–3 live FX router, ACH/FedNow/SWIFT/Saudi rails, and production liquidity.
- Compounder / Growth OS as a competing subsystem. Chunk 16 implements
  the canonical Growth Orchestrator instead.
- Live SunRey Exchange, live Travel Rule networks, live custody
  adapters, or regulated market surveillance. Chunk 30R implements
  simulation custody, Travel Rule messaging, listing governance,
  kill switches, and deterministic surveillance alerts. See
  `docs/architecture/chunk-30-resume.md`. This is not a licensed
  exchange, registered VASP, or Travel Rule compliance claim.
  Historical PRs `#18` and `#19` are not canonical.
- SunRey crypto-agility and post-quantum foundation (Chunk 33) is
  **stopped**. Chunks 31 and 32 are not merged. No crypto-suite
  registry, hybrid envelope, PQ provider, threat model, or
  cryptographic inventory was added. Canonical cryptography remains
  Chunk 4 `packages/security`. This is not a quantum-proof or
  production-certification claim. See
  `docs/architecture/chunk-33-stop.md`.
- Chunk 32 originally **stopped** on a process gate while Chunk 31
  architecture was absent. That stop is historical
  (`docs/architecture/chunk-32-stop.md`). Chunk 32R is IMPLEMENTED.
- Reserved later bounded contexts that remain PLANNED (SOVEREIGN
  CELLS and the rest listed in the constitution). PAYMENTS, FX,
  CARDS, TREASURY, INVESTMENTS, and STRATEGY LAB are PARTIAL
  simulation owners. Consent, Privacy Clean Room, SunRey Coin,
  information market, SunRey Chain, SunRey Exchange, custody, and
  market surveillance are IMPLEMENTED simulation. Live rails, live
  issuing, live wallet/SoftPOS certification, live treasury, live
  securities trading, live custody, live exchange, and a public
  ticker remain later.
- Strategy Lab (Chunk 22) is **stopped**. Risk Engine, Model Registry,
  and Agentic Capital Mesh remain `PLANNED`. Chunk 21 is not merged.
  See `docs/architecture/chunk-22-stop.md`.
- Personal Data Vault (Chunk 23, `packages/personal-data-vault`):
  subject-bound vaults, versioned DataAssets, schema registry,
  envelope-encrypted payloads via canonical `KeyProvider`,
  provenance, access broker, consent-port fail-closed default,
  access audit, export manifest, technical deletion / crypto-shred,
  derivation lineage, PEG references without raw payload, and
  contribution-review metadata without marketplace or tokens.
  Not GDPR/CCPA/PDPL/HIPAA compliance. Consent Ledger is Chunk 24.
- Privacy Clean Room (Chunk 25) originally **stopped** while Consent
  was `PLANNED`. That stop is historical
  (`docs/architecture/chunk-25-stop.md`). Chunk 25R is IMPLEMENTED.
- Reserved later bounded contexts that remain PLANNED (AGENTIC CAPITAL
  MESH, STRATEGY LAB, PYRAMID, SOVEREIGN CELLS,
  and the rest listed in the constitution).
  PAYMENTS, FX, CARDS, TREASURY, and INVESTMENTS are PARTIAL
  simulation owners. The Personal Economic Graph, Personal Economy
  Agent, Growth Orchestrator, Personal Economic Value Engine, and
  Regulatory Digital Twin are IMPLEMENTED as non-executing
  intelligence layers. Live rails, live issuing, live
  wallet/SoftPOS certification, live treasury, and live securities
  trading remain later. The investment Risk Engine is Chunk 20.
- Investment Risk Engine (`packages/risk`) and Model Registry
  (`packages/model-registry`). Both remain `PLANNED`. Chunk 21 stopped
  rather than inventing them. See `docs/architecture/chunk-21-stop.md`.
- Agentic Capital Mesh (`packages/agentic-capital-mesh`). Reserved and
  `PLANNED`. Competing `trading-agents` / `investment-agents` /
  `hedge-agent` / `capital-ai` packages must not be created.
- Reserved later bounded contexts that remain PLANNED (AGENTIC CAPITAL
  MESH, PERSONAL DATA VAULT, PYRAMID, SOVEREIGN CELLS, and the rest
  listed in the constitution). PAYMENTS, FX, CARDS, TREASURY,
  INVESTMENTS, and STRATEGY LAB are PARTIAL simulation owners. RISK
  and MODEL REGISTRY are IMPLEMENTED. The Personal Economic Graph,
  Personal Economy Agent, Growth Orchestrator, Personal Economic Value
  Engine, and Regulatory Digital Twin are IMPLEMENTED as
  non-executing intelligence layers. Live rails, live issuing, live
  wallet/SoftPOS certification, live treasury, and live securities
  trading remain later.
- Strategy Lab (Chunk 22) remains **PLANNED**. The original stop is
  historical (`docs/architecture/chunk-22-stop.md`): it ran when Risk,
  Model Registry, and Agentic Capital Mesh were still absent. Those
  three are now IMPLEMENTED. Do not start Strategy Lab until Chunk 22R.
- Reserved later bounded contexts that remain PLANNED (STRATEGY LAB,
  PERSONAL DATA VAULT, PYRAMID, SOVEREIGN CELLS, and the rest listed
  in the constitution). PAYMENTS, FX, CARDS, TREASURY, and INVESTMENTS
  are PARTIAL simulation owners. The Personal Economic Graph, Personal
  Economy Agent, Growth Orchestrator, Personal Economic Value Engine,
  Regulatory Digital Twin, Risk Engine, Model Registry, and Agentic
  Capital Mesh are IMPLEMENTED as non-executing or simulation-gated
  layers. Live rails, live issuing, live wallet/SoftPOS certification,
  live treasury, and live securities trading remain later.
- Reserved later bounded contexts that remain PLANNED (REYN COIN,
  PYRAMID, SOVEREIGN CELLS, and the rest listed in the constitution).
  PAYMENTS, FX, CARDS, TREASURY, INVESTMENTS, and STRATEGY LAB are
  PARTIAL simulation owners. RISK, MODEL REGISTRY, AGENTIC CAPITAL
  MESH, PERSONAL DATA VAULT, and CONSENT are IMPLEMENTED. The
  Personal Economic Graph, Personal Economy Agent, Growth
  Orchestrator, Personal Economic Value Engine, and Regulatory
  Digital Twin are IMPLEMENTED as non-executing intelligence layers.
  Live rails, live issuing, live wallet/SoftPOS certification, live
  treasury, and live securities trading remain later.
- SunRey local deterministic node (Chunk 34) and P2P development
  network / mempool / state sync (Chunk 35). Chunk 35 **stopped**
  because Chunk 34 is not merged. Capabilities `sunrey-local-node`
  and `sunrey-p2p` are `PLANNED`. See
  `docs/architecture/chunk-35-stop.md`. This is not a public
  testnet, mainnet, or production consensus.
- Production SunRey Blockchain node, consensus, P2P, storage, or
  native execution. Chunk 31 is an architecture freeze only.
  `packages/sunrey-chain` remains a simulation trust layer.
- MoonRey Coin runtime, ticker, or package.
- Real-money rails. Every `LIVE_*` flag is false. `ENVIRONMENT=simulation`.
  Do not create `MAINNET_ENABLED=true`, `PRODUCTION_BLOCKCHAIN=true`,
  or `LIVE_CHAIN_ENABLED=true`.

## Phase 1 exit criterion

The exit criterion is true only when all of the following can be shown in
one place, against running code, with no assertion relaxed:

1. A person can open an account, and that opening happens only with a valid Execution Authority from the Compliance Kernel.
2. A balance can be read and is segregated by class (insured deposits are not mixed with other classes).
3. Every state change in that flow produced an evidence record.
4. The evidence hash chain verifies end to end.
5. Deposit journals balance (debits equal credits).
6. A refused account opening produced evidence and created no account.

Historical note (PR #13, `docs/BUILD-STATUS.md`): on `main` at `de3c633` none of those six points held. This consolidated branch takes PR #12 as the authorization spine so those six points can be demonstrated.

## How to run

```
npm install
npm test
npm run lint:architecture
npm run lint:invariants
npm run check:extraction
npm run check:posture
npm run gate
npm run demo
npm run demo:cards
npm run demo:peg
npm run demo:wallet
npm run demo:acceptance
npm run demo:growth
npm run demo:peve
npm run demo:treasury
npm run demo:rdt
npm run demo:pdv
npm run demo:risk
npm run demo:strategy-lab
npm run demo:mesh
npm run demo:consent
npm run demo:clean-room
npm run typecheck
npm run scan:secrets
npm run ci
npm run db:up
npm run db:migrate
npm run test:persistence
npm run test:events
npm run events:outbox
npm run events:inbox
npm run events:dead-letters
npm run events:dispatch
npm run db:down
```
