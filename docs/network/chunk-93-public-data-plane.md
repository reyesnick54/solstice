# Chunk 93 — SunRey public RPC and Explorer data plane

Owner: `packages/sunrey-chain/src/public-data-plane`.
Capability `sunrey-public-data-plane` is `IMPLEMENTED`.

The public data plane is the production-grade access layer for SunRey
Blockchain. RPC reads canonical chain state. Explorer projections are
rebuildable and never authoritative. This is not a second consensus,
not a second financial ledger, and not a public validator admin
surface.

`ENVIRONMENT` remains `simulation`. No `LIVE_*` flag is enabled.

## Builds on

- Chunk 51 SDK / versioned `/v1` API
- Chunk 52 rebuildable Explorer
- Chunk 53 public testnet
- Chunk 54 validator / sentry operations
- Chunk 55 observability
- Chunk 66 network zones
- Chunk 81 Candidate V2
- Chunk 86 provisioning
- Chunk 90 day-2 operations

## Named components

| Component | Role |
| --- | --- |
| `PublicRpcGateway` | Public edge in the `PUBLIC_RPC` zone |
| `RpcEndpointPool` | Multi-node RPC inventory |
| `RpcRequestPolicy` | Class, stale-sync, and operator isolation |
| `RpcQuotaPolicy` | Anonymous and API-key quotas |
| `RpcRateLimitPolicy` | Distributed-safe cost-unit limits |
| `RpcAbuseProtection` | Flood, payload, subscription, and connection bounds |
| `RpcHealthRouter` | Health / sync / load / archive routing |
| `RpcCachePolicy` | Deterministic public-read cache only |
| `RpcSubscriptionGateway` | Bounded finalized-event subscriptions |
| `ArchiveQueryService` | Historical queries off the validator path |
| `ExplorerIndexerFleet` | Rebuildable multi-indexer projections |
| `ExplorerQueryApi` | HA query failover |
| `ExplorerHighAvailabilityState` | Health, lag, and divergence |
| `PublicNetworkStatus` | Public network banner |
| `PublicDataPlaneReport` | Operator report without private internals |

## Authority

Canonical chain state is the source of truth. Explorer hashes are
compared for divergence; a corrupt or lagged indexer is rebuilt from
finalized chain data.

## Forbidden packages

Do not create `packages/public-rpc`, `packages/sunrey-rpc-edge`,
`packages/rpc-gateway`, `packages/explorer-ha`, or
`packages/public-data-plane`.
