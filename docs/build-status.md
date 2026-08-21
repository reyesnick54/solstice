# Build status

This document describes only what is implemented and tested in this tree.

## Implemented

- Deterministic Human Contribution Valuation Engine (Chunk 111,
  `packages/human-economic-contribution/src/valuation`): evaluates a
  VERIFIED contribution under an active versioned valuation policy.
  Capability `sunrey-human-contribution-valuation` is `IMPLEMENTED`.
  A valuation result is not settlement authorization, SunRey
  issuance, PEVE, or a human-worth score. Production remains
  unavailable. See
  `docs/economics/chunk-111-human-contribution-valuation-engine.md`.
- Human contribution to SunRey monetary evidence bridge (Chunk 108,
  `packages/sunrey-chain/src/economics/human-contribution-bridge`):
  privacy-safe adapter from verified human contributions to existing
  Chunk 71 `HumanEconomicEvidence` and `MonetaryIssuanceAuthority`.
  Capability `sunrey-human-contribution-monetary-bridge` is
  `IMPLEMENTED`. Not a second mint. Production issuance remains
  unavailable. See
  `docs/economics/chunk-108-human-contribution-monetary-bridge.md`.
- Human Information Network to Human Economic Contribution Registry
  adapter (Chunk 107,
  `packages/information-market/src/network/contribution`):
  `HinContributionAdapter` maps realized authorized HIN use onto
  privacy-safe `INFORMATION_RIGHT_CONTRIBUTION` evidence and a
  `HumanContributionRegistryPort`. Ownership or consent alone does
  not verify a contribution. HIN compensation does not mint SunRey.
  Capability `sunrey-hin-contribution-integration` is `IMPLEMENTED`.
  See `docs/economics/chunk-107-hin-contribution-integration.md`.
- S3M primary SunRey intelligence provider (Chunk 102,
  `packages/ai-runtime/src/providers/s3m`): `S3mInferenceProvider`
  satisfies the Chunk 101 `AiInferenceProvider` contract. Configurable
  transport, local simulator, structured-output normalization, health,
  bounded retries, circuit breaker, and safety events. Capability
  `sunrey-s3m-provider` is `IMPLEMENTED`. S3M is advisory /
  proposal-generation only. Grok is not implemented. The financial
  operating system remains independent from the model. See
  `docs/ai/chunk-102-s3m-provider.md`.
- SunRey advanced wallet security, recovery, device trust, and
  transaction authorization (Chunk 96,
  `packages/sunrey-chain/src/wallet/security`):
  `WalletSecurityProfile`, device binding and trust, scoped sessions,
  `SigningIntent`, spend and destination controls, delegated-key
  bindings, recovery with delay/cancel, key rotation, custody/self-
  custody boundaries, TypeScript/Rust SDK helpers,
  `sunrey-wallet security|devices|sessions|trusted-destinations|recovery|rotate-key|delegations|audit`,
  and bounded model `WALLET_AUTHORIZATION_SAFETY`. Capability
  `sunrey-wallet-security` is `IMPLEMENTED`. Application login is not
  native signing. Recovery cannot rewrite finalized transfers.
  `ENVIRONMENT` remains `simulation`. See
  `docs/wallet/chunk-96-wallet-security.md`.
- SunRey public RPC edge, high-availability Explorer, and production
  network data plane (Chunk 93,
  `packages/sunrey-chain/src/public-data-plane`): `PublicRpcGateway`,
  endpoint pool, request/quota/rate/abuse/cache policies, health
  router, bounded subscriptions, archive query, Explorer indexer
  fleet, HA query failover, public network status, TypeScript/Rust
  SDK endpoint pools, and `sunrey-ops rpc|explorer` commands.
  Capability `sunrey-public-data-plane` is `IMPLEMENTED`. RPC reads
  canonical chain state. Explorer is rebuildable and
  non-authoritative. `ENVIRONMENT` remains `simulation`. See
  `docs/network/chunk-93-public-data-plane.md`.
- SunRey validator operator platform (Chunk 92,
  `packages/sunrey-chain/src/validator-operator`):
  `ValidatorOperator`, organizations, profiles, fleet, node and
  signer inventory, enrollment over Chunk 85 dossiers, health,
  maintenance quorum safety, rolling upgrades, key-rotation
  packages, recovery, incidents, concentration, public/private
  views, authenticated operator API/CLI, and the isolated
  seven-validator rehearsal. Capability
  `sunrey-validator-operator-platform` is `IMPLEMENTED`. Operational
  projection only. Canonical validator-set state remains
  authoritative. No public delegated staking. See
  `docs/validators/chunk-92-validator-operator-platform.md`.
