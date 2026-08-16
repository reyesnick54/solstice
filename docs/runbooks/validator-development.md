# Validator development runbook

Simulation only. This is not a public staking product.

## Generate the four-validator development set

From the local node CLI:

```
cargo run --manifest-path packages/sunrey-chain/rust/crates/rpc/Cargo.toml -- \
  validator generate --data-dir /tmp/sunrey-validators
```

From the P2P node binary:

```
cargo +stable run --manifest-path packages/sunrey-chain/node/Cargo.toml --bin sunrey-node -- \
  validator generate --data-dir /tmp/sunrey-validators
```

Private keys are omitted. The public set and hash are written to
`validator-set.public.json`.

## Inspect

```
sunrey-node validator show --data-dir /tmp/sunrey-validators
sunrey-node validator set --data-dir /tmp/sunrey-validators
sunrey-node validator verify-set --data-dir /tmp/sunrey-validators
sunrey-node validator signer-status --data-dir /tmp/sunrey-validators --validator-id val_dev_a
```

## Schedule changes

Key rotation and exit are queued for a future epoch. They do not
change the already-started epoch's voting power.

```
sunrey-node validator schedule-key-rotation --data-dir /tmp/sunrey-validators \
  --validator-id val_dev_a --activation-epoch 2
sunrey-node validator schedule-exit --data-dir /tmp/sunrey-validators \
  --validator-id val_dev_d --activation-epoch 2
```

Do not print or commit private keys. Do not debit customer accounts
or SunRey Coin. Do not issue MoonRey.
