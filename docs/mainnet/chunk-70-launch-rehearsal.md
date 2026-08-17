# Chunk 70 — SunRey full mainnet launch rehearsal

This chunk executes a production-like **rehearsal**. It does not launch
SunRey mainnet. It does not activate live customer funds, regulated
Exchange trading, live custody, fiat, payments, cards, investments, or
production interoperability.

`LIVE_*` values remain inactive. `ENVIRONMENT` remains `simulation`.

## Network identity

| Field | Value |
| --- | --- |
| Display name | SunRey Mainnet Rehearsal 1 |
| Rehearsal ID | `rehearsal_sunrey_mainnet_1` |
| Network ID | `net_sunrey_mainnet_rehearsal_1` |
| Chain ID | `chn_sunrey_mainnet_rehearsal_1` |
| Network class | `RESERVED_TEST` (test/rehearsal) |
| Address HRP | `srtst` (test class; not production `srprd`) |
| Explorer banner | `MAINNET REHEARSAL` |

The rehearsal must not reuse the production-candidate network ID, chain
ID, genesis hash, or real production keys.

## What is rehearsed

Genesis preparation, infrastructure provisioning, secure configuration,
validator and signer bring-up, sentry topology, BFT formation, RPC,
Explorer, oracle collectors, Exchange/custody sandbox dependencies,
monitoring, backups, recovery, security incident handling, launch
command structure, operational handoffs, and readiness reporting.

## Success classification

- `REHEARSAL_INCOMPLETE`
- `REHEARSAL_COMPLETED_WITH_FINDINGS`
- `ENGINEERING_REHEARSAL_QUALIFIED`

None of these means production mainnet is authorized.

## Owner

`packages/sunrey-chain/src/launch-rehearsal`

Do not create `packages/sunrey-launch`, `packages/launch-rehearsal`, or
`packages/mainnet-rehearsal`.

Chunk 80 adds `sunrey-launch economic-*` commands and a distinct
economic-rehearsal identity (`SunRey Economic Mainnet Rehearsal 1`,
HRP `srecr`). It does not replace this launch rehearsal and does not
reuse this network ID, chain ID, or genesis. See
[chunk-80-economic-mainnet-rehearsal.md](./chunk-80-economic-mainnet-rehearsal.md).
