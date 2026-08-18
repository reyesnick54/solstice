# Authorized genesis execution runbook

This runbook exercises the Chunk 88 architecture. It does not launch
production mainnet.

## Rehearsal (CI and engineering)

```
npm run sunrey-launch -- production plan
npm run sunrey-launch -- production verify
npm run sunrey-launch -- production authorization
npm run sunrey-launch -- production permit
npm run sunrey-launch -- production readiness
npm run sunrey-launch -- production control-room
npm run sunrey-launch -- production execute
npm run sunrey-launch -- production first-block
npm run sunrey-launch -- production report
```

All of these commands use isolated rehearsal inputs.
`realProductionExecutionPerformed=false`.

## Production

Production mode consumes actual network identifiers, provider evidence,
human signatures, and ceremony artifacts. Fixture, testnet, shadow, and
rehearsal artifacts are rejected.

Do not run production execute as part of automated CI.

## Authority

Human roles required for execution:

- Genesis Authority
- Protocol Authority
- Security Authority
- Release Authority

AI cannot occupy those roles. Engineering qualification is not
authorization.

## After first block

Do not rewrite finalized history. Customer financial capabilities
remain independently gated. Genesis does not enable Exchange, custody
withdrawals, fiat rails, payments, cards, investments, Human
Information markets, or production interop.
