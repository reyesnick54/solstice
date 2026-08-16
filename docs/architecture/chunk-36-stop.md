# Chunk 36 stop record

This file records a **process-gate and missing-capability stop**, not
a SunRey validator registry, bonding, or validator-set lifecycle
implementation.

Task: implement SunRey validator identity, registry, bonding model,
and validator-set lifecycle inside the canonical modular SunRey node
— the control plane needed before BFT consensus voting.

Instruction on the task: **run this after Chunk 35R is merged into
main.** Start from latest clean `main`.

If Chunk 35R is not merged, the local deterministic node is not
`IMPLEMENTED`, or the development P2P/devnet plane is not
`IMPLEMENTED`: **stop**. Do not invent a validator package. Do not
begin BFT proposal / prevote / precommit.

---

## A. Baseline

Inspected HEAD: `468a822c6643efe708b2d5e9497590055547b82a` —
`Merge pull request #62 from reyesnick54/cursor/chunk-35-p2p-stop-c61a`.

Latest `origin/main` is the same commit.

GitHub Actions on that tip (run `31940738977`) is **failure**. The
failure is merge damage from stop PRs `#59`–`#62` landing on top of
the Chunk 31 architecture freeze (`#63`): invalid JSON in
`docs/architecture/manifest.json` and stale “Chunk 31 is absent”
assertions. This stop repairs that damage so the constitution can
load. Repairing JSON is not permission to implement validators.

Workspace inventory on this tip:

| Required context | Status on `main` |
| --- | --- |
| SECURITY / KeyProvider | `IMPLEMENTED` at `packages/security` |
| IDENTITY | `IMPLEMENTED` at `packages/identity` |
| Canonical Ledger | `IMPLEMENTED` at `packages/ledger` |
| EVIDENCE | `IMPLEMENTED` at `packages/evidence` |
| EVENTS | `IMPLEMENTED` at `packages/events` |
| SUNREY_CHAIN trust layer | `IMPLEMENTED` at `packages/sunrey-chain` (Chunk 28, PR `#54`) |
| Chunk 31 architecture freeze | `IMPLEMENTED` specification only (PR `#63`, ADR-0016–ADR-0033) |
| Chunk 32 economic-state protocol | **stopped** — `docs/architecture/chunk-32-stop.md` |
| Chunk 33 CryptoSuite / PQC | **stopped** — `docs/architecture/chunk-33-stop.md` |
| Chunk 34 local deterministic node | **stopped** — `docs/architecture/chunk-34-stop.md` |
| Chunk 35 P2P / mempool / sync | **stopped** — `docs/architecture/chunk-35-stop.md` |
| Chunk 35R | **absent** — no declaration, no PR, not merged |
| `sunrey-local-node` | reserved `PLANNED` |
| `sunrey-p2p` | reserved `PLANNED` |
| `sunrey-validators` | reserved `PLANNED` by this stop |
| Rust node / Rust CI | **absent** |
| Development genesis / four-node devnet | **absent** |

`packages/sunrey-chain` remains the Chunk 28 simulation trust,
provenance, permission, attestation, policy, and settlement-anchor
layer. It accepts `ChainWriteIntent` records, signs with
`CHAIN_OPERATION_SIGNING`, and submits through an in-process
`SimulationChainAdapter`. That is not a validator registry, not a
bonded validator set, not a consensus signer, and not a node.

ADR-0018 remains `ACCEPTED_FOR_ENGINEERING` / `NOT_IMPLEMENTED`.
ADR-0017 freezes the Tendermint-family interface only. There is no
`ConsensusEngine` module, no epoch state machine, and no
validator-set hash.

There is no GitHub PR, branch, or chunk declaration for Chunk 35R.

### Gate 1 — Chunk 35R is merged into main

**Failed.** Latest `main` is the Chunk 35 *stop*. The task’s first
instruction is to run only after Chunk 35R merges. Chunk 35R does
not exist.

### Gate 2 — local deterministic node is IMPLEMENTED

