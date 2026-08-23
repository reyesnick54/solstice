# Phase I Prompt 6 — backend production release candidate

Qualification record. Not a new architecture layer.

RC: `sunrey-backend-v1.0.0-rc.2` (supersedes `sunrey-backend-v1.0.0-rc.1`)

`BACKEND_PRODUCTION_RELEASE_CANDIDATE=true`
`PRODUCTION_READY=false`
`PRODUCTION_ACTIVE=false`

## Canonical owners (unchanged)

Ledger `packages/ledger`, Kernel `packages/kernel`, Execution Authority
`packages/permissions`, Identity `packages/identity`, compliance
`packages/kernel/src/compliance`, Agent `packages/sunrey-agent`,
Exchange `packages/sunrey-exchange`, Chain `packages/sunrey-chain`,
native supply `packages/sunrey-chain/src/economics/supply.ts`,
Provider binding `packages/sunrey-chain/src/providers`, Evidence Vault
`packages/evidence`, Personal Data Vault `packages/personal-data-vault`,
HIN `packages/information-market`.

## Genuine fixes in this prompt

1. Collapsed five duplicate `package.json` `"test"` keys into one union.
2. Marked the Prompt 2 inventory present on the authority map.
3. Required identity, compliance, HIN, and custody in `requiredAuthorityIds`.
4. Returned the sandbox Personal Data Vault from `createSandboxWorld`.
5. Removed an invalid `vault` argument from `ConsentDataRightsEngine`.
6. Closed a missing brace on `getMoonReyEconomicInput` in the consumer SDK.
7. Renamed the second `V038` customer migration to `V039` (vault productization).
8. Repaired Consumer BFF merge remnants: HIN/data-rights/vault dispatch, duplicate `hin`/`exchange` runtime fields, broken `dispatchExchange`, duplicate Grow opportunity adapter, mid-file Grow re-imports, concatenated HIN tests.
9. Routed `/api/v1/grow/portfolio/performance` (and sibling portfolio reads) through the existing Grow BFF surface.
10. Fixed the Phase I concurrency transfer fixture so the destination open no longer reused the source-account idempotency key.
11. Restored merged Agent/Grow/Exchange/HIN/Vault/SDK/catalog sources and the chain architecture-guard `src/runtime` allow-list so `npm test` is 3657 passed / 0 failed / 1 skipped.

## Environment limitations (not faked)

- Hosted preproduction cluster apply is not performed here.
- Full-duration soak was not run.
- No live credentials, licenses, or external audit reports exist.
- Container images are built locally / in CI and are not published to a registry.

## RC.2 clean qualification

Prompt 2 of the final deployment workflow re-qualifies the existing backend
from clean `main` after Prompt 1. It does not invent Phase J.

- Real PostgreSQL: empty → latest, prior schema → latest, restart, persistence,
  ledger invariants, duplicate-version check, migration-failure rollout gate.
- Real local OCI image for `deploy/sunrey-preproduction/docker/sunrey-platform.Dockerfile`.
- SBOM and provenance via `scripts/sunrey-release.mjs`.
- Rehearsal digest `sha256:6f1c2e8a…` remains a labeled
  `SIMULATION_REHEARSAL_PLACEHOLDER` in Helm/release fixtures.

## RC.2 measured results

- `npm test`: 3754 run, 3753 passed, 0 failed, 1 skipped
- TypeScript `tsc --noEmit`: PASS
- Rust `cargo +1.83.0 fmt/clippy/test --locked`: PASS
- PostgreSQL 16 from-zero, prior-schema upgrade, restart, ledger invariants: PASS
- Persistence integration: 38 passed, 0 failed
- Local OCI image + docker-save archive: real sha256 in
  `docs/productization/sunrey-backend-rc-artifacts.json` (`publishedToRegistry=false`)
- SBOM + provenance: generated
- Production flags: remain off

## Commands

```
npm ci --ignore-scripts
npm run build:backend-rc-artifacts -- --require-container
npm run qualify:backend-db
npm run qualify:backend-rc
npm test
```
