# Real-time events

See the canonical schema: [`api/sunrey-events-v1.md`](../../api/sunrey-events-v1.md).

```
GET /v1/events?subscribe=newFinalizedBlock,transactionStatus&cursor={opaque}
GET /v1/events?format=json&cursor={opaque}
```

Events are versioned (`event_version: v1`) and are projections.
Canonical state is the finalized chain. Resume with the opaque cursor
or finalized height encoded in that cursor.
