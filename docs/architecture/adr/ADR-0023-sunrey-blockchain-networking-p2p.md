# ADR-0023 — SunRey Blockchain networking / P2P architecture

- Status: ACCEPTED_FOR_ENGINEERING
- Legal / regulatory confidence: RESEARCH_REQUIRED
- Date: 2026-08-16
- Affected subsystem: SUNREY_CHAIN
- Depends on: ADR-0016, ADR-0017, ADR-0018
- Implementation status: NOT_IMPLEMENTED

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

- Concrete stack (libp2p, Quinn/QUIC, or CometBFT's transport if a
  library engine is chosen).
- Encryption-at-rest versus TLS-on-the-wire for peer metadata.

## Status

`ACCEPTED_FOR_ENGINEERING` for authenticated, permissioned-capable
P2P as an internal module. Production networking: **not
implemented**. Legal confidence: `RESEARCH_REQUIRED`.
