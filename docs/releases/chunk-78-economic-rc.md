# Chunk 78 — SunRey economic release candidate

This document describes the economic release-candidate freeze and
qualification platform.

It is **TESTNET / PRODUCTION-CANDIDATE** economic qualification. It
does not authorize mainnet or production financial services. Public
tickers remain `NOT_ASSIGNED`. Production parameters remain
`UNCONFIGURED`. Qualification states are engineering results and do
not imply regulatory approval.

## Identity

Economic release candidates use versioned ids such as
`SUNREY_ECONOMIC_TESTNET_RC_1`. This extends the Chunk 63
`SUNREY_TESTNET_RC_*` scheme; it is not a second general release
system.

## Owner

Canonical owner: `packages/sunrey-chain/src/release-candidate/economic`.

CLI:

```
npm run sunrey-release -- economic create --profile smoke
npm run sunrey-release -- economic qualify --profile smoke
npm run sunrey-release -- economic status
npm run sunrey-release -- economic verify
npm run sunrey-release -- economic compare
npm run sunrey-release -- economic supersede
```

Profiles:

- `smoke` — bounded PR/CI economic qualification
- `full` — complete current-repository economic qualification
- `extended` — scheduled/manual longer campaign; never claims a
  long-horizon duration unless that duration actually completed

## Signing

Chunk 59 `ReleaseAuthority` signs the economic manifest, policy
bundle, qualification report, formal report, stress report, and
SBOM/provenance references. Signing does not activate economic
policy and is not Execution Authority.

## What is frozen

Exact versions and hashes for SunRey/MoonRey monetary policy,
validator bond/reward/penalty policy, FeePolicyV2, resource weights,
fee disposition, MoonRey productive policy, normalization, issuance
budgets, protocol treasury policy, and the dual-economy scenario
schema. Breaking schema changes create a new economic RC.

## Known gaps

Chunks 76 (economic stress lab) and 77 (protocol treasury) are not
separate packages on this `main`. Stress qualification uses the
existing dual-economy adversarial adapter and Chunk 57 critical
invariants. Treasury qualification freezes the FeePolicyV2
`PROTOCOL_TREASURY` sink and records production budget/disbursement
as `UNCONFIGURED`.

See [economic-qualification.md](./economic-qualification.md),
[economic-policy-freeze.md](./economic-policy-freeze.md),
[economic-compatibility.md](./economic-compatibility.md), and
[economic-known-limitations.md](./economic-known-limitations.md).
