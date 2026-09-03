# SunRey Final Platform Capability Matrix

**Program:** Wave 9 — Adversarial Testing / Mainnet Readiness  
**Date:** 2026-09-02  
**Environment:** `simulation` — all `LIVE_*` flags `false`  
**Scope:** Full-stack engineering assessment for controlled production preparation and external audit readiness.  
**Does NOT authorize:** mainnet, live issuance, regulated services, or production activation.

## Status legend

| Status | Meaning |
| --- | --- |
| **PRODUCTION_READY** | Implemented, tested, and suitable for production deployment with external gates satisfied |
| **AUDIT_READY** | Engineering-complete enough for external security/economic audit scope |
| **SANDBOX_READY** | Safe for isolated sandbox/testnet rehearsal with fixture providers |
| **EXTERNAL_PROVIDER_REQUIRED** | Architecture exists; live operation requires authorized external provider |
| **REGULATORY_APPROVAL_REQUIRED** | Engineering blocked on counsel/regulatory promotion |
| **PARTIAL** | Substantial implementation with documented gaps |
| **SIMULATION** | Deterministic simulation/fixture behavior only |
| **INTERFACE_ONLY** | Port/schema defined; production binding absent |
| **BLOCKED** | Explicitly gated; activation forbidden |
| **NOT_IMPLEMENTED** | Not present in canonical owner |

---

## Blockchain

| Capability | Status | Evidence |
| --- | --- | --- |
| Deterministic state machine | SANDBOX_READY | `rust/crates/state`, `node/tests/determinism.rs` |
| Block model & commitments | SANDBOX_READY | `rust/crates/protocol`, `src/blocks/` |
| Transaction root | SANDBOX_READY | Deterministic `transaction_root` |
| Native asset isolation | SANDBOX_READY | `SUNREY_COIN` / `MOONREY_COIN` separate books |
| Reorg handling | SANDBOX_READY | `REORG_OBSERVED` — no journal rewrite |
| Public mainnet | BLOCKED | Chunks 164–167, ceremony, counsel |
| Production genesis | BLOCKED | Rehearsal only; `production_migration_performed=false` |

## Validators

| Capability | Status | Evidence |
| --- | --- | --- |
| Validator identities | SANDBOX_READY | `rust/crates/validators` |
| Local four-validator harness | SANDBOX_READY | BFT simulation |
| Geographic production network | NOT_IMPLEMENTED | Dev harness only |
| Validator economics | SIMULATION | `validator-economics/` |

## Consensus

| Capability | Status | Evidence |
| --- | --- | --- |
| BFT consensus engine | SANDBOX_READY | `rust/crates/consensus` |
| Commit certificates | SANDBOX_READY | `protocol/finality.rs` |
| Production fault domains | NOT_IMPLEMENTED | Local simulation |
| Eclipse resistance | NOT_IMPLEMENTED | ADR recorded; no implementation |

## Finality

| Capability | Status | Evidence |
| --- | --- | --- |
| Finality semantics | SANDBOX_READY | `FINALIZED` on `CommitCertificate` only |
| Validator-only issuance | BLOCKED | Consensus ≠ monetary authorization (ADR-0017/0018) |
| Finality delay alerting | SIMULATION | `docs/operations/alerts.md` |

## Transactions

| Capability | Status | Evidence |
| --- | --- | --- |
| Signed envelopes | SANDBOX_READY | `rust/crates/protocol` |
| Replay protection | PARTIAL | Session-scoped; durable gaps on some replay keys |
| Cross-network guards | SANDBOX_READY | `network_id` / `chain_id` registry |

## Native Assets

| Capability | Status | Evidence |
| --- | --- | --- |
| Asset taxonomy | SANDBOX_READY | Chunk 71 constitution |
| Supply reconciliation | SANDBOX_READY | `supplyReconciles()`, `npm run sunrey-economics -- supply verify` |
| Dual-authority migration | BLOCKED | Ledger vs chain; `production_migration_performed=false` |

## SunRey (Human Economy)

