# SunRey capacity report

**Class:** `ENGINEERING_ESTIMATE` / `ENGINEERING_MEASUREMENT`

This report records development-host results from `sunrey-bench`.
Do not treat these ceilings as production guarantees.

## Host profile

Captured at run time in every JSON report (`context.hardware`,
`context.os`, `context.sourceCommit`). Re-run `npm run sunrey-bench -- sanity`
on the target host before quoting numbers.

## Disk growth estimates

Engineering bytes-per-object hints used for planning only:

| Object | Estimated bytes |
| --- | ---: |
| Block | 1024 |
| Transaction | 320 |
| Oracle fact | 256 |
| Productive contribution | 384 |

These are not storage contracts.

## Block / resource limits

The candidate study varies max block bytes, max execution units, and a
transaction-count cap. Protocol defaults remain the development
schedule in `developmentBlockLimits()`. A faster candidate is not a
reason to change defaults.

## Required seven-validator load

The `seven-validator` profile reports submitted, accepted, finalized,
rejected, finalized TPS, p50/p95/p99 finality, round changes, CPU,
memory, and state-root agreement. See the JSON artifact from that
profile for the host-specific numbers.

## Mixed economic load

The same profile mixes SunRey transfer, MoonRey transfer, oracle,
productive contribution, exchange settlement (when the adapter is
wired), and machine commerce, then reconciles replica state.

## Explorer catch-up

Pause the indexer, generate finalized history, resume, and measure
time to zero lag. Results are in the `explorer/catch_up` case.
