# Chunk 90 — SunRey production handoff

See [../mainnet/chunk-90-production-handoff.md](../mainnet/chunk-90-production-handoff.md).

Owner: `packages/sunrey-chain/src/production-handoff`.
Capability `sunrey-production-handoff` is `IMPLEMENTED`.

Do not create `packages/production-handoff`, `packages/sunrey-handoff`,
`packages/day-2-ops`, `packages/production-ops`,
`packages/operator-acceptance`, `packages/incident-v2`, or
`packages/recovery-v2`.

Chunk 167 extends application-rollback records on this owner.
`APPLICATION_ROLLBACK_IS_NOT_CHAIN_HISTORY_ROLLBACK` remains true.

Chunk 91 attaches executable provider-runtime status to day-2 provider
renewal, outage, rotation, and replacement workflows without converting
engineering connectivity into observed production.
