# H04 Economic Work Order — Persistence Design

**Canonical owner:** `packages/platform` (Growth Orchestrator)  
**Base SHA:** `04b7c4f6ab3d2e28ac8054a42cf7dd7472eaf569`

## Decision

Economic Work Order is a **new first-class aggregate** in the Growth Orchestrator owner. It is **not** an extension of:

| Existing aggregate | Why not extended |
|--------------------|------------------|
| `GrowthPlan` / `growth.plan` | Planning-only; mandate-driven cycle output; no work-envelope semantics |
| `ActivatedGrowthPlan` | Post-activation monitoring; narrower lifecycle |
| `GrowExecutionCommand` / `GrowExecutionRecord` | Post-approval financial execution; binds proposals and authority |
| `ProductGrowthPlan` (`gmp_*`) | In-memory product illustration; no durable store |

The Work Order sits **between** authorized Grow objectives (mandate + plan references) and downstream HELIOS phases (research, specialist tasks, proposals, execution). It coordinates bounded economic work without moving money or issuing Execution Authority.

## Schema

New table `growth.economic_work_order_coordination` (V049; H05 owns `growth.economic_work_order` at V047):

- Stable `work_order_id` (`ewo_*` prefix)
- Customer/subject ownership columns for indexed isolation
- `state`, `revision`, `idempotency_key` (unique)
- `body_canonical` — full aggregate JSON (canonical source of truth)
- Transition history in `growth.economic_work_order_transition` for audit

Pattern matches `growth.execution_record` and `growth.financial_proposal`: canonical JSON body, no shadow balances.

## Capital envelope semantics

`capitalBoundary.maxCapitalEnvelope` uses `SerializedMoney` (integer minor units + currency). It is an **authorization ceiling reference**, not a balance, reservation, or ledger posting. H13 will bind sandbox allocation later.

## Idempotency

Creation keyed by `(customer_id, idempotency_key)`. Retries return the existing Work Order without duplicate rows.

## Customer isolation

All reads and mutations require `authorizeViewGrowthPlan` / `authorizeOperateGrowth` with matching `subjectId`. List queries filter by `customer_id`.
