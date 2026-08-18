# Archive query

Archive queries are a separate service from the validator critical
path.

Archive / query nodes retain historical chain data and have no signing
authority. Broad scans have a higher request cost and are bounded by
the public abuse policy.

If archive nodes are unavailable, the public edge returns
`ARCHIVE_UNAVAILABLE` without failing consensus or RPC reads of recent
finalized state.
