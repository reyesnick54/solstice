# Runbook — pre-genesis qualification

This runbook exercises the Chunk 87 shadow network. It does not launch
mainnet.

## Safety

- Use `SUNREY_FIXTURE_ENV=local` or CI/test fixture context only.
- Shadow keys and genesis are unusable as production inputs.
- Do not equate this rehearsal with legal or operator certification.
- `LIVE_*` flags remain disabled. `ENVIRONMENT` remains `simulation`.

## Bounded qualification

```
npm run sunrey-ops -- pregenesis create
npm run sunrey-ops -- pregenesis deploy-rehearsal
npm run sunrey-ops -- pregenesis qualify
npm run sunrey-ops -- pregenesis health
npm run sunrey-ops -- pregenesis report
npm run sunrey-ops -- pregenesis verify
```

## Failure rehearsal

```
npm run sunrey-ops -- pregenesis inject-failure ONE_VALIDATOR_LOSS
npm run sunrey-ops -- pregenesis recover ONE_VALIDATOR_LOSS
npm run sunrey-ops -- pregenesis inject-failure NO_QUORUM_PARTITION
npm run sunrey-ops -- pregenesis recover NO_QUORUM_PARTITION
```

Documented operator procedures covered: validator restart, sentry
replacement, RPC failover, signer incident, database recovery, chain
recovery, oracle incident, and provider outage.

## Extended burn-in

Use the manual workflow. Record the actual start and end timestamps
from that execution. Do not invent soak duration.
