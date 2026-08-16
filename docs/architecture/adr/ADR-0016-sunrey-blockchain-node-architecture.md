# ADR-0016 — SunRey Blockchain node architecture

- Status: ACCEPTED_FOR_ENGINEERING
- Legal / regulatory confidence: RESEARCH_REQUIRED
- Date: 2026-08-16
- Affected subsystem: SUNREY_CHAIN
- Depends on: ADR-0015, ADR-0009
- Implementation status: NOT_IMPLEMENTED (architecture freeze only)

## Context

`packages/sunrey-chain` is an implemented **simulation** trust,
provenance, permission, attestation, policy, and settlement-anchor
layer. It is not a production blockchain. Chunk 31 must freeze the
node architecture before later chunks build a sovereign node.

The repository already has one canonical owner. Creating
`packages/blockchain-node`, `packages/sunrey-node`, or five
microservices would fork the constitution.

SunRey Blockchain is intended to become a sovereign economic base
layer for humans, enterprises, AI agents, robots, devices, productive
assets, identity, attestations, rights, consent, purpose, provenance,
jurisdiction, policy state, economic objects, SunRey Coin, MoonRey
Coin, oracle facts, productive capacity, authorized execution,
settlement, and evidence. It must not be designed as "generic smart
contracts plus token balances."

## Decision

1. There is exactly one canonical SunRey Blockchain owner:
   `packages/sunrey-chain`.
2. The future production node is a **modular monolith** inside that
   owner. Consensus, execution, storage, networking, and crypto are
   internal modules with hard interfaces, not separate workspace
   packages or microservices.
3. Node-critical production code will be written in a memory-safe
   language. The engineering direction is Rust. The current TypeScript
   simulation layer remains the implemented trust/admission facade
   until a later chunk replaces adapters behind the same ports.
4. The trusted computing base is minimized: consensus, execution,
   state commitment, crypto providers, and genesis verification.
   Indexing, RPC cosmetics, and derived projections are outside the
   TCB.
5. A node must support deterministic replay, safe crash recovery,
   structured observability, reproducible builds, and explicit
   genesis / network identifiers.
6. This chunk does **not** implement a production node. After Chunk
   31, `packages/sunrey-chain` remains a simulation trust layer.

Future internal modules (not packages):

```text
packages/sunrey-chain/
  src/                 # implemented simulation trust layer
  node/                # FUTURE — do not create in Chunk 31
    api/
    admission/
    authentication/
    policy/
    mempool/
    consensus/
    execution/
    state/
    storage/
    p2p/
    crypto/
    ops/
```

## Alternatives considered

| Option | Summary |
| --- | --- |
| A. Five workspace packages (`blockchain-node`, `blockchain-protocol`, `blockchain-network`, `blockchain-consensus`, `blockchain-runtime`) | Matches the concept list literally. |
| B. Separate production repository | Sovereignty via repo split. |
| C. Modular monolith in `packages/sunrey-chain` | One owner, internal module boundaries. |
| D. Treat the TypeScript simulation adapter as the production node | Fastest path to a "node." |

## Why rejected

- **A** creates competing owners and five CI/dependency surfaces. The
  constitution prefers one repository and one owner per protected
  system.
- **B** splits the machine-enforceable constitution from the node.
  Later agents would reimplement Money, Kernel, or ledger by accident.
- **D** pretends a production blockchain exists. The simulation
  adapter has no consensus, no P2P, no deterministic finality, and no
  crash-safe store.

## Security implications

A modular monolith still requires key separation: validator keys,
operation-signing keys, RPC TLS material, and application
`KeyProvider` keys must not share storage or process roles. A
compromised RPC process must not be able to sign consensus votes.
Observability must not emit private keys, seed material, or raw PDV.

## Compliance implications

The node is not a licensed VASP, bank, or settlement system. Country
rules stay in the Compliance Kernel. The node may enforce
protocol-native admission predicates; it must not become a second
policy engine that can ALLOW what the Kernel BLOCKED.

Nothing in this ADR is `CONFIRMED_BY_COUNSEL`.

## Operability implications

Operators get one binary/module set with explicit health, height,
peer, mempool, and finality metrics. Crash recovery must replay from
the last committed state commitment. Reproducible builds are required
before any later test-network placeholder.

## Migration implications

The simulation `SunReyChainAdapter` remains. A future production
adapter implements the same application-facing ports. Existing
`ChainWriteIntent` records do not become production transactions
without an explicit later codec and genesis.

## Unresolved questions

- Exact Rust crate layout and workspace membership inside
  `packages/sunrey-chain`.
- Whether the TypeScript facade stays permanently as the application
  admission layer or is later thinned to a client SDK.
- Hardware-security-module binding for validator keys (Chunk 33).

## Status

`ACCEPTED_FOR_ENGINEERING` for the modular-monolith owner and
memory-safe node direction. Production node: **not implemented**.
Legal confidence: `RESEARCH_REQUIRED`.
