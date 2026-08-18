# Chunk 76 — Reconcile the SunRey economic stack and stress it

This chunk has two jobs:

1. Reconcile the merged Chunk 71–75 interfaces on current `main`.
2. Implement a dedicated adversarial economic stress laboratory on the
   existing economics and range owners.

It is an engineering laboratory. It does **not** authorize production
mainnet, assign public tickers, or enable `LIVE_*` flags.

Canonical owners:

- `packages/sunrey-chain/src/economics/stack.ts` — reconciled stack
- `packages/sunrey-economics/src/stress` — stress laboratory
- `packages/sunrey-range/src/scenarios/economic-stress.ts` — range integration

## Reconciled flow

```
charged native fee
  → FeeDispositionPolicyV2
  → validator reward allocation
  → ValidatorEconomicsEngine entitlement accounting

fee burn component
  → AssetSupplyBook FEE_BURN
  → Explorer supply reporting
  → formal properties

MoonRey productive policy (Chunk 74/44)
  → eligibility and quantity
  → MonetaryIssuanceAuthority (Chunk 71)
  → constitutional MoonRey supply book
```

There is one validator reward pool on the integrated path. FeeEngine
internal accrual is skipped when the stack attaches economic sinks.

Treasury allocation uses the existing native protocol treasury
classification. It cannot create native supply. Chunk 77 is not built
here.

## Commands

```
npm run sunrey-economics -- stress run --scenario ECON-LIQ-001
npm run sunrey-economics -- stress campaign --id smoke
npm run sunrey-economics -- stress report --campaign critical-invariants
npm run demo:sunrey-economic-stress
```

Extended 120- and 600-epoch campaigns require `--extended` and are not
part of ordinary PR CI.

## Hard rules

- `ENVIRONMENT=simulation`, all `LIVE_*` flags stay false
- Tickers remain `NOT_ASSIGNED`
- Production mainnet remains inactive
- No person-level data
- No external market manipulation
- Engineering severity is not a legal or investment rating
