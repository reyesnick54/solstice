# Runbook — economic mainnet rehearsal

## Preconditions

- `ENVIRONMENT=simulation`
- All `LIVE_*` flags remain false
- `SUNREY_FIXTURE_ENV=local` for fixture rehearsal keys
- Do not use production keys, production genesis, or customer data

## Bounded rehearsal

```
npm run sunrey-launch -- economic-verify
npm run sunrey-launch -- economic-rehearse
npm run sunrey-launch -- economic-audit
npm run sunrey-launch -- economic-stress
npm run sunrey-launch -- economic-report
npm run sunrey-launch -- economic-evidence
npm run demo:sunrey-economic-mainnet-rehearsal
```

Confirm `productionAuthorized=false` in every report.

## Manual extended run

The 48-epoch workflow is documented only. Do not claim it ran unless
you execute:

```
SUNREY_FIXTURE_ENV=local npm run sunrey-economics -- dual simulate --scenario baseline --epochs 48 --seed 80
```

Use the same deterministic seed and rehearsal-only configuration.

## Abort conditions

- Economic RC signature, policy hash, or source-commit mismatch
- Genesis identity collision with production candidate or Chunk 70
- Supply, fee, treasury, or Exchange DVP mismatch
- Fabricated finalized state during a no-quorum partition
- Any attempt to enable `LIVE_*` or publish a production genesis

## After rehearsal

Feed engineering evidence into Chunk 65. Leave external and human
authorization slots incomplete. Do not launch production.
