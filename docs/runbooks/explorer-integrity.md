# Explorer integrity runbook

`sunrey-explorer verify` compares the projection with canonical
finalized chain state.

## Checks

- indexed block IDs
- state roots
- transaction counts
- native-asset aggregates
- last finalized height

## Catch-up

If the indexer was down while the chain continued:

1. Restart `sunrey-explorer`.
2. The indexer reads the checkpoint and verifies it against the chain.
3. It indexes finalized history from `last_indexed_finalized_height + 1`.
4. The chain does not depend on explorer availability.

## Failure modes

| Symptom | Action |
| --- | --- |
| Checkpoint height missing on chain | Rebuild from genesis |
| Block ID or state root mismatch | Rebuild. Never edit the chain. |
| Schema version mismatch | Rebuild with the current indexer |
| Lag growing | Check indexer errors / metrics |

## Metrics

- `explorer_indexed_height`
- `explorer_chain_height`
- `explorer_lag_blocks`
- `explorer_blocks_indexed_total`
- `explorer_transactions_indexed_total`
- `explorer_errors`
- `explorer_rebuild_progress`
- `explorer_query_latency`
