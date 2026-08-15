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
  is PARTIAL simulation. Risk Engine remains Chunk 20.

## Not implemented (present on other PRs; not in this consolidated tree)

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
- Personal Economic Value Engine. `packages/platform` is shared and
  marked PARTIAL for that reserved context only.
- Reserved later bounded contexts that remain PLANNED (PYRAMID,
  SOVEREIGN CELLS, and the rest listed in the constitution). PAYMENTS,
  FX, CARDS, TREASURY, and INVESTMENTS are PARTIAL simulation owners. The Personal
  Economic Graph, Personal Economy Agent, and Growth Orchestrator are
  IMPLEMENTED as non-executing intelligence layers. Live rails, live
  issuing, live wallet/SoftPOS certification, live treasury, and live
  securities trading remain later. The investment Risk Engine is Chunk 20.
- Real-money rails. Every `LIVE_*` flag is false. `ENVIRONMENT=simulation`.

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
npm run demo:treasury
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
