# Explorer rebuild runbook

The explorer is a projection. If the index is wrong, rebuild it.
Do not change finalized chain state.

## Commands

```
sunrey-explorer status
sunrey-explorer index
sunrey-explorer rebuild
sunrey-explorer rebuild --from-height 0
sunrey-explorer verify
sunrey-ops explorer status
sunrey-ops explorer lag
sunrey-ops explorer rebuild
sunrey-ops explorer verify
```

## Full rebuild

1. Confirm the chain finalized height (`sunrey-explorer status` or
   `sunrey-ops explorer status`).
2. Drop the derived index (`rebuild` does this).
3. Index from genesis or from the requested height.
4. Run `sunrey-explorer verify` or `sunrey-ops explorer verify`.
5. Compare `canonicalProjectionHash` with a prior export if one exists.

A rebuild from the same finalized chain must match. Canonical chain
data remains the source of truth.

## Partial rebuild

`rebuild --from-height N` reindexes from height N. Heights below N
are absent until a genesis rebuild. Verification against the full
chain will fail until those heights are restored.

## After schema change

If `indexer_schema_version` does not match the running binary, the
indexer refuses the checkpoint and requires a genesis rebuild.

## HA fleet

1. `sunrey-ops explorer status` — inspect HA state, healthy members,
   and divergence.
2. `sunrey-ops explorer lag` — confirm indexed vs finalized height.
3. `sunrey-ops explorer verify` — compare members against canonical
   chain. Divergence is not repaired by editing the index.
4. `sunrey-ops explorer rebuild` — rebuild the lagged or corrupt
   member from finalized chain data.
5. Fail public queries over to a healthy projection until rebuild
   completes. The missing Explorer never blocks the chain.

Never treat Explorer as authoritative. Never rewrite chain history
from a projection.
