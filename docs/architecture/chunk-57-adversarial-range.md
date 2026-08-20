# Chunk 57 — SunRey adversarial cyber-economic test range

Implemented on latest `main` after Chunk 55. Chunk 56 was not present
on this repository.

Canonical owner: `packages/sunrey-range`.

- Types and catalog: `packages/sunrey-range/src`
- Isolated 7-validator range: `createRangeEnvironment`
- CLI: `sunrey-range`
- Assurance docs: `docs/assurance/`

Do not create `packages/red-team`, `packages/attack-sim`,
`packages/sunrey-pentest`, or a competing chain.

## Core principle

SunRey has a deterministic, isolated development/testnet security
range. Red actions are in-process test actors. No external hosts,
internet scanning, or production banks. Detector output is not legal
guilt.

## Protected capability

`sunrey-adversarial-range` is `IMPLEMENTED` at
`packages/sunrey-range`. The range is an adapter/harness. Canonical
financial-state owners remain the Compliance Kernel, ledger, accounts,
and existing SunRey engines.

## Invariants

See [`docs/assurance/security-invariants.md`](../assurance/security-invariants.md).

## Operations

See [`docs/assurance/range-operations.md`](../assurance/range-operations.md).

## Chunk 157 extension

Chunk 157 adds a production-safety campaign on this same owner.
Capability `sunrey-adversarial-range` is unchanged. New scenario
families live under `packages/sunrey-range/src/scenarios/` and
cover credential, provider, payment, compliance, Travel Rule,
oracle, productive-economy, human-economy, custody, persistence,
event, distributed-idempotency, economic-constitution, AI
authority, observability, and control-room failure modes.

```
npm run sunrey-range -- campaign --production-safety-smoke
npm run sunrey-range -- campaign --production-safety-extended
npm run demo:sunrey-production-adversarial-campaign
```

See [`docs/security/chunk-157-production-adversarial-resilience.md`](../security/chunk-157-production-adversarial-resilience.md).