| Capability | Status | Evidence |
| --- | --- | --- |
| Contribution ontology | SANDBOX_READY | `human-economic-contribution` |
| PEVE valuation | SIMULATION | Engineering reference; not production valuation |
| Human contribution bridge | SANDBOX_READY | Chunk 108; `refuseStandaloneAttempt()` |
| Anti-replay issuance | PARTIAL | In-memory replay keys; durable persistence incomplete |
| Attestation mesh | SANDBOX_READY | `HumanContributionAttestationMesh`; no mint authority |
| Live HIN issuance | BLOCKED | `LIVE_HIN_BASED_ISSUANCE_ENABLED=false` |

## MoonRey (Productive Economy)

| Capability | Status | Evidence |
| --- | --- | --- |
| Productive ontology | SANDBOX_READY | Wave 5 pipeline |
| Oracle mesh | SIMULATION | Fixture transports; quorum in-memory |
| Attribution / GPUV / settlement | SANDBOX_READY | Governed V2 path |
| Production MoonRey issuance | BLOCKED | `moonreyIssuanceActivated(): false`, Chunk 143 |
| Live productive issuance | BLOCKED | `LIVE_MOONREY_PRODUCTIVE_ISSUANCE_ENABLED=false` |

## Economic Proof

| Capability | Status | Evidence |
| --- | --- | --- |
| CanonicalEconomicClaim | SANDBOX_READY | `src/economic-proof/types.ts` |
| EconomicClaimRegistry | PARTIAL | In-memory; PostgreSQL port exists |
| MonetizationLock | PARTIAL | In-memory; cross-restart durability gap |
| EconomicProofBundle | SANDBOX_READY | `economics/proof-bound/bundle.ts` |
| Five-root commitment | SANDBOX_READY | `economic-proof/roots/five-root.ts` |
| Block header root wiring | PARTIAL | Extension slots defined; not all blocks populated in dev |

## Economic Awareness

| Capability | Status | Evidence |
| --- | --- | --- |
| Provider registry | SANDBOX_READY | `packages/provider-sdk` |
| Economic data fabric | SANDBOX_READY | Chunk 138 |
| Trust engine | SANDBOX_READY | Independent source analysis |
| Information consensus | PARTIAL | Oracle + HIN paths; unified federation incomplete |
| Federated query | PARTIAL | Cross-domain queries partial |
| Fabric durable journal | PARTIAL | In-memory store with replay idempotency in simulation |

## Human Economy (intelligence)

| Capability | Status | Evidence |
| --- | --- | --- |
| Contribution registry | SIMULATION | In-memory default |
| Sybil resistance | PARTIAL | Fingerprint + alias; cross-source gaps documented |
| Human-worth firewall | SANDBOX_READY | All `humanWorthScore` paths reject |
| Privacy in claims | SANDBOX_READY | `FORBIDDEN_PERSONAL_KEYS` |

## Productive Economy (intelligence)

| Capability | Status | Evidence |
| --- | --- | --- |
| Productive claims | SANDBOX_READY | Wave 5 ontology |
| Capacity vs output guards | SANDBOX_READY | `CAPACITY_IS_NOT_OUTPUT` |
| Double attribution controls | SANDBOX_READY | Adversarial range `PRODATT-*` scenarios |
| Shadow economics | SIMULATION | Rehearsal only |

## PEVE

| Capability | Status | Evidence |
| --- | --- | --- |
| Valuation constitution | SANDBOX_READY | Separate from issuance quantity |
| PEVE → SunRey quantity | BLOCKED | `PEVE_SCORE_CANNOT_BECOME_ISSUANCE_QUANTITY` |
| Production valuation | BLOCKED | Candidate policies only |

## GPUV

| Capability | Status | Evidence |
| --- | --- | --- |
| Productive value function | SANDBOX_READY | Policy-governed |
| GPUV → MoonRey quantity | BLOCKED | `GPUV_ALONE_CANNOT_ISSUE` |
| Exchange price substitution | BLOCKED | `REFERENCE_PRICE_NOT_PRODUCTIVE_OUTPUT` |

## Oracle Mesh

| Capability | Status | Evidence |
| --- | --- | --- |
| Provider families | SANDBOX_READY | Energy, compute, logistics, etc. |
| Certification sandbox | SANDBOX_READY | Chunk 128 |
| Live provider connectivity | BLOCKED | `REAL_PROVIDER_CONTACTED=false` |
| Direct mint authority | BLOCKED | `ORACLE_OBSERVATION_CANNOT_MINT` |

