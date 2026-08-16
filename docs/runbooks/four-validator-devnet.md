# Four-validator SunRey development network

Simulation only. Not a public testnet or mainnet.

## One command

From the repository root:

```bash
npm run demo:sunrey-validator-devnet
```

This launches four in-process validator hosts (A–D) over the real
Quinn P2P stack, each with:

- a separate data directory
- a separate consensus signer
- a separate P2P identity
- a separate operator HTTP endpoint
- the same genesis, validator-set hash, and consensus parameters

The demo submits a transaction to D, waits for gossip and BFT
finality across at least two heights, and checks that all four
report the same block ID, state root, and commit certificate.

## Four OS processes

Build the validator binary, then start A–D with distinct ports and
directories:

```bash
cargo build --manifest-path packages/sunrey-chain/node/Cargo.toml --bin sunrey-validator-node

SUNREY_VALIDATOR_NAME=A SUNREY_DATA_DIR=/tmp/sr-a \
  SUNREY_P2P_ADDR=127.0.0.1:26670 SUNREY_OPERATOR_ADDR=127.0.0.1:26680 \
  ./packages/sunrey-chain/node/target/debug/sunrey-validator-node &

SUNREY_VALIDATOR_NAME=B SUNREY_DATA_DIR=/tmp/sr-b \
  SUNREY_P2P_ADDR=127.0.0.1:26671 SUNREY_OPERATOR_ADDR=127.0.0.1:26681 \
  SUNREY_SEEDS=127.0.0.1:26670 \
  ./packages/sunrey-chain/node/target/debug/sunrey-validator-node &

SUNREY_VALIDATOR_NAME=C SUNREY_DATA_DIR=/tmp/sr-c \
  SUNREY_P2P_ADDR=127.0.0.1:26672 SUNREY_OPERATOR_ADDR=127.0.0.1:26682 \
  SUNREY_SEEDS=127.0.0.1:26670 \
  ./packages/sunrey-chain/node/target/debug/sunrey-validator-node &

SUNREY_VALIDATOR_NAME=D SUNREY_DATA_DIR=/tmp/sr-d \
  SUNREY_P2P_ADDR=127.0.0.1:26673 SUNREY_OPERATOR_ADDR=127.0.0.1:26683 \
  SUNREY_SEEDS=127.0.0.1:26670 \
  ./packages/sunrey-chain/node/target/debug/sunrey-validator-node &
```

Read APIs (finalized blocks only — uncommitted proposals are not
returned as committed):

- `GET /finalized_height`
- `GET /finalized_block?height=`
- `GET /commit_certificate?height=`
- `GET /validator_set_at_height?height=`
- `GET /consensus_round_at_commit?height=`
- `GET /state_root_at_height?height=`
- `GET /status`

## Health checks

1. All four report the same genesis hash and validator-set hash.
2. After a transaction to D, all four finalize the same heights.
3. Block IDs, state roots, and commit certificates match.

## Restart

Kill a validator during propose / prevote / precommit and start it
again with the same `SUNREY_DATA_DIR`. WAL + signer safety recover
the last height/round. The process must not double-sign.
