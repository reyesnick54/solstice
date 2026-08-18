# Runbook — Mainnet RC qualification

## Create and qualify

```
npm run sunrey-release -- mainnet create --profile smoke --id SUNREY_MAINNET_RC_1
npm run sunrey-release -- mainnet qualify --profile smoke
npm run sunrey-release -- mainnet verify
npm run sunrey-release -- mainnet status
npm run sunrey-release -- mainnet limitations
npm run sunrey-release -- mainnet evidence
```

Store: `dist/mainnet-rc/`.

## Bindings to verify

- Source commit matches the candidate commit under test
- Candidate V2 root hash matches the frozen production-network candidate
- Economic RC hash matches the frozen Chunk 78 policy bundle
- Provider matrix shows actual states (unconfigured / engineering
  tested / externally evidenced / human accepted / production eligible)
- Audit snapshot does not claim an external pass
- HSM state is exact; fixture HSM is not external hardware
- `mainnetEnabled=false`

## Manual extended workflows

These are not claimed by smoke CI:

```
npm run sunrey-release -- mainnet qualify --profile extended
```

Extended profile records that longer workflows were requested. It
does not invent a soak duration, full adversarial range, or
long-horizon economics campaign that was not run.

## Human approval

If repository policy requires human release approval, record it as
external/human evidence. CI cannot synthesize it. AI authorization is
rejected.

## Supersede

```
npm run sunrey-release -- mainnet supersede --commit <new-commit>
npm run sunrey-release -- mainnet compare
```

A material source, protocol, economic, candidate, provider, or
security change requires a new RC.