## Attestation Mesh

| Capability | Status | Evidence |
| --- | --- | --- |
| Human attestation verification | SANDBOX_READY | `HumanContributionAttestationMesh` |
| Independent lineage roots | SANDBOX_READY | Promotion to VerifiedEconomicFact |
| Direct SunRey mint | BLOCKED | `attestationMeshCreatesMoney(): false` |

## Policy

| Capability | Status | Evidence |
| --- | --- | --- |
| Kernel policy engine | SANDBOX_READY | Six proofs, monotonic combine |
| PolicyRoot | SANDBOX_READY | Deterministic `policyRoot()` |
| OPA / OpenFGA | NOT_IMPLEMENTED | ADR scope; Kernel engine used |
| Production policy promotion | REGULATORY_APPROVAL_REQUIRED | `RESEARCH_REQUIRED` corridors |

## Identity

| Capability | Status | Evidence |
| --- | --- | --- |
| SunRey Identity | SANDBOX_READY | `packages/identity` |
| Session / token model | SANDBOX_READY | 15m TTL, revoke, step-up |
| Live KYC vendors | EXTERNAL_PROVIDER_REQUIRED | Fixture adapters only |
| Federation (Keycloak) | NOT_IMPLEMENTED | Simulation adapters |

## Privacy

| Capability | Status | Evidence |
| --- | --- | --- |
| PDV encryption | SANDBOX_READY | Subject-bound store |
| Log redaction | SANDBOX_READY | `safe-logging.ts`, API logging tests |
| On-chain PII firewall | SANDBOX_READY | `scanForForbiddenBlockPayload` |
| Differential privacy | NOT_IMPLEMENTED | Future wave |
| ZK / VC production | INTERFACE_ONLY | Simulation stubs |

## Wallet

| Capability | Status | Evidence |
| --- | --- | --- |
| Wallet projections | SANDBOX_READY | Reconcile to ledger/chain |
| Mobile sync | SIMULATION | Chunk 97 rehearsal |
| User key compromise containment | PARTIAL | Per-user scope; endpoint risk remains |

## Ledger

| Capability | Status | Evidence |
| --- | --- | --- |
| Append-only journals | PRODUCTION_READY | Kernel-gated `postJournal` |
| Execution Authority | PRODUCTION_READY | HMAC, short-lived, scoped |
| Balance read from ledger | PRODUCTION_READY | No `Account.balance` column |
| Application SunRey Coin | SIMULATION | Separate from native chain supply |

## Exchange

| Capability | Status | Evidence |
| --- | --- | --- |
| Matching engine | SANDBOX_READY | Off-chain simulation |
| Settlement idempotency | SANDBOX_READY | Tests + adversarial scenarios |
| Native asset mint | BLOCKED | `refuseUnauthorizedIssuance()` |
| Market price → issuance | BLOCKED | Invariant `REFERENCE_PRICE_NOT_PRODUCTIVE_OUTPUT` |
| Production market ops | BLOCKED | Institutional path simulation |

## Grow Agents

| Capability | Status | Evidence |
| --- | --- | --- |
| ProposalGate | SANDBOX_READY | Structural isolation |
| Mandate narrowing | SANDBOX_READY | Cannot expand authority |
| Execution Authority issuance | BLOCKED | Agent ALLOW ≠ EA |
| Prompt injection defenses | PARTIAL | Detection + refusal; ongoing red-team |

## Vault

| Capability | Status | Evidence |
| --- | --- | --- |
| Personal Data Vault | SANDBOX_READY | Encrypted subject store |
| Consent ledger | PARTIAL | Wins over chain; durable migration incomplete |
| Revocation | SANDBOX_READY | Stops future access |
| Evidence Vault | SANDBOX_READY | Hash-chained |

## API

| Capability | Status | Evidence |
| --- | --- | --- |
| Platform API `/api/v1` | SANDBOX_READY | Orchestration only |
| Consumer BFF | SANDBOX_READY | Wave 7 product wiring |
| Kernel → postJournal on all mutations | PARTIAL | Wave 8 gap on some HTTP paths |
| API mint authority | BLOCKED | No `authorizeIssuance` on API surface |

