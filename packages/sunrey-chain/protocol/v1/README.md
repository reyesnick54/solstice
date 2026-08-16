# SunRey transaction protocol v1

Language-neutral contract for later Rust node code.

| Item | Value |
| --- | --- |
| Schema | `sunrey_tx_v1.proto` |
| Codec ID | `sunrey.protobuf.canonical.v1` |
| Schema version | `1` |
| IDL | Protocol Buffers proto3 |
| Hash | SHA-256 via `packages/security` (no new algorithm) |
| Public tickers | `NOT_ASSIGNED` |
| MoonRey issuance | development faucet / authorized proof only; production economics later |
| Native fees | Chunk 42 integer resource metering. Default fee asset `SUNREY_COIN`. MoonRey fee asset disabled. |

Consensus hashes are computed from the deterministic protobuf bytes
defined in ADR-0021 Addendum A. The JSON files under
`protocol/test-vectors/v1/` are fixtures only. Do not hash the JSON
projection.

TypeScript reference: `packages/sunrey-chain/src/protocol/`.
