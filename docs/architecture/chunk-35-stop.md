# Chunk 35 stop record (historical)

**Historical.** This file records the original process-gate stop.
Chunk 35R implements the P2P development network, mempool, and state
sync at `packages/sunrey-chain/node`. See
[`chunk-35-resume.md`](./chunk-35-resume.md).

This file is **not** the current implementation record. It remains
as the documentation-only gate that ran before the local node and
networking modules existed.

Task: SunRey Blockchain P2P Network, Mempool, and State
Synchronization — turn a single-node development blockchain into a
multi-node development network.

Instruction on the task: start from latest green `main` **after
Chunk 34**. If Chunk 34 is not merged and the local deterministic
node is not `IMPLEMENTED`: **stop**. Do not begin Chunk 36.

---

## A. Baseline

Inspected HEAD: `1f5da9a` —
`feat(exchange): Chunk 30R custody, Travel Rule, listing, and
surveillance (#58)`.

Latest `origin/main` is the same commit. GitHub Actions run
`31934926677` on that tip is **success**.

Workspace inventory on this tip:

| Required context | Status on `main` |
| --- | --- |
| SECURITY / KeyProvider | `IMPLEMENTED` at `packages/security` |
| IDENTITY | `IMPLEMENTED` at `packages/identity` |
| Canonical Ledger | `IMPLEMENTED` at `packages/ledger` |
| EVIDENCE | `IMPLEMENTED` at `packages/evidence` |
| EVENTS | `IMPLEMENTED` at `packages/events` |
| SUNREY_COIN | `IMPLEMENTED` at `packages/sunrey-coin` |
| SUNREY_EXCHANGE | `IMPLEMENTED` at `packages/sunrey-exchange` |
| CUSTODY / MARKET_SURVEILLANCE | `IMPLEMENTED` (Chunk 30R, PR `#58`) |
| SUNREY_CHAIN trust layer | `IMPLEMENTED` at `packages/sunrey-chain` (Chunk 28, PR `#54`) |
| Chunk 31 transport ADR | **absent** — no chunk declaration, no ADR |
| Chunk 33 CryptoSuite | **absent** — no versioned suite architecture |
| Chunk 34 local deterministic node | **absent** — not merged, not `IMPLEMENTED` |
| `sunrey-local-node` | reserved `PLANNED` by this stop |
| `sunrey-p2p` | reserved `PLANNED` by this stop |

`packages/sunrey-chain` is the Chunk 28 simulation trust,
provenance, permission, attestation, policy, and settlement-anchor
layer. It accepts `ChainWriteIntent` records, signs with
`CHAIN_OPERATION_SIGNING`, and submits through an in-process
`SimulationChainAdapter`. That is not a local deterministic
blockchain node, not a development block producer, and not a P2P
network.

Network mode is `SIMULATION`. `DEVELOPMENT`,
`TEST_NETWORK_PLACEHOLDER`, and `PRODUCTION_DISABLED` exist as
types only. ADR-0015 remains `PROPOSED` and does not select a
production chain technology or a development transport.

There are no GitHub PRs, branches, or chunk declarations for
Chunks 31, 32, 33, or 34.

### Gate 1 — latest green main is after Chunk 34

**Failed.** Latest green `main` is Chunk 30R. Chunks 31–34 were
never opened.

### Gate 2 — local deterministic node is IMPLEMENTED

**Failed.** Capability `sunrey-local-node` is `PLANNED`. There is
no development node process, no genesis object, no sequential
block application API, no recomputed state root, and no
development block producer.

### Gate 3 — Chunk 31 transport ADR and Chunk 33 CryptoSuite exist

**Failed.** The task requires the transport selected in the
Chunk 31 ADR and the Chunk 33 CryptoSuite architecture. Neither
exists. This stop does not invent them.

### Required-capability evaluation for Chunk 35

This stop PR declares CHUNK-35 with the task's required
capabilities, including protected `sunrey-local-node` and
`sunrey-p2p` recorded as `PLANNED` / owner `packages/sunrey-chain`.

`evaluateChunkRequirements` therefore returns `mustStop: true` and
`missing: ['sunrey-local-node', 'sunrey-p2p']`.

The stop is both:

1. the explicit task gate (start only after Chunk 34; stop if the
   local deterministic node is not `IMPLEMENTED`), and
2. the constitution rule: a protected requirement that is not
   `IMPLEMENTED` is a stop, not a license to reimplement a node,
   invent a second chain package, or stand up P2P on top of the
   Chunk 28 trust-layer adapter.

Implemented `sunrey-chain` (trust layer) is not permission to
pretend a multi-node development blockchain already exists.

---

## B. What was not built

**Not built.** No peer identity. No peer discovery. No encrypted
or authenticated P2P sessions. No transaction gossip. No block
gossip. No bounded mempool. No peer manager. No state or block
synchronization. No snapshot sync. No local multi-node devnet.
No production consensus.

This stop does not mark:

- P2P DEVELOPMENT NETWORK = IMPLEMENTED
- PRODUCTION CONSENSUS = IMPLEMENTED
- PUBLIC TESTNET = IMPLEMENTED
- MAINNET = IMPLEMENTED

Those remain not implemented. Production consensus is Chunk 36+
and is not started here.

---