- SunRey executable production provider runtime (Chunk 91,
  `packages/sunrey-chain/src/provider-runtime`):
  `ExecutableProviderAdapter`, `ProviderRuntime`, sessions, credential
  bindings, local mocks, sandbox harness, KMS/HSM/PQC probes, oracle
  clients, KYC/screening/Travel Rule/custody/banking technical
  adapters, webhook security, circuit breakers, and
  `sunrey-ops provider runtime-test`. Capability
  `sunrey-provider-runtime` is `IMPLEMENTED`. Adapter success is not
  legal or commercial approval. `PRODUCTION_AUTHORIZED` remains gated
  on configured evidence and human authority. See
  `docs/providers/chunk-91-provider-runtime.md`.
- SunRey production handoff and day-2 operations control plane
  (Chunk 90, `packages/sunrey-chain/src/production-handoff`):
  `ProductionHandoffPackage`, system inventory, responsibility matrix,
  operator acceptance, engineering SLO/SLI policy, configuration
  baseline, change management, provider renewal, security-finding
  continuity, incident command, backup/restore rehearsal, evidence
  seal, readiness report, `sunrey-ops production` commands, and the
  isolated 86–90 lifecycle rehearsal. Capability
  `sunrey-production-handoff` is `IMPLEMENTED`. This is not a mainnet
  launch. `observedProduction=false`. `ENVIRONMENT` remains
  `simulation`. See `docs/mainnet/chunk-90-production-handoff.md`.
- SunRey authorized production genesis execution engine (Chunk 88,
  `packages/sunrey-chain/src/genesis-execution`):
  `ProductionLaunchPlan` bound to exact RC, Candidate V2, environment,
  ceremony, provider, audit, and pre-genesis hashes; multi-person
  `ProductionLaunchAuthorization`; single-use `LaunchExecutionPermit`
  with replay protection; launch control room; seven-validator first
  block; genesis supply audit. Isolated rehearsal identity
  `net_sunrey_genesis_execution_rehearsal_1` /
  `chn_sunrey_genesis_execution_rehearsal_1` (HRP `srger`). Capability
  `sunrey-production-genesis-execution` is `IMPLEMENTED`. This is not
  a mainnet launch. `realProductionExecutionPerformed=false`.
  `mainnetEnabled=false`. See
  `docs/mainnet/chunk-88-genesis-execution.md`.
- SunRey pre-genesis production shadow network and operational
  qualification (Chunk 87, `packages/sunrey-chain/src/pregenesis`):
  isolated identity `net_sunrey_pregenesis_shadow_1` /
  `chn_sunrey_pregenesis_shadow_1` (HRP `srpgn`), Candidate V2
  topology, Mainnet RC artifact parity, configuration-variance
  accounting, seven-validator consensus, signer fencing, redb and
  PostgreSQL recovery, oracle/Exchange/custody sandbox, burn-in
  metadata, and `sunrey-ops pregenesis` commands. Capability
  `sunrey-pregenesis-qualification` is `IMPLEMENTED`. This is not a
  mainnet launch. `mainnetEnabled=false`. See
  `docs/mainnet/chunk-87-pregenesis-qualification.md`.
- SunRey production environment provisioning control plane (Chunk 86,
  `packages/sunrey-chain/src/infra/provisioning`):
  `ProductionEnvironmentPlan` bound to the actual Chunk 81 Candidate V2
  and Chunk 84 `SUNREY_MAINNET_RC_1` cryptographic manifest, provider
  gating over Chunk 82, audit binding over Chunk 83, deterministic
  plan hash, local/rehearsal harness, and `sunrey-ops production`
  commands. Capability `sunrey-production-provisioning` is
  `IMPLEMENTED`. CI uses local/rehearsal infrastructure only.
  `productionAuthorized=false`. `mainnetEnabled=false`. See
  `docs/mainnet/chunk-86-production-provisioning.md`.
- SunRey production genesis ceremony package (Chunk 85,
  `packages/sunrey-chain/src/production-ceremony`):
  `ProductionGenesisCeremonyPlan` bound to an exact Mainnet RC and
  Candidate V2 root hash, validator dossiers and acceptance,
  simulation-labeled HSM attestation, append-only ceremony transcript,
  deterministic genesis candidate bytes, authorization package, and
  launch-authorization dossier. Dress rehearsal identity
  `net_sunrey_production_genesis_ceremony_rehearsal_1` /
  `chn_sunrey_production_genesis_ceremony_rehearsal_1` (HRP `srpgc`)
  is unusable as production input. Capability
  `sunrey-production-genesis-ceremony` is `IMPLEMENTED`. This is not
  a mainnet launch. `realProductionKeysCreated=false`.
  `mainnetEnabled=false`. See
  `docs/mainnet/chunk-85-production-genesis-ceremony.md`.
  Chunk 165 extends the same owner with frozen-candidate launch
  authorization rehearsal at
  `packages/sunrey-chain/src/production-ceremony/launch-candidate`.
  Current repository remains `REHEARSAL_COMPLETE`.
  `realHumanSignaturesCollected=false`. `mainnetEnabled=false`. See
  `docs/operations/chunk-165-launch-authorization-ceremony.md`.
