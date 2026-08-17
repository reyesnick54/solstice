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
