# Development fee policy runbook

Simulation only. Not a production fee market. Not a public staking
product. Not a fiat yield.

## Inspect the active policy

```
sunrey-node fees policy --data-dir <dir>
sunrey-node fees schedule --data-dir <dir>
sunrey-node fees estimate --data-dir <dir> --bytes 240 --signatures 1
```

P2P operator binary:

```
sunrey-node fees policy
sunrey-node fees schedule
sunrey-node fees estimate
```

## Four-validator transfer with fees

1. Faucet development SunRey to Alice (`DEVELOPMENT_FAUCET` exemption).
2. Alice submits a transfer with `max_fee` and `max_execution_units`.
3. Mempool reserves `max_fee` from Alice's available native units.
4. The block finalizes. Resources are measured from the cost table.
5. `actual_fee` is charged. Unused reservation is released.
6. `sunrey-node fees receipt <tx>` returns the immutable receipt.
7. Disposition (network sink / burn / validator reward pool / treasury)
   reconciles to `actual_fee`.
8. `sunrey-node fees rewards <validator>` shows accrual, not a bank
   credit. Claim moves accrual into spendable native units.
9. All four validators compute the same receipt hash and state root.

## Rejection cases

```
# max_fee below the active minimum
sunrey-node fees estimate   # then submit a smaller max_fee — rejected

# declared execution budget too small
# execution terminates with OUT_OF_EXECUTION_UNITS
# application state is not partially applied
```

## Height-activated parameter change

Fee schedule, resource limits, approved fee assets, and disposition
change only through Chunk 40 governance:

```
sunrey-node governance propose \
  --data-dir <dir> \
  --id upg_fee_1 \
  --kind FEE_PARAMETER_CHANGE \
  --activation-height <future>
```

A newer binary does not change prices. MoonRey may be enabled later as
a fee asset through the same path. There is no automatic conversion.

## Disposition (development)

Basis points, must sum to 10000:

- NETWORK_SINK 5000
- BURN 2500
- VALIDATOR_REWARD_POOL 2500
- TREASURY 0

Proposer share of the reward pool: 4000 bps. Remaining units are split
by integer voting power. Leftover remainder goes to the proposer.

## Claims

`claim` moves accrued reward units into the validator's spendable
native-asset position. It does not post a customer journal and does
not send value to a bank account.