- SunRey Mainnet release-candidate freeze and qualification
  (Chunk 84, `packages/sunrey-chain/src/release-candidate/mainnet`):
  versioned `SUNREY_MAINNET_RC_*` identity, source/protocol/economic/
  Candidate V2/provider/audit/HSM/PQC freeze, 38-category
  qualification matrix, formal/fuzz/adversarial/economic-stress/
  performance/seven-validator/storage/DR evidence,
  ReleaseAuthority-signed bundles, and `sunrey-release mainnet`
  commands. Capability `sunrey-mainnet-rc` is `IMPLEMENTED`.
  Mainnet RC only. `ENGINEERING_QUALIFIED` is not
  `AUTHORIZED_CANDIDATE`. `mainnetEnabled=false`. See
  `docs/releases/chunk-84-mainnet-rc.md`.
- SunRey independent security-review findings remediation (Chunk 83,
  `packages/sunrey-chain/src/audit/remediation`): ingest, triage,
  remediate, regress, retest-package, and risk-accept external
  findings without claiming an independent audit occurred.
  `TEST_FIXTURE_NOT_EXTERNAL_AUDIT` fixtures never satisfy real
  external-review readiness. Capability `sunrey-audit-remediation`
  is `IMPLEMENTED`. See `docs/audit/chunk-83-audit-remediation.md`.
- SunRey external production provider acceptance (Chunk 82,
  `packages/sunrey-chain/src/providers`): one evidence-driven
  acceptance framework over canonical infrastructure, oracle,
  regulated-service, and HSM registries. Local/sandbox contract
  tests run in CI. Production eligibility is derived from
  configured requirements. Contracts, licenses, commercial HSM
  certification, oracle data rights, banking agreements, and
  human approvals remain unfilled. AI cannot mark
  `HUMAN_ACCEPTED` or `PRODUCTION_ELIGIBLE`. Capability
  `sunrey-production-provider-acceptance` is `IMPLEMENTED`.
  See `docs/providers/chunk-82-production-provider-acceptance.md`.
- SunRey production network candidate v2 (Chunk 81,
  `packages/sunrey-chain/src/mainnet/candidate-v2`): identity
  `SUNREY_PRODUCTION_NETWORK_CANDIDATE_2` /
  `net_sunrey_production_candidate_2` /
  `chn_sunrey_production_candidate_2` (HRP `srprd`), deterministic
  protocol/economic/security/infrastructure/storage bundles, topology
  and service manifests, Candidate V1 comparison, and
  `sunrey-mainnet candidate-v2` commands. Reconciles merged Chunks
  76–80 so economic RC, treasury, stress, governance operations, and
  economic rehearsal consume canonical implementations.
  `productionAuthorized=false`. `mainnetEnabled=false`. Capability
  `sunrey-production-network-candidate` is `IMPLEMENTED`. This is not
  mainnet. `LIVE_*` flags remain false. See
  `docs/mainnet/chunk-81-production-network-candidate-v2.md`.
- SunRey complete economic mainnet rehearsal (Chunk 80,
  `packages/sunrey-chain/src/economic-rehearsal`): distinct identity
  `SunRey Economic Mainnet Rehearsal 1` /
  `net_sunrey_economic_mainnet_rehearsal_1` /
  `chn_sunrey_economic_mainnet_rehearsal_1` (HRP `srecr`),
  deterministic economic genesis, `SUNREY_ECONOMIC_RC_1`, seven-validator
  bonds/rewards/penalties, FeePolicyV2 loads, MoonRey productive
  issuance, protocol treasury, synthetic SUNREY/MOONREY Exchange,
  machine commerce, governed policy upgrades, economic stress and
  recovery, Explorer rebuild, formal traces, and
  `EconomicActivationEvidenceBundle`. Capability
  `sunrey-economic-mainnet-rehearsal` is `IMPLEMENTED`. This is not
  mainnet. `LIVE_*` flags remain false. `productionAuthorized=false`.
  See `docs/mainnet/chunk-80-economic-mainnet-rehearsal.md`.
- SunRey economic release-candidate freeze and qualification
  (Chunk 78, `packages/sunrey-chain/src/release-candidate/economic`):
  versioned `SUNREY_ECONOMIC_TESTNET_RC_*` identity, economic policy
  and schema freeze, qualification matrix, formal/stress/simulation
  evidence, seven-validator economic rehearsal, supply
  reconciliation, Chunk 67 recovery, SDK/Explorer compatibility,
  ReleaseAuthority-signed bundles, and `sunrey-release economic`
  commands. Capability `sunrey-economic-rc` is `IMPLEMENTED`.
  TESTNET / PRODUCTION-CANDIDATE qualification only. Production
  parameters remain `UNCONFIGURED`. Not mainnet authorization. See
  `docs/releases/chunk-78-economic-rc.md`.
