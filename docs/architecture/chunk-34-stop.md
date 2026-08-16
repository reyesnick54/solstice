# Chunk 34 stop record

This file records a **process-gate stop**, not a SunRey sovereign
blockchain node implementation.

Task: SunRey Sovereign Blockchain Node Core and Deterministic State
Machine — local development/simulation node that receives canonical
transaction bytes, decodes, validates, executes, commits state,
constructs a block, computes a state commitment, persists, restarts,
and deterministically reproduces state.

Instruction on the task: start from latest green `main` **after
Chunk 33**. Follow Chunk 31 architecture. Use the exact package
reservation, language, storage ADR, commitment architecture, and
block schema selected by Chunks 31–32. Use the canonical CryptoSuite
registry from Chunk 33.

If Chunks 31–33 are not merged: **STOP**.

---

## A. Baseline

Inspected HEAD: `1f5da9a5669a0cf2c32a2789508dd1659db194f1` —
`feat(exchange): Chunk 30R custody, Travel Rule, listing, and surveillance (#58)`.

Latest `origin/main` is the same commit.

GitHub Actions on `main` at `1f5da9a` (run `31934926677`) is
**success**. The tree is green. Green `main` is not permission to
skip the Chunk 31–33 gate.

Workspace inventory on this tip:

| Required predecessor | Status on `main` |
| --- | --- |
| Chunk 28 SunRey Chain trust layer | `IMPLEMENTED` at `packages/sunrey-chain` (PR `#54`) |
| Chunk 30R custody / surveillance | `IMPLEMENTED` (PR `#58`) |
| Chunk 31 sovereign-chain architecture | **absent** — no declaration, ADR, or reserved node package |
| Chunk 32 canonical protocol / block schema | **absent** — no declaration or types |
| Chunk 33 CryptoSuite registry | **absent** — no declaration or registry |

Open sibling work that is **not** canonical and was not copied:

- PR `#52` — stale Chunk 26R stop
- Historical open PRs `#12`, `#16`, `#17`, `#18`

No open or merged PR implements Chunk 31, 32, or 33. `git log --all`
has no commits for those chunks. There is no
`packages/sunrey-blockchain` or `packages/sunrey-node`.

`packages/sunrey-chain` remains the Chunk 28 simulation trust layer
(`ChainWriteIntent`, in-process `SimulationChainAdapter`). It is not
a blockchain node, state machine, or block producer. ADR-0015 remains
`PROPOSED` and selects no production chain technology.

### Gate 1 — Chunk 31 is merged

**Failed.**

Chunk 31 is the architecture owner for a sovereign SunRey Blockchain
codebase. It is supposed to select:

- canonical package reservation (`packages/sunrey-blockchain` or
  `packages/sunrey-node` or another reserved path)
- implementation language (including whether node-critical code is
  Rust)
- storage ADR for the embedded/local development state database
- commitment architecture (transaction root, state root, block ID)
- integration / migration relationship to `packages/sunrey-chain`

None of those decisions exist on `main`. No chunk declaration
`docs/architecture/chunks/chunk-31-*.json` exists.

Inventing `packages/sunrey-blockchain`, `packages/sunrey-node`,
`packages/blockchain-v2`, `packages/new-chain`, `packages/l1`,
`packages/ledger-chain`, or `packages/web3-chain` would violate the
task and the constitution. Replacing `packages/sunrey-chain` is
forbidden.

### Gate 2 — Chunk 32 is merged

**Failed.**

Chunk 32 is the owner of the canonical protocol types and block
schema (`BlockHeader`, `BlockBody`, `BlockId`, roots, protocol
version, deterministic timestamp rules). There is no schema to
implement against.

### Gate 3 — Chunk 33 is merged

**Failed.**

Chunk 33 is the owner of the canonical CryptoSuite registry. The
task forbids direct algorithm hard-coding and requires that registry.
It does not exist.

### Gate 4 — start from latest green main after Chunk 33

**Failed.**

Latest green `main` is Chunk 30R. Chunks 31–33 have not merged.

### Required-capability evaluation for Chunk 34

This stop PR declares CHUNK-34 with the **existing** implemented
capabilities a later resume would consume (`sunrey-chain`,
`security`, `ledger`, and the rest listed in the chunk file).

`evaluateChunkRequirements` therefore returns `mustStop: false` and
`missing: []`. That result means “do not invent a second Kernel /
ledger / chain.” It does **not** mean Chunk 34 may implement a node.

The stop is the explicit task gate:

> Start from latest green main AFTER Chunk 33. If Chunks 31–33 are
> not merged: STOP.

The constitution rule still applies: absence of Chunk 31’s reserved
owner is not permission to fork a second blockchain, a second
ledger, or a live network. Existing `sunrey-chain` clearance is not
permission to stand up a competing chain process.

---

## B. What was not built

Nothing in the Chunk 34 implementation surface was started.

| Module | Status |
| --- | --- |
| Configuration / chain identity / genesis | Not built |
| Canonical protocol types adapter | Not built — no Chunk 32 schema |
| Transaction decode / validate / admit | Not built |
| State store / snapshots / crash-safe commit | Not built |
| Execution environment (SYSTEM, IDENTITY, NATIVE_ASSET, EVIDENCE_ANCHOR) | Not built |
| Block construction / SIMULATION DEV BLOCK PRODUCER | Not built |
| State commitments / Merkle or hash roots | Not built |
| Block persistence / transaction indexing | Not built |
| Node lifecycle / shutdown / restart | Not built |
| Local RPC / developer CLI | Not built |
| Metrics / structured logging | Not built |
| Determinism, restart, invalid-block tests | Not built |
| End-to-end node demo | Not built |
| `docs/architecture/chunk-34-sovereign-node-core.md` | Not written — implementation doc |
| `docs/runbooks/local-sunrey-node.md` | Not written — requires a node |

