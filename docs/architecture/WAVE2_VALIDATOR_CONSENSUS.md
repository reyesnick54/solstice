# Wave 2 Prompt 5 — Validator and BFT Consensus

Status: **development / local devnet only**  
Production consensus: **not implemented**  
Mainnet: **does not exist**

This document records Wave 2 Prompt 5 on the SunRey blockchain track. It builds on:

| Prior prompt | Capability | Owner |
| --- | --- | --- |
| Prompt 1 | Deterministic application state | `packages/sunrey-chain/rust/crates/state` |
| Prompt 2 | Durable chain storage (redb) | `packages/sunrey-chain/rust/crates/storage` |
| Prompt 3 | Transaction authentication (SRCB + CryptoSuite) | `packages/sunrey-chain/rust/crates/protocol`, `crates/crypto` |
| Prompt 4 | (Prerequisite gate) — state, storage, and auth tests must pass before consensus |
| **Prompt 5** | **Validator identity, BFT consensus, local devnet** | `packages/sunrey-chain/rust/crates/consensus`, `node/` |

## Engine selected

**Tendermint-family BFT** (CometBFT-class propose / prevote / precommit / commit).

SunRey does **not** invent a novel consensus algorithm. Differentiation belongs in the economic state machine, evidence architecture, dual economic ontology, and monetary controls — not in a proprietary BFT paper.

| Option | Decision |
| --- | --- |
| CometBFT library import | **Deferred** — Rust workspace + Node P2P stack not yet unified on one CometBFT process boundary |
| In-repo Tendermint-class engine | **Adopted for development** — `packages/sunrey-chain/rust/crates/consensus` |
| Novel BFT | **Rejected** — ADR-0017 |

Reference: ADR-0017, `packages/sunrey-chain/rust/crates/consensus/ALGORITHM.md`, Buchman/Kwon/Milosevic 2018 / CometBFT lock specification.

## Why this engine

1. **Mature safety model** — `f < n/3`, deterministic finality on commit, well-documented lock rules.
2. **Runtime fit** — Pure Rust engine matches the existing `sunrey-chain` Rust workspace without forcing a Go/C++ CometBFT sidecar in this prompt.
3. **Interface freeze** — Application code uses `ConsensusAdapter` / `ConsensusApplication`, not vendor imports.
4. **Production path** — CometBFT or an equivalent established engine remains the documented production-candidate direction when the node/P2P stack is ready for direct integration.

## Application / consensus boundary

```
┌─────────────────────────────────────────────────────────────┐
│  SunRey deterministic application (NOT in consensus crate)   │
│  sunrey-state · sunrey-execution · sunrey-native-assets      │
│  ExecutionConsensusAdapter : ConsensusAdapter                │
│    prepare_proposal / validate_proposal / apply_finalized    │
└───────────────────────────┬─────────────────────────────────┘
                            │ FinalizedBlock + app_hash
┌───────────────────────────▼─────────────────────────────────┐
│  sunrey-consensus (Tendermint-class development engine)      │
│  propose · prevote · precommit · commit · WAL · signer safety│
└───────────────────────────┬─────────────────────────────────┘
                            │ authenticated votes
┌───────────────────────────▼─────────────────────────────────┐
│  Validator set · P2P devnet (packages/sunrey-chain/node)   │
└─────────────────────────────────────────────────────────────┘
```

**Rules:**

- Uncommitted proposals **must not** mutate authoritative state.
- Only `apply_finalized` writes committed application state.
- Consensus **must not** contain SunRey/MoonRey valuation, ledger journaling, or Execution Authority issuance.
- Consensus finalizes **transaction order**; the execution adapter applies that order deterministically.

Canonical types:

- `ConsensusAdapter` — SunRey-facing port (`adapter.rs`)
- `ConsensusApplication` — engine-facing trait (`app.rs`)
- `ExecutionConsensusAdapter` — production-quality bridge to `sunrey-execution`
- `MemoryApp` — lightweight stub for harness-only tests

## Fault assumptions

| Assumption | Value |
| --- | --- |
| Byzantine threshold | Strictly fewer than **1/3** of voting power may be Byzantine |
| Quorum | `power > ⌊2·total/3⌋` for prevote/precommit commit |
| Validator count (local devnet) | **4** validators (A/B/C/D) — demonstrates `f=1` tolerance |
| Network model | Partial synchrony; liveness may stall under partition; safety preserved |
| Finality | Deterministic on commit — no longest-chain reorg |

## Quorum / finality model

