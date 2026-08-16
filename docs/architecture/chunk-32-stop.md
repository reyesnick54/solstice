# Chunk 32 stop record

This file records a **process-gate stop**, not a SunRey transaction
or economic-state protocol implementation.

Task: CHUNK 32 — SunRey Canonical Economic State Machine &
Transaction Protocol.

Instruction on the task: start from latest `main` **after Chunk 31
is merged**. If Chunk 31 is not merged and its architecture is not
canonical on `main`: **stop**. Do not implement Chunk 31 again.

---

## A. Baseline

Inspected HEAD: `1f5da9a` —
`feat(exchange): Chunk 30R custody, Travel Rule, listing, and surveillance (#58)`.

Latest `origin/main` is the same commit.

Workspace inventory on this tip:

| Required context | Status on `main` |
| --- | --- |
| Money | `IMPLEMENTED` at `packages/money` |
| Security / KeyProvider | `IMPLEMENTED` at `packages/security` |
| Identity | `IMPLEMENTED` at `packages/identity` |
| Consent / Purpose Firewall | `IMPLEMENTED` at `packages/consent` |
| Personal Data Vault | `IMPLEMENTED` at `packages/personal-data-vault` |
| Evidence Vault | `IMPLEMENTED` at `packages/evidence` |
| Canonical Ledger | `IMPLEMENTED` at `packages/ledger` |
| SunRey Coin | `IMPLEMENTED` at `packages/sunrey-coin` |
| SunRey Chain foundation (Chunk 28) | `IMPLEMENTED` at `packages/sunrey-chain` |
| SunRey Exchange | `IMPLEMENTED` at `packages/sunrey-exchange` |
| Custody / surveillance (Chunk 30R) | `IMPLEMENTED` |
| **Chunk 31 declaration** | **absent** |
| **Chunk 31 ADRs (encoding / protocol)** | **absent** |
| **Chunk 31 architecture docs** | **absent** |

GitHub PRs on `reyesnick54/solstice` were inspected. There is no
open, merged, or closed pull request titled or scoped as Chunk 31.
There is no `docs/architecture/chunks/chunk-31-*.json`. There is no
`docs/architecture/chunk-31-*.md`. ADR-0015 is the latest SunRey
Chain decision record and covers the Chunk 28 simulation trust
layer only.

GitHub Actions on `main` at `1f5da9a` (run `31934926677`) is
**SUCCESS**. The stop is not a red-`main` repair.

### Gate 1 — Chunk 31 is merged

**Failed.**

Chunk 31 is not declared, not implemented, and not merged. The
newest canonical SunRey Chain work on `main` is Chunk 28
(`packages/sunrey-chain`, PR `#54`, ADR-0015). Chunks 29 and 30R
are exchange and control-plane work. They do not establish a
sovereign-chain protocol architecture.

### Gate 2 — Chunk 31 architecture is canonical on main

**Failed.**

The task requires a deterministic encoding approach **consistent
with Chunk 31 ADRs**: identical logical transaction → identical
canonical bytes, explicit integer sizes and byte order, string
normalization, unknown-field behavior, forward/backward
compatibility, maximum field sizes, and domain-separated hashing.

No such ADR exists. ADR-0015 selects an in-process simulation
adapter and `CHAIN_OPERATION_SIGNING`. It does not choose a
consensus-critical codec. Existing Chunk 28 commitments use
`canonicalJson` from the Evidence Vault. The task forbids JSON as
consensus-critical serialization unless a Chunk 31 ADR explicitly
justifies and constrains it. That justification is not on `main`.

Choosing a codec, transaction envelope, actor/object/rights
taxonomy, or state-transition interface here would invent the
Chunk 31 architecture the task forbids reimplementing.

### Required-capability evaluation for Chunk 32

Protected prerequisites that already exist (`money`, `security`,
`identity`, `ledger`, `evidence`, `sunrey-coin`, `sunrey-chain`,
and the rest listed in the CHUNK-32 declaration) are
`IMPLEMENTED`. `evaluateChunkRequirements` therefore returns
`mustStop: false`.

The stop is **not** a missing protected capability. It is the
explicit two-part process gate on the task:

1. start only after Chunk 31 is merged
2. stop if Chunk 31 architecture is not canonical on `main`

Capability clearance is not permission to ignore that gate, to
invent protocol semantics, or to implement Chunk 31 under a
Chunk 32 label.

---

## B. What was not built

Nothing that would let a future node consume canonical transaction
bytes:

- no protocol transaction envelope or typed profiles
- no actor-type, economic-object, rights, or transaction-family
  taxonomies
