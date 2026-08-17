# Explorer index model

The explorer index is a derived projection of finalized SunRey
Blockchain state. It is not canonical financial or chain authority.

## Checkpoint

Persist exactly:

- `last_indexed_finalized_height`
- `block_id`
- `state_root`
- `indexer_schema_version`

On restart the indexer verifies the checkpoint against the chain. A
mismatch requires rebuild. The chain is never rewritten.

## Indexed entities

| Entity | Key | Source |
| --- | --- | --- |
| Block | height / block ID | finalized headers + commit certificate |
| Transaction | transaction ID | finalized transactions |
| Account | SunRey address | finalized nonce, holdings, locks, public policy |
| Native asset | `SUNREY_COIN` / `MOONREY_COIN` | protocol asset records |
| MoonRey issuance | issuance ID | productive issuance receipts |
| Productive object / contribution | object / contribution ID | productive registry |
| Oracle provider / feed / fact | provider / feed / fact ID | oracle network |
| Validator | validator ID | validator-set history |
| Evidence | evidence ID | public equivocation evidence |
| Governance | proposal ID | UpgradePlan records |
| Interop client / packet | client / packet ID | interop gateway |
| Machine | machine ID | public machine-economy records |
| Exchange settlement | settlement ID | public chain settlement references |

## Rebuild

Supported operations:

1. Index from genesis
2. Rebuild from height
3. Verify a range against the chain
4. Drop and rebuild the derived index

A full rebuild from the same finalized chain must produce an equivalent
canonical projection (`canonicalProjectionHash`).

## Storage boundary

SQL lives in `db/explorer` schema `sunrey_explorer`. Tables are
separate from:

- canonical financial Ledger (`db/ledger`)
- blockchain state store
- custody authoritative workflows

Simulation tests use `InMemoryExplorerIndex`, which mirrors that
schema. Integer minor-unit quantities are stored as decimal strings.

## Query indexes

Common paths are keyed:

- block list by height and block ID
- address history by actor / address refs
- transaction lookup by ID
- MoonRey attribution by issuance and contribution
- oracle fact search by fact ID
