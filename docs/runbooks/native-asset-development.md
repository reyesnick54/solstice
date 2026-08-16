# Native asset development runbook

Simulation / development only. Public tickers remain `NOT_ASSIGNED`.
Issued faucet units are `DEVELOPMENT_ECONOMIC_UNIT`.

## Local node CLI

```
cargo run --manifest-path packages/sunrey-chain/rust/crates/rpc/Cargo.toml -- \
  init --data-dir /tmp/sunrey-assets

cargo run --manifest-path packages/sunrey-chain/rust/crates/rpc/Cargo.toml -- \
  asset list --data-dir /tmp/sunrey-assets

cargo run --manifest-path packages/sunrey-chain/rust/crates/rpc/Cargo.toml -- \
  asset show --data-dir /tmp/sunrey-assets SUNREY_COIN

cargo run --manifest-path packages/sunrey-chain/rust/crates/rpc/Cargo.toml -- \
  asset faucet --data-dir /tmp/sunrey-assets \
  --asset SUNREY_COIN --recipient alice --quantity 100 --auth-id faucet-1
```

The faucet command prints that the environment is
development/simulation. Production networks cannot invoke it.

Other queries:

```
sunrey-node asset supply --data-dir DIR SUNREY_COIN
sunrey-node asset holdings --data-dir DIR alice
sunrey-node asset locks --data-dir DIR alice
sunrey-node asset transfer --data-dir DIR --from alice --to bob --asset SUNREY_COIN --quantity 10
sunrey-node asset reconciliation --data-dir DIR
```

## Four-validator BFT demo

```
npm run demo:sunrey-native-assets
```

or

```
cd packages/sunrey-chain/node
cargo run --bin sunrey-native-asset-demo
```

The demo initializes a four-validator development network, registers
both native assets, issues development units through the faucet,
transfers, locks, rejects a locked overspend, unlocks, burns, and
checks identical state roots.

## Operator queries on a P2P node

```
sunrey-node asset list
sunrey-node asset show SUNREY_COIN
sunrey-node asset supply MOONREY_COIN
sunrey-node asset holdings <actor>
sunrey-node asset locks <actor>
sunrey-node asset reconciliation
sunrey-node asset faucet
```

`asset faucet` on the P2P operator CLI identifies the development
environment and does not mint on a production network.
