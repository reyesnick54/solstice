# Chunk 80 — SunRey Economic Mainnet Rehearsal 1

This is a production-like economic rehearsal of the future SunRey
network. It is not mainnet activation.

## Identity

| Field | Value |
| --- | --- |
| Display name | SunRey Economic Mainnet Rehearsal 1 |
| Rehearsal ID | `rehearsal_sunrey_economic_mainnet_1` |
| Network ID | `net_sunrey_economic_mainnet_rehearsal_1` |
| Chain ID | `chn_sunrey_economic_mainnet_rehearsal_1` |
| Address HRP | `srecr` (rehearsal/test class) |
| Economic RC | `SUNREY_ECONOMIC_RC_1` |

The rehearsal does not reuse the Chunk 65 production-candidate network
ID, chain ID, genesis, or production address HRP `srprd`. It does not
reuse Chunk 70 launch-rehearsal IDs.

## What it exercises

- Deterministic economic genesis bound to protocol version, economic RC,
  seven-validator set, CryptoPolicy, monetary / FeePolicyV2 / validator /
  MoonRey / treasury / governance policies
- Explicit `REHEARSAL_ONLY` / `NO_PRODUCTION_VALUE` allocations
- Seven-validator bonds, rewards, one protocol-verifiable penalty, unbonding
- SunRey transfers, governed issuance, locks, fees
- MoonRey productive issuance across ENERGY, COMPUTE, AI_COMPUTE,
  AUTOMATED_MACHINE_OUTPUT, MANUFACTURING, LOGISTICS_TRANSPORTATION
- Anti-double-count rejection
- FeePolicyV2 under normal, high, PQ-heavy, Exchange-heavy, and oracle-heavy load
- Protocol treasury funding, budget, reservation, disbursement, cancel, return
- Canonical `SUNREY_COIN / MOONREY_COIN` market with synthetic order flow
- Machine commerce and a synthetic human/machine bridge
- Governed FeePolicyV2, MoonRey, and treasury policy version changes
- Economic stress, compound failure, validator/oracle/exchange/custody/treasury
  /storage/database recovery
- Explorer rebuild of economic views
- Formal trace conformance
- `EconomicActivationEvidenceBundle`

## What it does not do

- Publish a production genesis
- Launch production validator infrastructure
- Enable live Exchange, live custody, or fiat rails
- Migrate customer funds
- Assign public asset tickers
- Activate production monetary policies
- Change `ENVIRONMENT` or any `LIVE_*` flag
- Change the Chunk 65 production-candidate zero/unapproved allocation

## Result states

`ECONOMIC_REHEARSAL_INCOMPLETE`,
`ECONOMIC_REHEARSAL_COMPLETED_WITH_FINDINGS`, and
`ECONOMIC_ENGINEERING_REHEARSAL_QUALIFIED` are engineering states.
None authorizes production. `productionAuthorized` remains `false`.

## Commands

```
npm run sunrey-launch -- economic-rehearse
npm run sunrey-launch -- economic-status
npm run sunrey-launch -- economic-verify
npm run sunrey-launch -- economic-audit
npm run sunrey-launch -- economic-stress
npm run sunrey-launch -- economic-report
npm run sunrey-launch -- economic-evidence
npm run demo:sunrey-economic-mainnet-rehearsal
```

See also [economic-genesis-rehearsal.md](./economic-genesis-rehearsal.md),
[economic-control-room.md](./economic-control-room.md),
[economic-activation-evidence.md](./economic-activation-evidence.md),
[economic-rehearsal-findings.md](./economic-rehearsal-findings.md), and
[../runbooks/economic-mainnet-rehearsal.md](../runbooks/economic-mainnet-rehearsal.md).