- SunRey production governance operations (Chunk 79,
  `packages/sunrey-chain/src/governance-ops`): operational packaging,
  canonical policy diffs, preflight, human multi-person approvals,
  height/epoch activation evidence, post-activation verification,
  bounded emergency authority, Explorer/SDK/CLI surfaces, and
  `GOVERNANCE_OPERATION_SAFETY`. Capability
  `sunrey-governance-operations` is `IMPLEMENTED`. Not a governance
  token, AI authority, or finalized-history rewrite. See
  `docs/governance/chunk-79-production-governance-operations.md`.
- SunRey protocol treasury, reserves, and budget governance
  (Chunk 77, `packages/sunrey-chain/src/economics/treasury`):
  protocol-owned `SUNREY_COIN` / `MOONREY_COIN` holdings,
  governed reserve classes, versioned budget policy, reservation
  before finality, FeePolicyV2 treasury disposition, validator
  reward reserve integration, `PROTOCOL_TREASURY` formal model,
  stress catalog, Explorer/SDK/CLI read surfaces, and rehearsal-only
  units. Distinct from `packages/treasury`. No second ledger, new
  native asset, price peg, or treasury mint. Production treasury
  inactive. Capability `sunrey-protocol-treasury` is `IMPLEMENTED`.
  See `docs/economics/chunk-77-protocol-treasury.md`.
- SunRey economic stack reconciliation and adversarial stress
  laboratory (Chunk 76, `packages/sunrey-economics/src/stress` and
  `packages/sunrey-chain/src/economics/stack.ts`): FeePolicyV2
  validator rewards flow into `ValidatorEconomicsEngine`, fee burn
  uses canonical Chunk 71 burn accounting, MoonRey issuance is gated
  by `MonetaryIssuanceAuthority`, and at least 60 deterministic
  economic stress scenarios continuously check cross-subsystem
  invariants. Capability `sunrey-economic-stress-lab` is
  `IMPLEMENTED`. Simulation only. Not production authorization. See
  `docs/economics/chunk-76-economic-stress-lab.md`.
- SunRey / MoonRey dual-economy simulation laboratory (Chunk 75,
  `packages/sunrey-economics`): deterministic human/productive
  layers, economic bridge, Exchange order-flow discovery, fee and
  validator accounting, oracle-backed MoonRey issuance, scenario
  catalog, stability signals, and `DUAL_ECONOMY_MODELING`
  engineering evidence. Capability `sunrey-dual-economy-simulator`
  is `IMPLEMENTED`. Simulation only. Not a price forecast and not
  production monetary-policy activation. See
  `docs/economics/chunk-75-dual-economy-simulator.md`.
- SunRey validator bonding, reward, and accountability economics
  (Chunk 72, `packages/sunrey-chain/src/validator-economics`):
  governed `ValidatorBondPosition`, versioned reward/penalty
  policies, exclusive native bond locks, delayed unbonding,
  integer reward remainder handling, evidence-required penalties,
  customer-asset isolation, `VALIDATOR_ECONOMICS` formal model,
  economic simulator, Explorer/SDK/ops surfaces, and rehearsal
  bonds. Capability `sunrey-validator-economics` is `IMPLEMENTED`.
  Production bond asset remains `UNCONFIGURED`. No public
  delegation. See `docs/economics/`.
- SunRey dual-native-asset monetary constitution (Chunk 71,
  `packages/sunrey-chain/src/economics`): versioned
  `NativeAssetConstitution` for SunRey Coin and MoonRey Coin,
  genesis/issuance/burn policy, exact supply accounting,
  `MonetaryIssuanceAuthority`, privacy-safe human-economic evidence,
  `MonetaryPolicySimulator` (`ENGINEERING_SIMULATION` only),
  `sunrey-economics` auditors, Explorer/SDK read APIs, and Chunk 61
  formal models `NATIVE_MONETARY_POLICY` and
  `GENESIS_ALLOCATION_CONSERVATION`. Production quantities remain
  `UNCONFIGURED`. Tickers remain `NOT_ASSIGNED`. Capability
  `sunrey-monetary-constitution` is `IMPLEMENTED`. See
  `docs/economics/`.
- SunRey full mainnet launch rehearsal (Chunk 70,
  `packages/sunrey-chain/src/launch-rehearsal`): distinct rehearsal
  identity `net_sunrey_mainnet_rehearsal_1` /
  `chn_sunrey_mainnet_rehearsal_1` (`SunRey Mainnet Rehearsal 1`),
  seven-validator BFT dry run, 14 sentries, three failure domains,
  signer fencing, production-candidate storage/postgres profile,
  oracle and Exchange/custody sandbox workflows, failure injection
  and recovery, `LaunchControlRoomState`, findings, and an updated
  future ActivationPlan. Capability `sunrey-launch-rehearsal` is
  `IMPLEMENTED`. This is not mainnet. `LIVE_*` flags remain false.
  See `docs/mainnet/chunk-70-launch-rehearsal.md`.
