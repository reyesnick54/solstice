# HELIOS market-data incident (MD13)

Simulation and production-candidate operations only. Do **not** enable `LIVE_*`
flags or bind unlicensed live feeds without provider certification (AAF07/H07).

## Symptoms

- `MARKET_DATA_UNTRUSTED` circuit on a feed or instrument group
- Growing sequence gaps or checksum failures on ingress
- Heartbeat / WebSocket staleness beyond feed-specific SLO
- Durable queue spill rate elevated (`SPILL_DURABLE_QUEUE`) with consumer lag
- Dual-feed desynchronization duration exceeding feed-scoped SLO
- Provider HTTP `429` / `500` or DNS resolution failures on a venue adapter
- Research or paper workflows failing closed with `MARKET_DATA_UNTRUSTED`

## Immediate actions

1. Confirm circuit state per feed (`feed_a`, `feed_b`, or venue-specific ids).
   If state is `MARKET_DATA_UNTRUSTED`, **stop** research and paper execution that
   depends on that authoritative market state until recovery is proven.
2. Identify failing transport (WebSocket vs REST) and provider error class.
3. Inspect backpressure metrics: buffer depth, durable queue depth, shed derived
   work count. Raw events must not be silently dropped — overflow must spill to
   the durable queue or mark the feed `DEGRADED`.
4. For sequence gaps, record gap start sequence and trigger gap recovery; do not
   fabricate prices to fill gaps.
5. For stale snapshots, reload from last sealed snapshot plus validated
   incrementals; reject checksum mismatches.
6. For single-feed survival, keep degraded secondary analytics shed; do not
   promote a lone feed to authoritative without policy review.
7. After recovery, measure gap recovery time, snapshot recovery time, and
   desynchronization duration against **feed-specific** SLO tables (not universal
   latency targets).
8. Run MD13 chaos qualification harness in simulation before resuming dependent
   workflows:
   `node --experimental-strip-types --disable-warning=ExperimentalWarning --test tests/helios-md13-live-data-resilience.test.ts`

## SLO dimensions (feed-scoped)

Each feed/provider carries its own targets for:

- availability
- freshness
- p50 / p95 / p99 latency
- gap recovery time
- snapshot recovery time
- desynchronization duration

Do not publish one global latency number across feeds.

## Backpressure policy order

1. `BUFFER`
2. `SPILL_DURABLE_QUEUE` (raw preservation priority)
3. `SHED_NONCRITICAL_DERIVED`
4. `MARK_FEED_DEGRADED`

Optional analytics must yield before raw ingress is discarded.

## Authority

Human operators only for resuming authoritative state. AI recommendations are
not authorization. Unlicensed production market-data activation remains
unavailable (`LIVE_DATA_MARKET_ENABLED=false`).

## Qualification marker

Operational readiness for continuous fabric chaos rehearsal:
`HELIOS_MD13_LIVE_DATA_RESILIENCE_QUALIFIED`
