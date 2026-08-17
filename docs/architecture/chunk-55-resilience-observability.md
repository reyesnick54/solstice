# Chunk 55 — SunRey multi-failure-domain resilience and observability

Implemented on latest `main` after Chunk 50. Chunks 51–54 were not
present on `main`; this chunk reuses the existing verified-snapshot
and signer-safety primitives and adds operator fencing, backup, and
disaster-recovery drills.

Canonical owner remains `packages/sunrey-chain`.

- TypeScript platform: `packages/sunrey-chain/src/ops/`
- Rust checks: `packages/sunrey-chain/rust/crates/ops`
- Reproducible configs: `packages/sunrey-chain/ops/`
- CLI: `sunrey-ops`

Do not create `packages/sunrey-ops`, `packages/observability`,
`packages/disaster-recovery`, or a competing chain.

## Core principle

SunRey infrastructure can be observed, backed up, restored, and
operated across multiple provider-neutral failure domains. BFT safety
and canonical financial-state invariants stay with their existing
owners. Engineering SLOs are `ENGINEERING_TEST_TARGETS` until real
production operations approve them.

## Failure domains

A `FailureDomain` is provider-neutral: region, availability zone,
data center, or operator network. Cloud-specific adapters are not
the architecture.

A sovereign deployment cell may host RPC, indexer, Explorer, relays,
monitoring agents, and service databases. Validator placement and
signer trust zones remain separately controlled.

## Seven-validator development profile

Seven equal-power validators are placed `3 + 2 + 2` across three
simulated domains. No single domain has two-thirds-plus voting power.
Architecture validation refuses a concentrating placement.

## Observability

OpenTelemetry-compatible collector, Prometheus-compatible metrics,
and Grafana-compatible dashboards live in repository configuration.
Consensus-critical logic does not depend on tracing success.

Metrics, traces, and logs refuse private keys, raw KYC, PDV payloads,
Clean Room raw data, consent content, and HSM secret references.

## Backup and recovery

Backup classes each have an explicit recovery strategy. Sensitive
material uses canonical `BACKUP_ENCRYPTION`. Validator consensus
signing keys are never reused.

Explorer state is rebuildable from chain. Application database
restore runs integrity and reconciliation checks and never invents
financial balancing entries.

## Signer fencing

Active/passive fencing ensures one consensus key cannot be live in
two locations. A stale signer-safety restore cannot reduce the known
high-watermark.

`ENVIRONMENT` remains `simulation`. Every `LIVE_*` flag remains false.