- SunRey Exchange and custody production-candidate regulated adapters
  (Chunk 69, `packages/sunrey-exchange/src/regulated`,
  `packages/custody/src/regulated`, `packages/kernel/src/regulated`,
  `packages/security/src/regulated`,
  `packages/sunrey-chain/src/mainnet/regulated-feed.ts`): provider
  registry, explicit activation modes, KYC/screening/Travel Rule/HSM
  ports, withdrawal gate, segregation reconciliation, market access,
  listing governance, surveillance/case export, and Chunk 65
  readiness feed. Capability `sunrey-regulated-integration` is
  `IMPLEMENTED`. No live regulated services. `LIVE_*` flags remain
  false. See `docs/regulated/`.
- SunRey production-candidate oracle onboarding and collection
  (Chunk 68, `packages/sunrey-chain/src/oracle/production`): provider
  onboarding, versioned data sources, off-chain collector, SecretReference
  credentials, software/KMS/HSM signing interfaces, schema validation,
  integer normalization, provenance, independence, concentration,
  quality, quorum, MoonRey eligibility, incident controls, Explorer
  public feed metadata, and seven-validator E2E. Capability
  `sunrey-production-oracles` is `IMPLEMENTED`. Consensus never calls
  HTTP. Missing agreements are never confirmed. Oracle facts never
  mint MoonRey.
- SunRey production infrastructure and secret controls (Chunk 66,
  `packages/sunrey-chain/src/infra`): provider-neutral provider
  registry, workload identity, classified secrets over
  `SecretReference`, KMS/HSM adapters, network zones, TLS/DNS/object
  storage/container digest interfaces, OpenTofu-style and Helm
  modules, and a local CI harness. Chunk 61–65 evidence is reconciled
  with exact artifact digests. Capability
  `sunrey-production-infrastructure` is `IMPLEMENTED`. This is not
  mainnet. `LIVE_*` flags remain false. See `docs/infrastructure/`.
- SunRey mainnet readiness and genesis-candidate controls (Chunk 65,
  `packages/sunrey-chain/src/mainnet`): 26 readiness dimensions, a
  per-capability activation matrix, production-candidate identity
  `net_sunrey_production_candidate_1` / `chn_sunrey_production_candidate_1`
  with HRP `srprd`, deterministic zero-allocation genesis candidate,
  seven simulated validator candidates, human-only authorization,
  external evidence slots left incomplete, and an activation plan that
  does not launch infrastructure. Capability `sunrey-mainnet-readiness`
  is `IMPLEMENTED`. This is not mainnet. `LIVE_*` flags remain false.
  See `docs/mainnet/`.
- SunRey post-genesis stabilization and progressive capability
  activation (Chunk 89, `packages/sunrey-chain/src/post-genesis`):
  governed phases starting at `CHAIN_STABILIZATION`, deterministic
  height/epoch/finalized-state checkpoints, independent capability
  packages, bounded restrictions, and rehearsal-only activation
  negatives. Capability `sunrey-post-genesis-stabilization` is
  `IMPLEMENTED`. Chunk 166 extends that owner with staged capability
  activation at `packages/sunrey-chain/src/post-genesis/staged-activation`.
  `realProductionCapabilitiesActivated=false`. This is
  not mainnet. `LIVE_*` flags remain false. See
  `docs/mainnet/chunk-89-post-genesis-stabilization.md` and
  `docs/operations/chunk-166-staged-capability-activation.md`.
- SunRey root-of-trust and key-ceremony architecture (Chunk 64,
  `packages/security/src/ceremony`): authority registry, key-purpose
  matrix, extended HSM contract, simulation ceremony provider,
  multi-person approvals, attestations, tamper-evident transcripts,
  genesis binding, rotation/compromise workflows, and
  `sunrey-ceremony` rehearsal. Simulation only. Not a completed
  production ceremony and not a commercial HSM claim.
- SunRey Testnet release-candidate freeze, qualification, and release
  control (Chunk 63, `packages/sunrey-chain/src/release-candidate`):
  versioned `SUNREY_TESTNET_RC_*` ids, protocol/API/crypto/dependency/
  artifact freeze, qualification matrix, seven-validator and recovery
  rehearsals, ReleaseAuthority-signed bundles, and `sunrey-release rc`
  commands. TESTNET only. Tickers remain `NOT_ASSIGNED`. No status
  implies mainnet readiness.
- SunRey formal protocol models (Chunk 61,
  `packages/sunrey-chain/formal`, `packages/sunrey-chain/src/formal`,
  `packages/sunrey-chain/rust/crates/formal`): TLA+/TLC models for
  consensus, signer, validator-set, governance, native assets, fees,
  Exchange DVP, MoonRey issuance, interop, and CryptoPolicy;
  `FORMAL_SMOKE` / `FORMAL_EXTENDED` profiles; implementation-trace
  conformance; selected Rust bounded harnesses. Model checked within
  stated bounds. Not whole-system formal verification.

