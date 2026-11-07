# HELIOS Execution Connectivity — Current State (EXEC01)

**Qualification marker:** `HELIOS_EXEC01_CONNECTIVITY_DOMAIN_QUALIFIED`  
**Schema:** `sunrey.helios.execution.connectivity.exec01.v1`  
**Authority:** `BROKER_EXECUTION_CONNECTIVITY`  
**Live flag:** `LIVE_INVESTMENT_EXECUTION=false`

## Implemented (this work package)

| Component | Location | Status |
|-----------|----------|--------|
| Canonical broker connectivity types | `packages/investments/src/broker-connectivity/` | Implemented |
| Paper broker EXEC01 bridge | `packages/investments/src/broker-connectivity/paper-bridge.ts` | Implemented |
| Owner audit map | `packages/platform/src/helios/execution-connectivity/exec01/owner-audit.ts` | Implemented |
| H23 ↔ EXEC01 bridge | `packages/platform/src/helios/order-lifecycle/exec01-bridge.ts` | Implemented |
| Qualification evaluator | `packages/platform/src/helios/execution-connectivity/exec01/qualification.ts` | Implemented |
| H23 schema anchor | `packages/platform/src/helios/order-lifecycle/exec01-schema.ts` | Implemented |
| Exchange overlay | `packages/sunrey-exchange/src/regulated/exec01-broker-access.ts` | Implemented |
| Custody settlement scope | `packages/custody/src/regulated/exec01-broker-settlement.ts` | Implemented |
| Risk reservation facts | `packages/risk/src/investments/exec01-capital-reservation.ts` | Implemented |
| Kernel connectivity posture | `packages/kernel/src/regulated/exec01-investment-execution.ts` | Implemented |
| Architecture docs | `docs/helios/execution/` | Implemented |
| Qualification tests | `tests/helios-exec01-connectivity-domain.test.ts` | Implemented |

## Pre-existing owners (audited, unchanged behavior)

| Component | Location | Notes |
|-----------|----------|-------|
| Paper broker | `packages/investments/src/broker-port.ts` | Only `BrokerExecutionProvider` implementation |
| H23 lifecycle | `packages/platform/src/helios/order-lifecycle/` | `SandboxHeliosProviderPort` default |
| H09 routes | `packages/platform/src/helios/executable-opportunity/` | Paper route registry |
| H22 orchestration | `packages/platform/src/helios/provider-orchestration/` | Simulated adapters |
| Regulated access | `packages/sunrey-exchange/src/regulated/market-access.ts` | Not wired into H23 validation by default |
| Custody candidates | `packages/custody/src/provider-candidate/` | Fixture adapters only |

## Audit summary

Detailed audit records: `EXEC01_OWNER_AUDIT_RECORDS` in `packages/platform/src/helios/execution-connectivity/exec01/owner-audit.ts`.

| Area | Finding |
|------|---------|
| `BrokerExecutionProvider` | Single paper implementation; kernel-gated ledger path |
| H23 order lifecycle | Provider port + capital port injection; no journal posts |
| Risk | Pre-trade port + portfolio kills; EXEC01 reservation facts added |
| Kernel | Investment intents in policy seed; feature gate `INVESTMENT_AGENT_EXECUTION` |
| Regulated market access | Filter layer; EXEC01 overlay keeps `orderEntryPermitted: false` |
| Custody | Settlement reconciliation in workflows; EXEC01 scope type added |
| Settlement / reconciliation | Parallel paths in investments, H23, M24, custody |
| Kill switches | Multiple planes; unified broker fan-out **not** complete |
| Capital reservation | Four reservation models; not unified |

## Gaps (explicit, not in EXEC01 scope)

- Production broker adapter implementing `BrokerProvider` with live transport  
- Single capital reservation owner across accounts, H23, and investments product  
- Kill-switch fan-out blocking broker submit across risk, exchange, and grow  
- Bridge `InvestmentsService` ↔ `HeliosOrderLifecycleService` for one customer journey  
- Provider Runtime binding for licensed brokers (H22 closure items)

## Verify locally

```bash
node --experimental-strip-types --disable-warning=ExperimentalWarning --test tests/helios-exec01-connectivity-domain.test.ts
```

## Related documentation

- `docs/helios/HELIOS_MULTI_ASSET_M21_M24_EXECUTION_LAYER_CLOSURE.md` — H22/H23/M24 open items  
- `docs/helios/H01_RUNTIME_TRUTH_MAP.md` — ledger paper execution path  
- `docs/productization/PHASE_E_03_INVESTMENT_PORTFOLIO.md` — product execution adapter
