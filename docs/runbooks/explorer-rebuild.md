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
```

## Full rebuild

1. Confirm the chain finalized height (`sunrey-explorer status`).
2. Drop the derived index (`rebuild` does this).
3. Index from genesis or from the requested height.
4. Run `sunrey-explorer verify`.
5. Compare `canonicalProjectionHash` with a prior export if one exists.

A rebuild from the same finalized chain must match.

## Partial rebuild

`rebuild --from-height N` reindexes from height N. Heights below N
are absent until a genesis rebuild. Verification against the full
chain will fail until those heights are restored.

## After schema change

If `indexer_schema_version` does not match the running binary, the
indexer refuses the checkpoint and requires a genesis rebuild.
