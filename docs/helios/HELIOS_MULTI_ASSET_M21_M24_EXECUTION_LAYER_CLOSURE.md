# HELIOS Multi-Asset Expansion — M21–M24 Execution Layer Closure Report

Date: 2026-09-21 (UTC)

## Scope

M24 completes the Multi-Asset Execution Layer by proving the full order → fill → settlement → reconciliation → available lifecycle across equities, crypto, futures, and FX. The implementation composes canonical H22–H24 infrastructure (provider orchestration, order lifecycle, capital lifecycle) without introducing a second accounting system, ledger, or Execution Authority mint.

Qualification marker: **`HELIOS_MULTI_ASSET_M24_EXECUTION_SETTLEMENT_RECONCILIATION_QUALIFIED`**

## M21 — Execution plan binding (implicit via M24)

Execution plans bind work-order proposals to a stable `executionPlanId` derived from work order, proposal, and idempotency key. One plan maps to at most one canonical order and one intended financial effect. M24 records preserve `executionPlanId`, provider route, venue, and provider payload hash.

Implementation: `packages/platform/src/helios/multi-asset/m24/ids.ts`, `types.ts`

## M22 — Multi-asset provider composition (implicit via M24)

M24 delegates provider submission, query, cancel, and webhook verification to H23 `HeliosProviderOrderPort` and `SandboxHeliosProviderPort`. Asset-class settlement semantics are applied at the M24 orchestration layer without duplicating provider transport.

Implementation: composes `packages/platform/src/helios/order-lifecycle/`

## M23 — Pre-trade to submit gate (implicit via M24)

M24 submit path invokes H23 validation ports (envelope, mandate, capital, risk, kernel) before provider submission. Capital reservation occurs on submit; release occurs on reject, cancel-without-fill, or availability.

Implementation: composes `HeliosOrderLifecycleService`

## M24 — Execution, settlement, reconciliation, exit, cash availability

### Lifecycle states

`AUTHORIZED` → `SUBMITTED` → `ACKNOWLEDGED` → `PARTIALLY_FILLED` → `FILLED` → `SETTLEMENT_PENDING` → `SETTLED` → `RECONCILED` → `AVAILABLE`

Also: `REJECTED`, `CANCEL_PENDING`, `CANCELLED`, `EXPIRED`, `UNKNOWN_PROVIDER_STATE`, `RECONCILIATION_REQUIRED`

### Safety invariants

- Network timeout after submission does **not** mark the order failed; state becomes `UNKNOWN_PROVIDER_STATE` and capital remains reserved until reconciliation.
- Duplicate submission, callback, and polling responses are idempotent.
- Submitted orders are not counted as fills; fills are not counted as settled cash until asset-class semantics permit.

### Asset-class settlement

| Asset class | Cycle | Cash effect on fill |
|---|---|---|
| EQUITY / ETF | T+1 | Unsettled |
| CRYPTO | T+0 | Settled immediately |
| FUTURES | T+1 | Unsettled |
| FX | T+2 | Unsettled |

Implementation: `packages/platform/src/helios/multi-asset/m24/settlement-semantics.ts`

### Canonical records

- **Order**: executionPlanId, provider, providerOrderId, instrument, side, orderType, quantity, submitted/limit price, timestamps, account, venue, provider payload ref, state, evidence
- **Fill**: fillId, providerFillId, orderId, quantity, price, fee, fee currency, liquidity role, slippage/price improvement, venue, evidence

### Exit plans

Authorized exit plans support: strategy exit, user close, risk close, emergency close, futures roll, provider liquidation. Exit plans map to H24 exit reason taxonomy without posting journals directly.

### Cash availability

Canonical breakdown: total account equity, unrealized P&L, realized P&L, unsettled cash, settled cash, reserved capital, available capital, withdrawable cash. Reconciliation mismatches block availability.

Implementation: `packages/platform/src/helios/multi-asset/m24/cash-availability.ts`

### Reconciliation

Provider/account reconciliation covers orders, fills, positions, cash, fees, and settlement state. Differences create sealed evidence and `MultiAssetReconciliationException` records.

Implementation: `packages/platform/src/helios/multi-asset/m24/reconciliation.ts`

## Qualification

| Artifact | Location |
|---|---|
| Orchestration service | `packages/platform/src/helios/multi-asset/m24/service.ts` |
| Qualification module | `packages/platform/src/helios/multi-asset/m24/qualification.ts` |
| Integration tests | `tests/helios-multi-asset-m24-execution-settlement-reconciliation.test.ts` |
| Qualify script | `scripts/helios-m24-execution-qualify.ts` |

Covered scenarios: full fill, partial fill, cancelled remainder, rejected order, timeout after submission, reconciliation recovery, duplicate callback, duplicate polling, restart mid-order, fill before acknowledgement, settlement delay, fees, exit (strategy/emergency/customer), cash availability, provider/account mismatch, reconciliation exception, multi-asset settlement semantics.

## Posture

- `ENVIRONMENT`: `simulation`
- `LIVE_TRADING_ENABLED`: `false`
- `LIVE_INVESTMENT_EXECUTION`: `false`
- Engineering-only; no live broker binding

## Remaining dependencies (not M25)

1. Grow BFF runtime binding for M24 execution reads (H26 deferred wiring)
2. Live provider adapter binding through H22 Provider Runtime
3. Production custody/ledger reconciliation feed for cash availability at scale
4. H27 kill-state fan-out to M24 exit authorization under portfolio risk events

M25 was not started.