## C. Network identity

**Not built.** Chunk 33 CryptoSuite is absent. This stop does not
hard-code a networking algorithm or invent a peer-identity scheme
separate from the existing `KeyProvider`.

Peer identity, if later implemented, must remain:

- cryptographically authenticated
- versioned
- separate from wallet identity
- separate from validator consensus identity where architecture
  requires
- rotatable
- revocable / denylistable
- domain separated

---

## D. Transport

**Not built.** Chunk 31 has not selected a development transport.
This stop does not roll custom transport encryption and does not
guess libp2p, QUIC, or TLS-over-TCP.

---

## E. Handshake, peer manager, mempool, gossip, sync

**Not built.** A peer never gets authority merely because it is
connected. That principle is recorded here; it is not implemented
as protocol code.

Development fork behavior, `FORK_DETECTED`, snapshot-sync
interfaces, eclipse/Sybil foundations, and network observability
remain for Chunk 35R after the local node exists.

---

## F. Security boundaries (unchanged)

P2P code — when it later exists — may not:

- issue Execution Authority
- post financial journals
- change Compliance policy
- change Risk limits
- change consent
- mint SunRey Coin
- mint MoonRey Coin
- activate Exchange
- activate mainnet
- alter crypto-suite policy without governance

This stop does not create any of those paths.

---

## G. Competing packages

Canonical owner remains `packages/sunrey-chain`. This stop forbids
competing roots rather than creating them:

- `packages/sunrey-chain-v2`
- `packages/blockchain`
- `packages/sunrey-node`
- `packages/sunrey-p2p`
- `packages/p2p`
- `packages/libp2p`
- `packages/mempool`
- `packages/devnet`
- `packages/gossip`
- `packages/consensus`
- `packages/sunrey-consensus`

Do not connect a live RPC, public testnet, or mainnet.

---

## H. Architecture guards

This stop PR adds:

- CHUNK-35 declaration requiring protected `sunrey-local-node`
  and `sunrey-p2p`
- reserved capabilities `sunrey-local-node` and `sunrey-p2p` as
  `PLANNED` on owner `packages/sunrey-chain`
- a constitution test that `mustStop` is true while those
  capabilities are `PLANNED`
- competing node / P2P / mempool / consensus directory names in
  `forbiddenWorkspaceRoots`

It does not implement handshake, gossip, mempool, or sync code
inside `packages/sunrey-chain`, because the local deterministic
node must exist first.

---

## I. Demo

**Not added.** There is no three-node local devnet and no fault
demo. The existing `demo:sunrey-chain` remains the Chunk 28
trust-layer demonstration.

---

## J. Tests

Added:

- CHUNK-35 `mustStop` while `sunrey-local-node` and `sunrey-p2p`
  are `PLANNED`
- reserved competing node / P2P / mempool / consensus roots
  remain absent
- no Chunk 31–34 declarations
- `packages/sunrey-chain` still has no peer, mempool, gossip, or
  sync implementation

Local `npm run ci` on this stop (matches `scripts/ci.sh` / GitHub
Actions unit-test stage order):

```
architectural invariants: ok
deployment posture: ok (simulation-only, live flags off)
kernel gating: passed (71 registered paths, all Kernel-authorized)
tests: 494 pass, 0 fail
  including: CHUNK-35 stops because the local deterministic node is not IMPLEMENTED
demo: ok (including sunrey-chain trust-layer demo; no P2P devnet)
typecheck: ok
secret scan: ok
CI pipeline: ok
```

`ENVIRONMENT` remains `simulation`. Every `LIVE_*` flag remains
`false`. Persistence integration is a separate GitHub Actions job
and was not folded into this unit-test stage.

---

## K. CI note

This stop does not add a multi-node integration test, because
there is no node to integrate. The new tests are deterministic
architecture gates, not gossip/sync timing tests.

---

## L. Legal / product limitations

Nothing here is a public testnet, mainnet, production consensus,
validator set, or licensed network. Software reservations are not
network launches. No rule is `CONFIRMED_BY_COUNSEL`.

---

## M. Exit criterion

Chunk 35 implementation exit criteria are **not met**. That is
the correct outcome.

Three independent SunRey development nodes cannot discover,
authenticate, gossip, synchronize, or converge, because there is
not yet one local deterministic node.

There is still **no** production validator consensus.

---

## N. Recommendation for next chunk

Do **not** start P2P, mempool, or consensus next.

1. **Chunk 31** — record the development-network ADR (transport,
   network/chain ID, protocol versioning). Do not roll custom
   transport encryption. Do not select mainnet.
2. **Chunk 33** — CryptoSuite architecture on the existing
   `KeyProvider` control plane. Versioned, rotatable, domain
   separated. Do not hard-code one algorithm into networking.
3. **Chunk 34** — local deterministic development node and
   development block producer at `packages/sunrey-chain`. Same
   genesis, sequential apply, recomputed state roots. Simulation
   / development only.
4. **Chunk 35R** — resume this P2P / mempool / sync plane only
   after `sunrey-local-node` is `IMPLEMENTED` on green `main`.
5. **Chunk 36+** — validator / consensus infrastructure. Do not
   begin it from this stop.

`ENVIRONMENT` remains `simulation`. Every `LIVE_*` flag remains
false.
