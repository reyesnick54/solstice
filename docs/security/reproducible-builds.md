# Reproducible builds

High-value artifacts for two-builder comparison:

- `sunrey-node` locked sources
- consensus-critical Rust libraries (`sunrey-consensus`, `sunrey-crypto`)
- protocol schema `srcb-v1.json`

## How comparison works

Builder A and Builder B receive the same source commit and lockfiles.
Each produces a canonical artifact digest (sorted paths, raw bytes,
no timestamps). Digests are compared.

- Identical digests → `MATCHED`
- Different digests → `NOT_REPRODUCED` plus a structured difference
  report
- Not run → `NOT_ATTEMPTED`

A build is never labeled reproducible unless the two digests match.

## Deterministic exceptions

Rustc may embed absolute paths or debug metadata when a full binary
is compiled outside this canonical recipe. Those exceptions must be
recorded in the difference report. `SOURCE_DATE_EPOCH=0`,
`CARGO_INCREMENTAL=0`, and `--locked` are the intended cargo flags
when a binary two-build is attempted.

The governance `ReleaseManifest.reproducedInCi` field remains `false`
unless an independent two-builder job actually matched.

## Command

```
npm run sunrey-release -- compare-builds
```
