# ADR-0023 — SunRey Blockchain networking / P2P architecture

- Status: ACCEPTED_FOR_ENGINEERING
- Legal / regulatory confidence: RESEARCH_REQUIRED
- Date: 2026-08-16
- Affected subsystem: SUNREY_CHAIN
- Depends on: ADR-0016, ADR-0017, ADR-0018
- Implementation status: IMPLEMENTED (development network; see addendum)

## Context

A BFT validator set needs authenticated dissemination of proposals,
votes, evidence, and transactions. The current tree has no P2P stack.
Public "decentralized" gossip is not a claim this chunk can make.

## Decision

1. P2P is an internal module with:
   - authenticated peer identities (node keys)
   - an explicit peer-admission policy (allow-list capable)
   - separate channels or priorities for consensus messages versus
     transaction gossip
   - signed envelopes domain-separated by `network_id`
2. RPC / API is **not** P2P. RPC clients are untrusted (ADR threat
   model). RPC must not receive validator voting keys.
3. Initial engineering direction: permissioned-capable gossip
   suitable for a sovereign validator set. Permissionless discovery
   is a later research option, not the freeze.
4. Eclipse, eclipse-via-RPC, and transaction-censorship are first-class
   threats. Admission and diverse peer sets are operational controls,
   not a decentralization badge.
5. No live public network, no mainnet bootstrap peers, no DNS seed
   that implies production.

## Alternatives considered

- **Libp2p as a mandatory dependency now.**
- **Fully permissionless discovery from genesis.**
- **RPC-only "network" (validators poll a coordinator).**

## Why rejected

- Binding the ADR to one library before the node language is
  implemented is unnecessary. Established libraries are allowed later.
- Permissionless discovery before validator accountability and
  network IDs exist invites eclipse and impersonation.
- A coordinator is a single-point liveness and censorship oracle.

## Security implications

Malicious peers can stall, eclipse, or flood. Rate limits and
authenticated peer scoring are required at implementation. Compromised
RPC must not join the consensus mesh with a voting key.

## Compliance implications

Cross-border validator traffic may have export, sanctions, or data-
transfer implications. `RESEARCH_REQUIRED`. No live network is
authorized.

## Operability implications

Operators configure seeds, allow-lists, and listen addresses. Metrics:
peer count, inbound/outbound, rejected peers, gossip lag.

## Migration implications

None. No P2P exists.

## Unresolved questions

- Encryption-at-rest for persisted peer metadata (development stores
  known-peer records as operator diagnostics only).
- Whether a later consensus-engine transport replaces Quinn for
  `CONSENSUS_RESERVED` once Chunk 36+ selects the engine.

## Status

`ACCEPTED_FOR_ENGINEERING` for authenticated, permissioned-capable
P2P as an internal module. Development networking is implemented
with Quinn + rustls (addendum below). Production BFT networking:
**not implemented**. Legal confidence: `RESEARCH_REQUIRED`.

---

## Addendum — development transport selection (Chunk 35R)

Date: 2026-08-16. Implementation status: IMPLEMENTED (development
network only).

ADR-0023 left the concrete stack open. Chunk 35R selects **Quinn
(QUIC) with rustls TLS 1.3** as the development and first
node-critical transport. Location: `packages/sunrey-chain/node`.
Do not create `packages/p2p` or `packages/libp2p`.

| Criterion | Quinn + rustls | libp2p | CometBFT transport |
| --- | --- | --- | --- |
| Authentication | TLS 1.3 plus signed application handshake (Ed25519 node identity) | Noise / TLS; heavy stack | Engine-coupled peer IDs |
| Encryption | rustls TLS 1.3 (not implemented in this repository) | Provided by libp2p | Provided by engine |
| Maturity | Production QUIC in Rust | Mature, large surface | Mature only if the engine is adopted |
| Rust safety | Memory-safe crates; no OpenSSL | Mixed; large graph | C-heavy if the Go engine is used |
| DoS controls | Stream / idle / concurrent-stream limits | Gossipsub + connection limits | Engine-specific |
| Observability | Connection and byte counters on the node | Rich, extra subsystems | Engine metrics |
| Dependency health | Narrow (quinn, rustls, ring) | Broad transitive graph | Binds consensus choice |
| Future BFT channels | Priority class `CONSENSUS_RESERVED` | Possible, extra lock-in | Native, premature |

libp2p is rejected as a mandatory dependency: large graph,
permissionless gossip defaults, and lock-in before the consensus
engine is chosen. A hand-rolled TLS-like or Noise construction is
rejected: do not implement transport encryption. CometBFT transport
is rejected until ADR-0017's library-versus-constrained-Rust
experiment is closed.

Peer authentication is the signed handshake (network ID, chain ID,
genesis hash, node ID, protocol / codec / suite versions, height,
feature bits, timestamp, nonce). rustls provides confidentiality
and integrity on the wire. WebPKI is not admission control.

Quinn carries development gossip and sync. It does not vote, does
not finalize, and does not invent longest-chain fork choice.
Conflicting valid-looking histories emit `FORK_DETECTED`.