- SunRey fuzzing and deterministic property assurance (Chunk 56,
  `packages/sunrey-chain/src/assurance`,
  `packages/sunrey-chain/rust/crates/assurance`, `tests/assurance`):
  protocol/parser fuzz, consensus and economic property campaigns,
  TypeScript/Rust differential cases, replay fixtures, and
  `FUZZ_SMOKE` / `FUZZ_EXTENDED` profiles. Not formal verification.

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
  Authority. Must not depend on `packages/platform`. Chunk 100
  Human Information preference management requires an explicit
  `MANAGE_HUMAN_INFORMATION_PREFERENCES` mandate; a generic
  financial-agent mandate is insufficient.
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
  Local deterministic node is Chunk 34R at
  `packages/sunrey-chain/rust`. P2P, mempool, and state sync are
  implemented at `packages/sunrey-chain/node` (Chunk 35R).
  Historical stop: `docs/architecture/chunk-35-stop.md`. Resume:
  `docs/architecture/chunk-35-resume.md`. Validator lifecycle
  (Chunk 36R) is `IMPLEMENTED`: `docs/architecture/chunk-36-resume.md`.
  Development Tendermint-class BFT (Chunk 37) is implemented at
  `packages/sunrey-chain/rust/crates/consensus`. Networked
  four-validator finality is Chunk 38 at
  `packages/sunrey-chain/node`. Production BFT is not implemented.
  Chunk 44 implements the derived Global Productive Capacity Graph
  and development MoonRey issuance from verified productive
  contributions at `packages/sunrey-chain/src/productive` and
  `packages/sunrey-chain/rust/crates/productive`. Capabilities
  `sunrey-productive-capacity` and `moonrey-issuance-engine` are
  `IMPLEMENTED`. Public ticker remains `NOT_ASSIGNED`.
- SunRey transaction protocol (Chunk 32R, `packages/sunrey-chain`):
  canonical actor / object / rights model, envelope v1, deterministic
  protobuf codec, domain-separated SHA-256, replay protection,
  rejection codes, and `validateStateless` / `validateStateful` /
  `apply`. Language-neutral schema and test vectors live under
  `packages/sunrey-chain/protocol/`. Arbitrary MoonRey `ISSUE`
  remains unavailable. Chunk 44 issues development MoonRey only
  from verified productive contributions. Public tickers remain
  `NOT_ASSIGNED`. Historical stop:
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
- SunRey local development node (Chunk 34R, `packages/sunrey-chain/rust`):
  deterministic genesis, admission, SYSTEM / EVIDENCE_ANCHOR
  execution, crash-safe file store, and `DEV_BLOCK_PRODUCER`.
  Capability `sunrey-local-node` is `IMPLEMENTED`. Production BFT,
  public network, and MoonRey issuance are not implemented.
  Historical stop: `docs/architecture/chunk-34-stop.md`. Resume:
  `docs/architecture/chunk-34-resume.md`.
- SunRey validator control plane (Chunk 36R, `packages/sunrey-chain`):
  versioned validator registry, deterministic lifecycle, integer
  voting power, epoch-boundary set transitions, key-role
  separation, CryptoSuite-routed consensus signer, durable
  double-sign protection, equivocation evidence types, and a
  four-validator development set. Capability `sunrey-validators`
  is `IMPLEMENTED`. Historical stop:
  `docs/architecture/chunk-36-stop.md`. Resume:
  `docs/architecture/chunk-36-resume.md`. Not production BFT,
  public staking, slashing, or MoonRey issuance.

- Personal Data Vault (Chunk 23, `packages/personal-data-vault`):
  subject-bound vaults, versioned DataAssets, schema registry,
  envelope-encrypted payloads via canonical `KeyProvider`,
  provenance, access broker, consent-port fail-closed default,
  access audit, export manifest, technical deletion / crypto-shred,
  derivation lineage, PEG references without raw payload, and
  contribution-review metadata without marketplace or tokens.
  Not GDPR/CCPA/PDPL/HIPAA compliance. Consent Ledger is Chunk 24.

## Not implemented (present on other PRs; not in this consolidated tree)

- Production BFT consensus, public SunRey network, mainnet, or
  MoonRey issuance. Chunk 34R is a local development node only.
  Do not invent `packages/sunrey-blockchain`, `packages/sunrey-node`,
  `packages/blockchain-v2`, `packages/l1`, or a competing chain.
  Do not replace `packages/sunrey-chain`. Canonical Ledger remains
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
  `docs/architecture/chunk-30-resume.md`. Chunk 47 extends the
  same custody owner with institutional native-asset vaults and
  non-exportable signers. This is not a licensed
  exchange, registered VASP, or Travel Rule compliance claim.
  Historical PRs `#18` and `#19` are not canonical.