**Failed.** Capability `sunrey-local-node` is `PLANNED`. There is no
development node process, no genesis object, no sequential block
application API, and no node CLI to extend with
`sunrey-node validator …` commands.

### Gate 3 — P2P development network is IMPLEMENTED

**Failed.** Capability `sunrey-p2p` is `PLANNED`. There are no
devnet scripts to launch four validator-capable nodes, no peer
identity plane, and no shared validator-set gossip.

### Gate 4 — protocol types and CryptoSuite exist to implement against

**Failed.** Chunk 32 (canonical transaction / block schema) and
Chunk 33 (CryptoSuite registry) are stop records, not
implementations. This stop does not invent Ed25519-versus-secp256k1,
a signer-safety database format, or a block header commitment for
`ValidatorSetHash`.

### Required-capability evaluation for Chunk 36

This stop PR declares CHUNK-36 with the task’s required
capabilities, including protected `sunrey-local-node`,
`sunrey-p2p`, and `sunrey-validators` recorded as `PLANNED` /
owner `packages/sunrey-chain`.

`evaluateChunkRequirements` therefore returns `mustStop: true` and
`missing: ['sunrey-local-node', 'sunrey-p2p', 'sunrey-validators']`.

The stop is both:

1. the explicit task gate (start only after Chunk 35R; stop if the
   local node and P2P plane are not `IMPLEMENTED`), and
2. the constitution rule: a protected requirement that is not
   `IMPLEMENTED` is a stop, not a license to reimplement a node,
   invent `packages/validators`, or stand up bonding on top of the
   Chunk 28 trust-layer adapter.

Implemented `sunrey-chain` (trust layer) and the Chunk 31
architecture freeze are not permission to pretend a four-node
development validator set already exists.

---

## B. What was not built

**Not built.** No `ValidatorRecord`. No validator registry. No
consensus-key / P2P-key / governance-key / reward / recovery
descriptors. No operator/controller relationship. No status
lifecycle (`CANDIDATE` … `EXITED`). No integer voting-power
runtime. No `BondDescriptor`. No `ValidatorSet` /
`ValidatorSetVersion` / `ValidatorSetHash`. No epoch abstraction.
No epoch-boundary set transition. No development genesis validator
set. No four-node validator-capable devnet. No key rotation. No
voluntary exit scheduler. No `DOUBLE_PROPOSAL` /
`DOUBLE_PREVOTE` / `DOUBLE_PRECOMMIT` evidence types. No
consensus signer port (`signProposal` / `signPrevote` /
`signPrecommit`). No persistent signer-safety database. No HSM /
remote-signer provider. No `sunrey-node validator` CLI. No
validator metrics. No validator runbooks.

This stop does not mark:

- VALIDATOR REGISTRY = IMPLEMENTED
- DEVELOPMENT VALIDATOR SET = IMPLEMENTED
- PRODUCTION VALIDATOR SET = IMPLEMENTED
- BFT CONSENSUS = IMPLEMENTED
- PUBLIC STAKING = IMPLEMENTED
- SLASHING = IMPLEMENTED
- MOONREY ISSUANCE = IMPLEMENTED

Those remain not implemented. The BFT proposal / prevote /
precommit engine is a later chunk and is not started here.

---

## C. Actor and key-separation rules (recorded, not implemented)

ADR-0018 already forbids AI agents, robots, and devices from
holding validator voting keys. Execution Authority HMAC and
`CHAIN_OPERATION_SIGNING` must never become consensus keys. P2P
node keys must not vote.

Those rules remain architecture. This stop does not implement the
registry checks, because there is no registry.

---

## D. Bonding (recorded, not implemented)

ADR-0018 leaves the bond asset unresolved (`NATIVE_PROTOCOL_BOND`
versus a non-transferable admission credential). The task permits
simulation/development bonding only.

This stop does not debit customer fiat journals, does not use
SunRey Coin holdings as staking collateral, and does not issue
MoonRey. There is no bonding runtime to misuse.

---

## E. Competing packages

Canonical owner remains `packages/sunrey-chain`. This stop forbids
competing roots rather than creating them:

