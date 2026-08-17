# Storage schema migrations

Every durable chain-state schema has an explicit version.

| Version | Engine | Meaning |
| --- | --- | --- |
| 0 | file-store | development / test dump |
| 1 | redb | production candidate |

On open the node classifies metadata as:

- **compatible** — current schema
- **migration-required** — older supported schema
- **unsupported future** — refuse to start
- **corrupt metadata** — refuse; never substitute defaults

The file-store → redb utility is restartable and idempotent. It records
source hash, destination verification, and an audit report. It compares
finalized height, block ID, state root, native supply, and validator
set before and after.

This is an engineering migration. It must not be used to copy testnet
state into production genesis.
