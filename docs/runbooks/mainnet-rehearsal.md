# Runbook — mainnet rehearsal

## Purpose

Execute a production-like dry run of SunRey Mainnet Rehearsal 1.

## Preconditions

- `ENVIRONMENT=simulation`
- All `LIVE_*` flags false
- Fixture environment allowed (`SUNREY_FIXTURE_ENV=local` or CI/test)
- No production private keys or provider credentials

## Commands

```
npm run sunrey-launch -- rehearse
npm run sunrey-launch -- status
npm run sunrey-launch -- verify
npm run sunrey-launch -- report
npm run sunrey-launch -- findings
npm run sunrey-launch -- activation-plan
```

## Failure injection

```
npm run sunrey-launch -- inject-failure VALIDATOR_UNAVAILABLE
npm run sunrey-launch -- recover VALIDATOR_UNAVAILABLE
```

## Stop conditions

Stop and do not represent the network as production if:

- rehearsal identity collides with the production candidate
- genesis hash matches the production candidate
- a validator private key appears on RPC/sentry
- `LIVE_*` would need to be enabled
- customer data or funds would be required
