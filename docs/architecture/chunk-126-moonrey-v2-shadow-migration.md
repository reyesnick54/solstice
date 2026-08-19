# Chunk 126 — MoonRey V2 shadow evaluation and migration hardening

Canonical owner: `packages/sunrey-chain`.

Capability `moonrey-v2-shadow-economics` is `IMPLEMENTED` at
`packages/sunrey-chain/src/productive/policy-governance/shadow-economics`.

This chunk extends the existing `moonrey-policy-governance` owner. It
does not create a second value engine, mint, ledger, or production
activation path.

See [`docs/economics/chunk-126-moonrey-v2-shadow-migration.md`](../economics/chunk-126-moonrey-v2-shadow-migration.md).

## Path boundary

- V1 remains the legacy engineering-simulation model
  (`LEGACY_ENGINEERING_SIMULATION_V1`).
- V2 is the governed-value simulation model
  (`GOVERNED_PRODUCTIVE_VALUE_SIMULATION_V2`).
- Production activation remains an explicit future governance boundary.
  The production path is `UNCONFIGURED`.

Passing tests cannot activate V2.

## Authority rule

A shadow comparison is not Execution Authority and not a MoonRey
issuance instruction. GPUV is not MoonRey. A V2 candidate quantity
cannot authorize issuance. Chunk 71 remains the monetary authority.