- Production PQC library, production chain node, MoonRey issuance,
  a public ticker, and a production chain database remain later.
  Chunk 33R implements the CryptoSuite foundation at
  `packages/security` (not quantum-proof; not certified). Historical
  stop: `docs/architecture/chunk-33-stop.md`. Implementation:
  `docs/architecture/chunk-33-crypto-agility.md`.
  Chunk 32 originally **stopped** on a process gate while Chunk 31
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
- Production SunRey Blockchain consensus, public testnet, or
  mainnet. Chunk 35R implements a **development** P2P / mempool /
  sync plane at `packages/sunrey-chain/node`. Historical stop:
  `docs/architecture/chunk-35-stop.md`. Resume:
  `docs/architecture/chunk-35-resume.md`. This is not a public
  testnet, mainnet, or production consensus.
- Production SunRey BFT consensus, public staking, customer-asset
  slashing, or MoonRey issuance. Chunk 36R implements the
  **development** validator registry and signer safety. Chunk 37
  implements the **development** Tendermint-class engine. Chunk 38
  networks that engine across four validator processes. Chunk 39
  implements simulation equivocation evidence, jail, tombstone, and
  integer bond penalties. See
  `docs/architecture/chunk-38-networked-consensus.md` and
  `docs/architecture/chunk-39-validator-accountability.md`.
  Production validators, public staking, and mainnet remain not
  implemented.
- SunRey protocol governance (Chunk 40) is **development-only**
  at `packages/sunrey-chain`. Capability
  `sunrey-protocol-governance` is `IMPLEMENTED`. Height-activated
  `UpgradePlan`. No governance token. Production governance is
  not implemented. ADR-0028 is implemented for development.
- SunRey machine economic identity and commerce (Chunk 45) is
  **development-only** at `packages/sunrey-chain/src/machine-economy`.
  Capability `sunrey-machine-economy` is `IMPLEMENTED`. Machines
  are controller-bound and capability-limited. They cannot
  validate, govern, or issue MoonRey.
- SunRey Universal Economic Exchange (Chunk 49) extends
  `packages/sunrey-exchange` with four market families: native
  digital assets, permissioned human-information rights,
  intelligence/compute, and productive capacity. Two-stage
  eligibility, governed order types, batch auction, native DVP,
  delivery-versus-right, and exact oracle partial settlement.
  Capability `sunrey-exchange` remains `IMPLEMENTED`. No second
  exchange. Simulation only.
- SunRey Exchange market operations (Chunk 95,
  `packages/sunrey-exchange/src/ops`): institutional gateway,
  sequenced market data, liquidity metrics, market-maker sessions,
  circuit breakers, and reopening auctions. Capability
  `sunrey-exchange-market-operations` is `IMPLEMENTED`. Production
  activation remains unlicensed without external authorization.
- SunRey Human Information Network (Chunk 100,
  `packages/information-market/src/network`): production-candidate
  rights, consent, clean-room, compensation, requester, and user
  control-center interfaces. Capability
  `sunrey-human-information-network` is `IMPLEMENTED`. Sensitive
  source data remains off-chain. No human-worth or social-credit
  score. `productionActivated` remains false without privacy/legal
  human authorization.
- SunRey AI runtime (Chunk 101, `packages/ai-runtime`):
  provider-neutral inference plane behind the Financial Agent.
  Capability `sunrey-ai-runtime` is `IMPLEMENTED`. S3M is the
  intended primary intelligence engine. xAI/Grok is reserved for
  Chunk 103 and is not networked. LocalTest is deterministic and
  offline. Providers cannot execute payments, trades, mint, or
  sign. Tool intents enter `packages/sunrey-agent` as proposals.
- SunRey consumer Exchange (Chunk 99,
  `packages/sunrey-exchange/src/consumer`): consumer portfolio,
  indicative quotes, trade preview, buy/sell/convert with price
  protection, wallet/mobile authorization, sandbox, and DVP
  settlement projection. Capability
  `sunrey-exchange-consumer-trading` is `IMPLEMENTED`. Production
  consumer trading remains unlicensed without external
  authorization. No second Exchange or balance store.
- SunRey oracle network (Chunk 43) is **development-only** at
  `packages/sunrey-chain`. Capability `sunrey-oracle-network` is
  `IMPLEMENTED`. Signed observations become time-bounded
  `VerifiedEconomicFact`s. Consensus never calls external APIs.
  Facts are not money. ADR-0027 is implemented for development.
- SunRey dual native assets (Chunk 41) at
  `packages/sunrey-chain/rust/crates/native-assets` and
  `packages/sunrey-chain/node`. Capability `sunrey-native-assets`
  is `IMPLEMENTED`. `SUNREY_COIN` and `MOONREY_COIN` are distinct
  protocol-native assets (precision 6). Tickers remain
  `NOT_ASSIGNED`. Development faucet issues
  `DEVELOPMENT_ECONOMIC_UNIT` only. Application SunRey Coin
  supply is not imported. ADR-0026 is implemented for
  development chain-native units. Production migration is not
  performed.
