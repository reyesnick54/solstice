# Chunk 163 — Production economic authorization

This chunk builds the human-governance package that would be needed
later to review and approve exact production economic parameters. It
does **not** activate production and does **not** choose tokenomics.

Canonical owners:

- `packages/sunrey-chain/src/economics/production-activation`
- `packages/sunrey-chain/src/governance-ops` (orchestration)

Capability: `sunrey-production-economic-authorization`.

Chunk 71 remains the mint / issuance authority. `AssetSupplyBook`
remains the supply authority.

## What this is

An authorization wrapper over existing Chunk 144–148 parameter
packages. `ProductionEconomicAuthorizationPackage` binds:

- parameter package hash
- SunRey and MoonRey policy hashes
- economic constitution candidate hash
- economic RC and full-platform candidate hashes
- external evidence bundle hash
- operating scope matrix hash
- provider binding matrix hash
- architecture manifest hash
- source commit
- parameter statuses
- approval window
- required human roles
- authorization hash

`productionActivationRequested` is always `false`.

## Lifecycle

`DRAFT` → `PARAMETERS_INCOMPLETE` → `PREFLIGHT_REQUIRED` /
`PREFLIGHT_FAILED` / `PREFLIGHT_PASSED` → `EXTERNAL_EVIDENCE_REQUIRED`
→ `AWAITING_HUMAN_APPROVALS` → `APPROVALS_SATISFIED` →
`AUTHORIZED_CANDIDATE`, plus `EXPIRED` / `REJECTED` / `SUPERSEDED`.

`PRODUCTION_ACTIVE` is not a package state. `AUTHORIZED_CANDIDATE`
means the human governance package is complete, not that production is
running.

## Current repository result

Production values remain `UNCONFIGURED`. Rehearsal fixtures attach only
as `REHEARSAL_REFERENCE` and cannot be promoted. Expected current
result is `PARAMETERS_INCOMPLETE` and/or `EXTERNAL_EVIDENCE_REQUIRED`
and/or `AWAITING_HUMAN_APPROVALS`.

## Approvals

Required human roles are reused from governance-ops:

`PROTOCOL_AUTHORITY`, `SECURITY_AUTHORITY`, `OPERATIONS_AUTHORITY`,
`RELEASE_AUTHORITY`, `ECONOMIC_POLICY_AUTHORITY`,
`VALIDATOR_GOVERNANCE_AUTHORITY`.

AI, agents, and automation cannot approve. S3M may summarize a diff
and highlight risk. It cannot sign, vote, approve, or set values.

Approvals bind package hash, policy version, network/chain identity,
approval window, and the parameter diff. Distinct roles require
distinct actors. Signatures expire when the window, parameter hash,
evidence, provider matrix, operating scope, or release candidate
changes.

## Evidence, scope, and providers

The package binds current external-evidence slots (security audit,
counsel opinion, license, regulatory approval, provider contract, HSM
attestation). Expired or revoked evidence stale the package.

Native protocol economics is separated from regulated service
activation (banking, payments, Exchange, custody, HIN). A global
economic package cannot activate those products.

Missing provider bindings block only the relevant activation domain.
An unrelated provider does not block the chain protocol.

## Genesis and coins

Production genesis allocations remain unauthorized unless supplied and
separately approved. Hard invariants:

- `hiddenPremint=false`
- `inheritedTestnetFaucet=false`
- `migratedApplicationLedgerBalances=false`
- `wrappedFiat=false`

SunRey issuance proposals bind verified human economic contribution,
valuation policy, conversion policy, rights/consent evidence, and
Chunk 71. PEVE is not a measure of how much a person is worth and
cannot value SunRey.

MoonRey issuance proposals bind source taxonomy, canonical units,
oracle eligibility, economic event identity, attribution, Productive
Value, GPUV conversion, and Chunk 71. Reference price cannot mint.

## Firewall

The authorization package feeds the Chunk 143 activation firewall. The
firewall still returns production inactive. There is no bypass, force,
or hidden override. `ENVIRONMENT` remains `simulation`. All `LIVE_*`
flags remain false.

## Commands

```
npm run demo:sunrey-production-economic-authorization
```
