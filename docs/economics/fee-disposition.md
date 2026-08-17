# Fee disposition (FeePolicyV2)

Versioned `FeeDispositionPolicy` destinations:

- `VALIDATOR_REWARD` — existing validator reward pool / accrual
- `BURN` — existing monetary burn accounting
- `PROTOCOL_TREASURY` — native-chain treasury classification

Exact identity:

```
validator + burn + treasury = charged
```

Remainder after integer division is assigned to treasury so the sum is
exact. Disposition redistributes or burns existing quantity. It cannot
mint and cannot create negative supply.

Historic v1 disposition (network sink + burn + validator + treasury)
remains the historic policy. V2 does not reinterpret those receipts.
