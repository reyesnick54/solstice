# Genesis asset allocation

`GenesisAssetAllocationManifest` is explicit. If no externally approved
production allocation exists, the candidate is empty/zero and records
that production allocation has not been authorized.

## Rules

- No hidden premint
- No inherited testnet faucet supply
- No automatic migration of application Ledger SunRey Coin balances
- No wrapped fiat
- Unapproved non-zero lines are rejected
- Any future migration requires its own approved manifest

SunRey Coin and MoonRey Coin production genesis supply must be written
in the manifest. Zero is the honest current value.
