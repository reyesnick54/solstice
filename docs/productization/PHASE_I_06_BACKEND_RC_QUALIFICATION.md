# Phase I Prompt 6 — backend production release candidate

Qualification record. Not a new architecture layer.

RC: `sunrey-backend-v1.0.0-rc.1`

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

## Environment limitations (not faked)

- Docker / PostgreSQL were not available in the qualification VM.
- Container digests were not built.
- Full-duration soak was not run.
- No live credentials, licenses, or external audit reports exist.

## Commands

```
npm run qualify:backend-rc
npm test
```