- SunRey native fees and resource metering (Chunk 42) are
  **development-only** at `packages/sunrey-chain`. Capability
  `sunrey-native-fees` is `IMPLEMENTED`. Integer resource units,
  reserved/charged/released native-asset fees, governed fee
  parameters. FeeIntent attaches beside the Chunk 41 payload.
  No fiat ledger debit. MoonRey remains disabled as
  a fee asset until a height-activated policy change.
- Institutional native-asset custody (Chunk 47, `packages/custody`):
  `CustodyVault`, segregated/omnibus/hot/warm/cold classifications,
  `InstitutionalSigningProvider`, development HSM/KMS simulator at
  `packages/security`, native-chain deposit indexer, dual-control
  approval, withdrawal lifecycle including `SUBMISSION_UNKNOWN`,
  cold-signing packages, exact reconciliation, and the Chunk 48
  exchange custody port. Capability
  `sunrey-institutional-custody` is `IMPLEMENTED`. Not a second
  asset ledger. Simulation only. See
  `docs/architecture/chunk-47-institutional-custody.md`.
- SunRey sovereign wallets (Chunk 46) are **development-only**
  at `packages/sunrey-chain/src/wallet` and
  `packages/sunrey-chain/rust/crates/wallet`. Capability
  `sunrey-sovereign-wallets` is `IMPLEMENTED`. Versioned
  addresses, BlockchainAccount authorization, M-of-N, recovery
  with height delay, delegated keys, watch-only, and a local
  encrypted development keystore. Wallet metadata is not a
  second native-asset ledger and not a fiat Account.
- SunRey mobile wallet synchronization (Chunk 97) is
  **development-only** at
  `packages/sunrey-chain/src/wallet/mobile-sync`. Capability
  `sunrey-mobile-wallet-sync` is `IMPLEMENTED`. Snapshot/delta
  sync, multi-device sessions, BFT finality, offline drafts,
  privacy-safe push ports, and versioned payment requests.
  Backend sync is not a second ledger and does not hold
  self-custody master keys.
- SunRey adversarial range (Chunk 57, `packages/sunrey-range`):
  isolated 7-validator cyber-economic test range. Capability
  `sunrey-adversarial-range` is `IMPLEMENTED`. Deterministic
  replay only. Detector output is not legal guilt. Chunk 157
  extends the same owner with a production-safety campaign
  (`--production-safety-smoke` / `--production-safety-extended`).
  Isolated defensive fixtures only. No live pentest, external
  targets, or real credentials. See
  `docs/architecture/chunk-57-adversarial-range.md`,
  `docs/security/chunk-157-production-adversarial-resilience.md`,
  and `docs/assurance/`.
- SunRey developer platform (Chunk 51, `packages/sunrey-sdk`):
  versioned public API `v1`, TypeScript SDK, Rust client crate
  at `packages/sunrey-chain/rust/crates/sdk`, SSE/JSON events,
  local signing, faucet, and Exchange read/write adapters.
  Capability `sunrey-developer-sdk` is `IMPLEMENTED`. Adapter
  only. Private keys never go to public RPC. See
  `docs/architecture/chunk-51-developer-platform.md` and
  `docs/developers/README.md`.
- SunRey developer application platform (Chunk 94,
  `packages/sunrey-sdk/src/developer-platform`): application registry,
  scoped API credentials, signed webhooks, quotas, Testnet faucet
  controls, sandbox identities, and local devnet. Capability
  `sunrey-developer-platform` is `IMPLEMENTED`. Developer credentials
  cannot sign user funds. Production application registration does
  not activate production financial capabilities. See
  `docs/architecture/chunk-94-developer-platform.md` and
  `docs/developers/chunk-94-developer-platform.md`.
- Production SunRey Blockchain node, consensus, P2P, storage, or
  native execution. Chunk 31 is an architecture freeze only.
  `packages/sunrey-chain` remains a simulation trust layer.
- Public MoonRey Coin ticker or competing `packages/moonrey-coin`.
  Chunk 44 implements development MoonRey issuance from verified
  productive contributions at `packages/sunrey-chain`. Capability
  `moonrey-issuance-engine` is `IMPLEMENTED`. Ticker remains
  `NOT_ASSIGNED`. See
  `docs/architecture/chunk-44-productive-capacity-moonrey.md`.
- MoonRey Coin application package, public ticker, or production
  economic issuance. Chunk 41 registers MoonRey as a
  protocol-native development asset only.
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
npm run demo:sunrey-wallet
npm run demo:sunrey-sdk
npm run demo:sunrey-mainnet
npm run sunrey-mainnet -- readiness
npm run demo:sunrey-economics
npm run sunrey-monetary -- policy verify
npm run sunrey-monetary -- supply verify
npm run sunrey-economics -- dual simulate --scenario baseline --epochs 2
npm run sunrey-economics -- stress campaign --id smoke
npm run demo:sunrey-economic-stress
npm run demo:sunrey-rc
npm run sunrey:dev
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
