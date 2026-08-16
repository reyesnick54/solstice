# Local SunRey development node

This is a **local development / simulation** node. It is not production
BFT consensus and not a public network.

## Build

```bash
cargo build --manifest-path packages/sunrey-chain/rust/Cargo.toml -p sunrey-rpc --bin sunrey-node
```

Binary: `packages/sunrey-chain/rust/target/debug/sunrey-node`

## Commands

```bash
sunrey-node init --data-dir /tmp/sunrey-dev
sunrey-node run --data-dir /tmp/sunrey-dev --listen 127.0.0.1:18432
sunrey-node status --data-dir /tmp/sunrey-dev
sunrey-node submit --data-dir /tmp/sunrey-dev --demo
sunrey-node produce-block --data-dir /tmp/sunrey-dev
sunrey-node block --data-dir /tmp/sunrey-dev --height 1
sunrey-node tx --data-dir /tmp/sunrey-dev --id <txid>
sunrey-node verify --data-dir /tmp/sunrey-dev
```

`run` binds loopback by default. `/admin/produce-block` is a
development admin action.

Optional `--interval-ms` enables `DEV_BLOCK_PRODUCER` interval mode.
That is still not consensus.

## One-command demo

```bash
npm run demo:sunrey-node
```

## Identifiers

- network: `net_sunrey_local_dev`
- chain: `chn_sunrey_local_dev`
- genesis hash (this implementation):
  `5716d8a36722b65f73c697e761ba572d13208f4edd1b708b4b095430cc22d14d`