No Rust workspace, Cargo crate, or TypeScript node package was
added. Monorepo build tooling is unchanged.

---

## C. What must not be invented from this stop

Do **not** create:

- `packages/sunrey-blockchain`
- `packages/sunrey-node`
- `packages/blockchain-v2`
- `packages/new-chain`
- `packages/l1`
- `packages/ledger-chain`
- `packages/web3-chain`
- `packages/sunrey-chain-v2`
- `packages/blockchain`
- `packages/reyn-chain`
- `packages/on-chain-ledger`
- `packages/crypto-chain`

Chunk 31 chooses the canonical reservation. This stop does not
pre-empt that choice by adding a `PLANNED` package to the manifest.

Do **not** replace `packages/sunrey-chain`.
Do **not** migrate live or simulation SunRey Coin supply onto a
chain.
Do **not** issue MoonRey.
Do **not** allocate genesis SunRey or MoonRey balances.
Do **not** call a local block producer “consensus” or “validator
finality.”
Do **not** implement P2P or BFT.
Do **not** connect a public testnet or mainnet.
Do **not** turn on any `LIVE_*` flag or change `ENVIRONMENT` away
from `simulation`.
Do **not** write journals except through `Ledger.postJournal`.
Do **not** store customer balances on a chain account object.
Do **not** mix blockchain state with the PostgreSQL customer
financial database.

---

## D. Existing SunRey Chain authority (unchanged)

`packages/sunrey-chain` is the reserved `SUNREY_CHAIN` owner. It is
a simulation trust, provenance, permission, attestation, policy, and
settlement-anchor layer. Canonical `Ledger.postJournal` remains the
only money-movement path. ADR-0015 remains `PROPOSED`. This stop
does not promote that ADR to production-approved.

A later Chunk 34R must integrate or migrate according to the ADRs
that Chunk 31 writes. It must not treat this stop as those ADRs.

---

## E. Persistence / events / evidence

**Not built** for a node state domain. No new customer-database
migration. No `node.*` or `block.*` events. Blockchain state, when
it exists, is its own state domain and must not share the
PostgreSQL customer financial database.

---

## F. Security

Unchanged. Canonical `KeyProvider`, `SecretReference`, and envelope
encryption remain. No node private keys, fixture secrets, or
dev-key material were added. Chunk 33’s CryptoSuite registry was
not invented here.

---

## G. Tests

Local `npm run ci` on this stop branch: **ok**.

```
architectural invariants: ok
extraction dry-run: ok (32 package(s))
architectural-linter: ok
deployment posture: ok (simulation-only, live flags off)
kernel gating: passed (71 registered paths, all Kernel-authorized)
tests: 491 pass, 0 fail
  including: CHUNK-34 stops because Chunks 31-33 are not merged
demo: ok (including sunrey-chain, sunrey-exchange, custody)
typecheck: ok
secret scan: ok
CI pipeline: ok
```

`ENVIRONMENT` remains `simulation`. Every `LIVE_*` flag remains
`false`.

Constitution test
`CHUNK-34 stops because Chunks 31-33 are not merged`
asserts:

1. CHUNK-31, CHUNK-32, and CHUNK-33 declarations are absent.
2. CHUNK-34 is declared and this stop record exists.
3. Existing `sunrey-chain` / `security` / `ledger` capabilities
   remain `IMPLEMENTED`.
4. Competing chain / node package directories do not exist.
5. `packages/sunrey-chain` was not replaced.

---

## H. Legal limitations

Nothing here is a public network, mainnet, testnet, validator set,
BFT consensus, VASP, money-transmitter, or issuance authorization.
Software reservations are not licenses. No rule is
`CONFIRMED_BY_COUNSEL`. ADR-0015 remains `PROPOSED`.

---

## I. Exit criterion

Chunk 34 implementation exit criteria are **not met**. That is the
correct outcome.

An engineer cannot initialize a SunRey development chain from this
tree because the node does not exist. The predecessors that would
define that node also do not exist.

---

## J. Recommendation for next chunks

Do **not** start the sovereign node next.

1. **Chunk 31** — sovereign SunRey Blockchain architecture. Reserve
   exactly one owner. Select language, storage, commitments, and
   the relationship to `packages/sunrey-chain`. Do not replace the
   trust layer. Do not select a live network.
2. **Chunk 32** — canonical protocol types and block schema against
   that reservation.
3. **Chunk 33** — canonical CryptoSuite registry. No direct
   algorithm hard-coding in later node code.
4. **Chunk 34R** — resume this node core by **extending** the
   Chunk 31 owner. Single-node development/simulation only. No BFT,
   no public network, no mainnet, no MoonRey issuance. Canonical
   financial Ledger remains protected. Genesis supply stays zero
   unless a prior ADR explicitly authorizes otherwise.

`ENVIRONMENT` remains `simulation`. Every `LIVE_*` flag remains
false.
