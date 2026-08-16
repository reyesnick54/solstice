# Chunk 35R — SunRey P2P development network, mempool, and state sync

Implemented after the Chunk 31 architecture freeze landed on `main`
and the prior Chunk 35 documentation-only gate was recorded.

The earlier stop is historical: [`chunk-35-stop.md`](./chunk-35-stop.md).

Canonical owner remains `packages/sunrey-chain`. Networking is an
internal module at `packages/sunrey-chain/node`. Do not create
`packages/p2p`, `packages/sunrey-p2p`, `packages/mempool`,
`packages/devnet`, or `packages/gossip`.

## What this chunk implements

- Authenticated node identity (`NodeId`, `PeerPublicKey`,
  `PeerIdentity`, `PeerAddress`, `PeerSession`) on a node-local
  CryptoSuite: Ed25519 + SHA-256, domain-separated from wallet,
  validator, governance, and Execution Authority keys.
- Quinn QUIC + rustls TLS 1.3 transport (ADR-0023 addendum).
- Handshake over network ID, chain ID, genesis hash, node ID,
  protocol / codec / suite versions, height, feature bits, and
  timestamp / nonce anti-replay.
- Peer manager: seeds, allow-list, known-peer persistence, inbound /
  outbound / per-IP limits, deduplication, reconnect backoff, health,
  last seen, failure count, misbehavior score, temporary ban, manual
  disconnect.
- Channel priorities: `CONSENSUS_RESERVED`, `PEER_CONTROL`,
  `BLOCK_GOSSIP`, `STATE_SYNC`, `TRANSACTION_GOSSIP`.
- Bounded mempool with ID dedup, stateless / signature / replay /
  stateful admission, global and per-actor limits, expiration,
  deterministic selection, commit removal, and revalidation.
- Transaction and block gossip (announce / request / response).
- Block-range sync with local execution and recomputed roots.
- Development `FORK_DETECTED` evidence. No longest-chain rule.
- Abuse controls and decoder fuzz targets.
- Three-node development network command and required demo.

## What this chunk does not implement

- Production BFT voting (Chunk 36+).
- Public testnet or mainnet.
- A second financial ledger.
- Native-asset minting, journal posting, Execution Authority,
  KYC / Consent / Risk mutation, CryptoSuite policy changes,
  governance changes, or validator voting-power changes.

`ENVIRONMENT` remains `simulation`. Every `LIVE_*` flag remains
false.

## Development node host

P2P attaches to a local deterministic development host in the same
crate: genesis, sequential apply, recomputed state roots, and a
single development producer. That host is the attachment surface
required to exercise gossip and sync. It is not production consensus
and not a second ledger.

## Transport

Quinn + rustls. See the addendum in
[`adr/ADR-0023-sunrey-blockchain-networking-p2p.md`](./adr/ADR-0023-sunrey-blockchain-networking-p2p.md).
