# Shadow Lab Resilience Report

Chaos scenarios exercised in `chaos/resilience-harness.ts` (synthetic, in-memory).

| Scenario | Expected behavior | History rewrite |
|----------|-------------------|-----------------|
| Process restart | Rehydrate from checkpoint | No |
| Database restart | Checkpoint durable | No |
| Market-data disconnect | Pause ingest; recover | No |
| Market-data sequence gap | Sort and continue | No |
| Duplicate event | Dedupe by sequence key | No |
| Out-of-order event | Normalize ordering | No |
| Outcome queue backlog | Drain maturity queue | No |
| Lease collision | Single-writer model | No |
| Clock issue | knowableAt discipline | No |
| Strategy exception | Reject unfrozen strategy | No |
| Report generation failure | Retry path issues report id | No |
| Evidence persistence failure | Detect rewrite attempt; canonical chain intact | No |

Qualification requires `allRecovered=true` and `anyHistoryRewritten=false`.
