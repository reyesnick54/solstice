# SunRey Testnet 1

This repository package deploys a reproducible **SunRey public test network**.

It is not mainnet. It does not activate production financial services.
SunRey Coin and MoonRey Coin testnet units have **no implied monetary value**.
Public tickers remain `NOT_ASSIGNED`. `ENVIRONMENT` stays `simulation`.
`LIVE_*` flags stay false.

## Identity

| Field | Value |
| --- | --- |
| Display name | SunRey Testnet 1 |
| Banner | SUNREY TESTNET |
| Network ID | `net_sunrey_testnet_1` |
| Chain ID | `chn_sunrey_testnet_1` |
| Address HRP | `srtst` |
| SDK name | `SUNREY_TESTNET_1` |
| Validators | 7, equal voting power |
| Environment | simulation |

Development addresses use `srdev`. Testnet addresses use `srtst`.
The local development IDs `net_sunrey_local_dev`, `net_sunrey_simulation`,
and `net_sunrey_development` are never reused.

## Operator commands

```bash
node scripts/sunrey-genesis.mjs genesis
node scripts/sunrey-genesis.mjs ceremony
node scripts/sunrey-genesis.mjs verify
node scripts/sunrey-testnet-bootstrap.mjs
bash scripts/sunrey-testnet-kind.sh
node scripts/sunrey-testnet-sbom.mjs
```

## Documents

- [Genesis ceremony](./genesis-ceremony.md)
- [Network configuration](./network-configuration.md)
- [Faucet](./faucet.md)
- [Deployment](./deployment.md)
- [Network reset](./network-reset.md)
- [Security boundaries](./security-boundaries.md)