- no `SUNREY_COIN` / `MOONREY_COIN` protocol asset identifiers
- no deterministic consensus codec
- no domain-separated protocol hash / signature functions
- no `validateStateless` / `validateStateful` / `apply` interface
- no machine-readable protocol rejection codes
- no replay-protection design beyond this stop record
- no protocol test vectors
- no `docs/architecture/chunk-32-economic-state-protocol.md`
- no `docs/architecture/sunrey-protocol-object-model.md`
- no `docs/architecture/sunrey-transaction-spec-v1.md`

Existing Chunk 28 types (`ChainWriteIntent`, record schemas,
`SimulationChainAdapter`) were left untouched. They are a
simulation trust-layer write path, not a sovereign transaction
protocol.

---

## C. What this stop does not invent

The following remain owned by existing packages. This stop does
not fork them:

| Concern | Canonical owner |
| --- | --- |
| Fiat Money | `packages/money` |
| SunRey Coin simulation ledger | `packages/sunrey-coin` |
| Financial journals | `packages/ledger` via `Ledger.postJournal` |
| Identity / KYC / ActorContext | `packages/identity` |
| Agent capabilities | `packages/agent` (proposal-only) |
| Consent / purpose | `packages/consent` |
| Personal Data Vault payloads | `packages/personal-data-vault` |
| Evidence sealing | `packages/evidence` |
| Chain trust-layer writes | `packages/sunrey-chain` |

No second Money type, no second SunRey Coin ledger, no MoonRey
mint, no public ticker, no live network, no consensus, no mainnet,
and no production chain database were added.

---

## D. Competing paths that remain forbidden

Do not create:

- `packages/sunrey-chain-v2`
- `packages/blockchain`
- `packages/reyn-chain`
- `packages/on-chain-ledger`
- `packages/crypto-chain`
- `packages/sunrey-protocol`
- `packages/sunrey-tx`
- `packages/moonrey`
- `packages/moonrey-coin`

Chunk 34 will own node state storage. Chunk 33 is out of scope.
Neither is started here.

---

## E. Tests

Constitution test
`CHUNK-32 stops because Chunk 31 protocol architecture is not canonical on main`
asserts:

- CHUNK-31 is not declared
- Chunk 31 architecture / encoding ADRs are absent
- protocol implementation docs and sources are absent
- competing protocol / chain packages are absent
- CHUNK-32 is declared
- capability-evaluator `mustStop` is `false` (process gate, not a
  missing protected capability)

---

## F. Exact CI

Local `npm run ci` on this stop branch is recorded after the
branch is pushed. Baseline on clean `main` at `1f5da9a`
(GitHub Actions run `31934926677`): **SUCCESS**.

`ENVIRONMENT` remains `simulation`. Every `LIVE_*` flag remains
`false`.

---

## G. Legal limitations

Nothing here is a blockchain mainnet, a securities offering, a
money-transmitter license, a VASP registration, or counsel
confirmation of a protocol. Software reservations are not
licenses. No rule is `CONFIRMED_BY_COUNSEL`. ADR-0015 remains
`PROPOSED`.

---

## H. Intentionally unimplemented

Canonical protocol data model, transaction envelope, transaction
families, native-asset protocol IDs, rights model, actor
descriptors, deterministic encoding, domain-separated protocol
signatures, state-transition interface, protocol rejection codes,
replay protection, protocol hashing, protocol fixtures, test
vectors, consensus, mempool, execution, node storage, MoonRey
issuance, and any public ticker.

Chunk 31 was not implemented under this label.

---

## I. Exit criterion

Chunk 32 implementation exit criteria are **not met**. That is the
correct outcome.

A future node still cannot consume canonical transaction bytes,
validate them deterministically, classify the economic object, or
produce a deterministic state-transition request without inventing
protocol semantics. Inventing those semantics is Chunk 31’s job.

---

## J. Recommendation for next chunk

Do **not** start Chunk 32 protocol types next.

1. **Chunk 31** — establish the canonical SunRey Chain protocol
   architecture on `main`: encoding ADR (or an explicit,
   constrained justification if JSON remains), domain-separation
   conventions, versioning / unknown-field policy, and the
   boundary between the Chunk 28 simulation trust layer and a
   future node. Do not activate consensus or mainnet. Do not mint
   MoonRey. Do not invent a ticker.
2. **Chunk 32R** — resume this protocol data model only after
   Chunk 31 is merged and those ADRs are canonical. Extend
   `packages/sunrey-chain`. Do not create `packages/sunrey-chain-v2`
   or `packages/sunrey-protocol`.
3. **Chunk 33 / 34** — consensus / mempool and node state storage
   remain later. Do not begin them from this stop.

`ENVIRONMENT` remains `simulation`. Every `LIVE_*` flag remains
false.