- `packages/validators`
- `packages/staking`
- `packages/validator-v2`
- `packages/consensus-engine`
- `packages/tendermint`
- `packages/sunrey-node`
- `packages/sunrey-p2p`
- `packages/sunrey-consensus`

Do not connect a live RPC, public testnet, or mainnet. Do not
enable `MAINNET_ENABLED`, `PRODUCTION_BLOCKCHAIN`, or
`LIVE_CHAIN_ENABLED`.

---

## F. Architecture guards

This stop PR adds:

- CHUNK-36 declaration requiring protected `sunrey-local-node`,
  `sunrey-p2p`, and `sunrey-validators`
- reserved capability `sunrey-validators` as `PLANNED` on owner
  `packages/sunrey-chain`
- competing validator / staking directory names in
  `forbiddenWorkspaceRoots`
- a constitution test that `mustStop` is true while those
  capabilities are `PLANNED`

It also repairs merge-broken `manifest.json` (missing commas and a
duplicate `notes` key) and updates stale Chunk 32–35 tests that
still asserted “Chunk 31 is absent” after PR `#63` merged. Those
repairs are not a validator implementation.

It does not implement validator, signer, epoch, or bonding code
inside `packages/sunrey-chain`, because the local deterministic
node and Chunk 35R P2P plane must exist first.

---

## G. Demo

**Not added.** There is no four-validator development network and
no validator CLI. The existing `demo:sunrey-chain` remains the
Chunk 28 trust-layer demonstration.

---

## H. Tests

Added:

- CHUNK-36 `mustStop` while `sunrey-local-node`, `sunrey-p2p`, and
  `sunrey-validators` are `PLANNED`
- reserved competing validator / staking / consensus-engine roots
  remain absent
- `packages/sunrey-chain` still has no validator registry,
  consensus signer, or epoch transition
- no fiat journal, SunRey Coin staking debit, or MoonRey issuance
  path was added

The sixteen implementation vectors in the task (deterministic
four-validator hash, AI/robot control rejection, P2P-key and
Execution Authority rejection, signer-safety restart, epoch
rotation/exit, integer BFT threshold) are **not** implemented.
They belong to Chunk 36R after the node exists.

---

## I. CI note

There is no Rust tree and no Rust CI job. This stop does not add
one. Full repository CI remains the existing seven-stage unit
pipeline plus the separate persistence job.

`ENVIRONMENT` remains `simulation`. Every `LIVE_*` flag remains
`false`.

---

## J. Legal / product limitations

Nothing here is a public staking product, validator market,
mainnet, testnet, or licensed network. Software reservations are
not network launches. No rule is `CONFIRMED_BY_COUNSEL`. ADR-0018
legal confidence remains `RESEARCH_REQUIRED`.

---

## K. Exit criterion

Chunk 36 implementation exit criteria are **not met**. That is
the correct outcome.

SunRey does not have a deterministic validator registry, a
four-node development validator set, cryptographically separated
validator keys, persistent double-sign prevention, or
epoch-based validator-set transitions.

There is still **no** production validator consensus.

---

## L. Recommendation for next chunk

Do **not** start validator registry, bonding, or BFT voting next.

1. **Chunk 32R** — canonical transaction and economic-state
   protocol / block schema at `packages/sunrey-chain`.
2. **Chunk 33R** — CryptoSuite registry on the existing
   `KeyProvider` control plane. Versioned, rotatable, domain
   separated. Pick the first consensus signature algorithm
   there, not here.
3. **Chunk 34R** — local deterministic development node and
   development block producer at `packages/sunrey-chain`.
   Development genesis lives there.
4. **Chunk 35R** — P2P / mempool / sync and a local multi-node
   development network. Resume only after `sunrey-local-node`
   is `IMPLEMENTED` on green `main`.
5. **Chunk 36R** — resume this validator identity, registry,
   bonding abstraction, and epoch-boundary set lifecycle only
   after Chunk 35R is merged. Keep the owner at
   `packages/sunrey-chain`. Do not create `packages/validators`.

`ENVIRONMENT` remains `simulation`. Every `LIVE_*` flag remains
false.
