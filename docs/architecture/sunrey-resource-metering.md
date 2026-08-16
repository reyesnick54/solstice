# SunRey resource metering

Deterministic resource accounting for the SunRey development protocol.
See also [`chunk-42-native-fees.md`](./chunk-42-native-fees.md).

## Cost table (development)

| Operation | Compute | State read | State write | Proof | Notes |
| Native transfer | 100 | 2 | 2 | 0 | plus bytes and signatures |
| Native issuance verification | 50 | 1 | 0 | 0 | does not mint |
| Native lock / unlock | 80 | 1 | 1 | 0 | reserved quantity, not a hold on fiat |
| Governance signature verification | 40 | 0 | 0 | 0 | plus one signature unit |
| Validator operation | 120 | 2 | 1 | 0 | registry / evidence path |
| Evidence verification | 90 | 1 | 1 | 1 | vault-hash check |
| Ordinary state read | 10 | 1 | 0 | 0 | |
| Ordinary state write | 20 | 0 | 1 | 0 | SYSTEM SET_OBJECT |
| Development faucet | 30 | 0 | 1 | 0 | exemption, no fee |

Transaction byte units equal the encoded size. Signature-verify units
equal the number of authenticated signatures plus any table entry.

## Fee calculation

```
actual_fee =
  base_transaction_fee
  + per_byte_fee * TRANSACTION_BYTE_UNITS
  + compute_unit_fee * COMPUTE_UNITS
  + state_read_fee * STATE_READ_UNITS
  + state_write_fee * STATE_WRITE_UNITS
  + signature_verify_fee * SIGNATURE_VERIFY_UNITS
  + cryptographic_proof_fee * CRYPTOGRAPHIC_PROOF_UNITS
```

All terms are unsigned integers. Overflow is a rejection, not a wrap.
`charged = min(actual_fee, max_fee)`. Unused reservation is released.

## Sample (development schedule v1)

A 240-byte native transfer with one signature:

```
100
+ 240 * 1
+ 100 * 2
+ 2 * 3
+ 2 * 5
+ 1 * 20
= 536
```

## Block limits (development)

- maximum bytes: 512000
- maximum execution units: 2000000
- maximum state writes: 8192
- maximum signature-verification work: 4096

The proposer must construct a valid block. Other validators recompute
the same usage from the cost table.

## Mempool selection

1. Effective fee priority descending:
   `(max_fee * 1_000_000) / max(max_execution_units, 1)`
2. Canonical `transaction_id` ascending
3. Then actor id / nonce

Local arrival time is not used, so independent validators that see the
same admitted set select the same prefix.

## DoS controls that remain in force

Fees are not the only bound. Transaction-size limits, per-peer rate
limits, per-actor mempool limits, block limits, signature-work bounds,
and future-message bounds still apply.