## Frontend

| Capability | Status | Evidence |
| --- | --- | --- |
| Consumer surfaces | SANDBOX_READY | BFF-mediated |
| Frontend mint | BLOCKED | `refuseForbiddenMutator(FRONTEND)` |
| Sensitive data in payloads | SANDBOX_READY | Reference-only external data |

## Admin

| Capability | Status | Evidence |
| --- | --- | --- |
| Control room read model | SANDBOX_READY | Read-only |
| Admin monetary bypass | BLOCKED | No admin mint path |
| Break-glass | SIMULATION | Evidence-sealed; time-bound |

## Governance

| Capability | Status | Evidence |
| --- | --- | --- |
| Chunk 71 monetary constitution | SANDBOX_READY | Sole mint gate |
| Production activation firewall | SANDBOX_READY | Chunk 143; `productionActivated: false` |
| Launch freeze / ceremony | BLOCKED | Chunks 164–165 rehearsal only |
| Counsel-confirmed corridors | REGULATORY_APPROVAL_REQUIRED | All `RESEARCH_REQUIRED` |

## Observability

| Capability | Status | Evidence |
| --- | --- | --- |
| Metrics & alerts | SANDBOX_READY | `docs/operations/alerts.md` |
| Supply reconciliation metric | SANDBOX_READY | `supply_reconciliation_status` |
| Production SLO enforcement | EXTERNAL_PROVIDER_REQUIRED | Ops runbooks exist |

## Backups

| Capability | Status | Evidence |
| --- | --- | --- |
| Backup procedures | SANDBOX_READY | `sunrey-ops -- production backups` |
| Evidence seal | SANDBOX_READY | `production evidence-seal` |

## Recovery

| Capability | Status | Evidence |
| --- | --- | --- |
| Snapshot restore | SANDBOX_READY | Wave 2 recovery tests |
| Idempotent replay fabric | SANDBOX_READY | Chunk 154 rehearsal |
| Cross-restart replay keys | PARTIAL | Issuance/claim replay in-memory on some paths |
| DR drill | SANDBOX_READY | CI `production restore-drill` |

## Security

| Capability | Status | Evidence |
| --- | --- | --- |
| Architectural linter | PRODUCTION_READY | Constitution CI |
| Kernel gating | PRODUCTION_READY | `check-kernel-gating.mjs` |
| Adversarial range (Chunk 157) | AUDIT_READY | 26 scenarios, 0 invariant breaches |
| Independent security audit | BLOCKED | `EXTERNAL_AUDIT_COMPLETE=false` |
| HSM/KMS | INTERFACE_ONLY | `PRODUCTION_HSM_KMS_CONFIGURED=false` |
| Secret scan | PRODUCTION_READY | CI stage 7 |

## Regulated Rails

| Capability | Status | Evidence |
| --- | --- | --- |
| Payments sandbox | SANDBOX_READY | Fixture conformance |
| Custody sandbox | SANDBOX_READY | Provider-candidate framework |
| KYC/AML adapters | SIMULATION | Chunk 152 fixtures |
| Live bank / card / FX | BLOCKED | All `LIVE_*` false |
| Travel Rule live network | EXTERNAL_PROVIDER_REQUIRED | Simulation only |

## Mainnet

| Capability | Status | Evidence |
| --- | --- | --- |
| Mainnet activation | BLOCKED | 18+ preconditions in sovereign plan §23 |
| Production issuance | BLOCKED | Chunk 143 + ceremony |
| Public validator network | NOT_IMPLEMENTED | Dev/testnet only |
| Staged capability activation | SIMULATION | Chunk 166 rehearsal |

---

## Summary posture

| Layer | Dominant status |
| --- | --- |
| Monetary authority (Chunk 71) | SANDBOX_READY — fail-closed verified |
| Blockchain core | SANDBOX_READY |
| Economic proof lattice | PARTIAL — implemented; durability gaps |
| Human / productive economies | SANDBOX_READY — simulation paths |
| Product integration (Wave 8) | PARTIAL — not formally complete |
| External audit | AUDIT_READY — package assembled |
| Production / mainnet | BLOCKED |

**Production activation is not authorized by this matrix.**
