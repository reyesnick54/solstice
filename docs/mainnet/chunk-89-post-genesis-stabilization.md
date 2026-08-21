# Chunk 89 — SunRey post-genesis stabilization

Owner: `packages/sunrey-chain/src/post-genesis`.

SunRey has a governed post-genesis stabilization architecture in which
chain health, economic integrity, and each customer-facing capability
are independently verified and progressively eligible for activation.
Blockchain genesis does not automatically enable regulated or high-risk
financial services.

## Phase model

Initial phase: `CHAIN_STABILIZATION`.

Governed phases:

- `CHAIN_STABILIZATION`
- `NATIVE_ASSET_LIMITED`
- `ORACLE_LIMITED`
- `ECONOMIC_SERVICES_LIMITED`
- `REGULATED_SERVICES_ELIGIBLE`
- `FULL_CONFIGURED_OPERATIONS`

During chain-only stabilization, consensus, validators, monitoring, and
backups operate. RPC and Explorer may operate according to policy.
High-risk financial capabilities remain independently disabled.

Phase advancement is governed and evidence-driven. Engineering criteria
are machine-readable. Missing external or human evidence remains
visible.

## Checkpoints and health

Qualification uses deterministic protocol checkpoints based on height,
epoch, and finalized state. UI timers are not a substitute.

Each configured checkpoint captures validator participation, finality,
state-root agreement, peer and signer health, storage, database, RPC,
Explorer, backup, oracle health, economic state, and open incidents.

Conflicting-finality evidence is a critical `CONSENSUS` incident. It is
never classified as availability noise. Incident handling cannot rewrite
finalized blocks.

## Capability activation

`CapabilityActivationPackage` binds capability, network, chain, release,
active protocol, required providers, legal/regulatory/security/operations
evidence, human authority, activation coordinate, and restrictions.

Capabilities activate independently. A healthy chain does not authorize
Exchange, custody, fiat, payments, cards, investments, Human
Information, productive markets, or interoperability.

AI can prepare evidence summaries and cannot authorize production
activation. One package cannot be reused for a different network, chain,
release, capability, or policy version.

`realProductionCapabilitiesActivated=false`.

Chunk 166 extends this owner with a staged capability activation
plan at `packages/sunrey-chain/src/post-genesis/staged-activation`.
See [`docs/operations/chunk-166-staged-capability-activation.md`](../operations/chunk-166-staged-capability-activation.md).
