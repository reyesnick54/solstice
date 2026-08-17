# Genesis allocation policy

Chunk 71 extends the canonical Chunk 65
`GenesisAssetAllocationManifest`.

Production-candidate behavior remains **zero allocation** unless a
separately approved non-zero allocation manifest exists.

## Forbidden migrations

- No testnet supply migration
- No rehearsal supply migration
- No faucet supply migration
- No automatic fiat Ledger migration

## No hidden premint

Every non-zero genesis unit must appear in the signed allocation
manifest.

```
sum(all allocations for asset) = declared genesis supply for asset
```

## Distribution categories

Categories are declared, versioned, authorized, and must appear in
the signed manifest. Production percentages remain `UNCONFIGURED`.

- `NETWORK_SECURITY`
- `ECOSYSTEM`
- `TREASURY`
- `USER_DISTRIBUTION`
- `PRODUCTIVE_ECONOMY`
- `RESERVE`
- `OTHER_GOVERNED_CATEGORY`

Existing Chunk 65 categories map onto this framework
(`VALIDATOR_OPERATIONS` → `NETWORK_SECURITY`,
`PROTOCOL_RESERVE` → `RESERVE`).