1. Weighted proposer selection (Tendermint `IncrementProposerPriority`).
2. `PROPOSE → PREVOTE → PRECOMMIT → COMMIT → FINALIZED`.
3. Lock / valid-value / NIL / round-change per `ALGORITHM.md`.
4. `CommitCertificate` independently verifiable; persisted in WAL.
5. Signer safety (FilePV-style last-sign-state) refuses conflicting signatures at same `(height, round, step)`.

## Validator identity

Four **separate** identity domains — never interchangeable:

| Domain | Purpose | Development keys |
| --- | --- | --- |
| **Validator signing** | Consensus votes, proposals | `development_secret("val_*")` — labeled `NOT_FOR_PRODUCTION` |
| **Transaction signing** | SRCB user/actor transactions | `development_fixture_secret()` / per-actor seeds |
| **Monetary governance** | Issuance authorization artifacts | `DEV_FAUCET_ISSUER`, governance policy references |
| **API / service** | HTTP, operator, RPC planes | Separate from validator and tx keys |

Validator private keys are **not** embedded in source or committed configuration. Production interfaces: HSM/KMS signer ports (`sunrey-validators` crate).

## Validator set

| Property | Development behavior |
| --- | --- |
| Initial set | Four validators `val_a`–`val_d`, power 10 each |
| Set hash | Deterministic commitment via `ValidatorSet::hash()` |
| Persistence | WAL + signer DB paths per validator in networked devnet |
| Production changes | **Fail closed** — governed validator-set updates not activated in this prompt |

Startup validates genesis hash, network/chain IDs, and validator-set hash consistency across peers.

## Local devnet

**Not mainnet.** Development keys only.

| Tool | Command |
| --- | --- |
| Four-validator shell script | `./scripts/sunrey-validator-devnet.sh` |
| In-process demo | `npm run demo:sunrey-validator-devnet` |
| Four-validator P2P test | `packages/sunrey-chain/node/tests/consensus_network.rs` |
| In-process BFT harness | `cargo test -p sunrey-consensus` |
| Runbook | `docs/runbooks/four-validator-devnet.md` |

## Governance vs consensus

| Authority | Decides | Does **not** decide |
| --- | --- | --- |
| **Validators (consensus)** | Whether a protocol transition / block is valid and final | SunRey/MoonRey supply, monetary policy, Execution Authority |
| **Human governance** | Governed monetary actions, issuance authorization, production activation | Block validity, transaction ordering |

**Critical invariant:** Consensus agreement alone **must not** constitute monetary authorization. A validator may process an `ISSUE` transaction only when an `IssuanceAuthorization` artifact already satisfies protocol rules (`native-assets/issuance.rs`, `execution` apply path).

## Failure testing (Wave 2 Prompt 5)

Rust tests in `packages/sunrey-chain/rust/crates/consensus/tests/`:

| Test file | Scenarios |
| --- | --- |
| `wave2_failures.rs` | 4-validator agreement, 1 offline, invalid tx rejected, bad app hash, quorum not reached, memory harness regression |
| `wave2_authority.rs` | Unauthorized issuance rejected, faucet environment gate, authorized faucet in simulation, no Execution Authority in adapter |
| `safety.rs`, `wal_recovery.rs`, `harness.rs` | Equivocation, WAL recovery, 3/4 liveness |
| `node/tests/consensus_network.rs` | Four-validator P2P identical finality |

## Remaining production requirements

1. **Unify stacks** — Bridge `node/src/consensus/` P2P path with `sunrey-consensus` + `ExecutionConsensusAdapter` (single engine owner).
2. **CometBFT evaluation** — Production-candidate integration or sidecar when operational requirements are met.
3. **Governed validator-set changes** — Epoch updates with fail-closed governance; not enabled in development.
4. **Production keys** — HSM/KMS-backed validator signers; remove development seed derivation.
5. **Slashing / evidence runtime** — Evidence collection exists; production enforcement not active.
6. **Network hardening** — Sentry architecture, state sync authentication, production timeouts.
7. **Legal / regulatory** — Validator bonding and slashing characterization remains `RESEARCH_REQUIRED`.

## Related documents

- `docs/architecture/adr/ADR-0017-sunrey-blockchain-consensus-architecture.md`
- `docs/architecture/adr/ADR-0018-sunrey-blockchain-validator-architecture.md`
- `docs/architecture/chunk-37-bft-consensus-core.md`
- `docs/architecture/chunk-38-networked-consensus.md`
- `docs/runbooks/consensus-development.md`
- `packages/sunrey-chain/rust/crates/consensus/ALGORITHM.md`
