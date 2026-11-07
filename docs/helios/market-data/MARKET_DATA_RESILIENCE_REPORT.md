# Market Data Resilience Report

## Redundancy (MD05)

Independent provider lineage is evaluated before corroboration upgrades quality. Shared upstream feeds are not treated as independent (`observation/lineage.ts`).

## Sequence and gap handling (MD03)

Sequence gaps surface explicit quality degradation; gap recovery may restore `GAP_RECOVERED` integrity when secondary evidence reconciles (`observation/quality.ts`).

## Chaos and operations (MD13)

AAF07 harness proofs include heartbeat outage, stale detection, rate limits, retry backoff, and silent-fallback rejection (`packages/external-data/src/certification/market-data/harness.ts`).

## MD14 adversarial scenarios

| Scenario | Intent |
|----------|--------|
| `md14_gap_recovery` | Recovered gaps may certify |
| `md14_clock_skew` | knowableAt before eventTime rejected |
| `md14_entitlement_block` | Entitlement block rejects AAF |
| `md14_redundant_source_divergence` | UNTRUSTED blocks certification |
| `md14_chaos_provider_outage` | Fixtures stay sandbox-qualified |
| `md14_aaf_block_on_untrusted` | DESYNCHRONIZED blocks AAF |
| `md14_execution_twin_no_live_submit` | No broker submit |
| `md14_live_shadow_no_execution_authority` | Shadow safe with trading off |

Runner: `runAllMd14AdversarialScenarios()` in `adversarial-qualification.ts`.
