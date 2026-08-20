# Chunk 158 — Full-platform production-candidate burn-in

This chunk extends the existing production-handoff owner at
`packages/sunrey-chain/src/production-handoff`. It does **not** create a
second full-platform release authority.

Capability `sunrey-production-handoff` remains `IMPLEMENTED`. The new
submodule lives at
`packages/sunrey-chain/src/production-handoff/full-platform-candidate`.

## What this is

A binder of evidence references, content hashes, version IDs, capability
IDs, and test receipts. It proves the platform can run as one coherent
**production-candidate simulation**.

Passing engineering simulation is **not**:

- a licensed bank
- an approved exchange or VASP
- payment-network membership
- regulatory approval
- a real provider contract
- a real HSM attestation
- approved production tokenomics
- mainnet authorization

Those external and human lanes stay explicit and unsatisfied.

## Bundle states

`INCOMPLETE`, `ENGINEERING_FAILED`, `ENGINEERING_RECONCILED`,
`BURN_IN_FAILED`, `BURN_IN_PASSED`, `AWAITING_PRODUCTION_PARAMETERS`,
`AWAITING_EXTERNAL_PROVIDER_EVIDENCE`, `AWAITING_SECURITY_AUDIT`,
`AWAITING_LEGAL_REGULATORY_EVIDENCE`, `AWAITING_HUMAN_GOVERNANCE`,
`PRODUCTION_CANDIDATE_REVIEW_READY`.

`PRODUCTION_ACTIVE` is not an outcome. The Chunk 143 activation
firewall continues to block production. The bundle cannot override it.
There is no `force`, `admin`, `testOnly`, `skip`, or `emergencyBypass`
path.

## Burn-in profiles

- `SMOKE` — normal CI
- `STANDARD` / `EXTENDED` — scheduled / dispatch workflow

Same source commit, fixture version, seed, and profile produce the same
canonical qualification hashes. Environmental metrics are hashed
separately.

## Commands

```
npm run sunrey-ops -- production full-platform rehearse
npm run sunrey-ops -- production full-platform verify
npm run sunrey-ops -- production full-platform report
npm run demo:sunrey-full-platform-candidate
```

## Expected current result

Engineering can be `PRODUCTION_CANDIDATE_REVIEW_READY` (ready for
human / external review) while production remains blocked by
unconfigured production parameters, missing external provider evidence,
missing legal / regulatory approvals, disabled production connectivity,
and absent human activation authorization.

`PRODUCTION_ACTIVE` remains `false`.
