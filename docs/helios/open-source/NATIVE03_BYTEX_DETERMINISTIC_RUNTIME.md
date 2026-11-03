# NATIVE03 — BYTEX deterministic engine nativeization

**Qualification marker:** `HELIOS_NATIVE_BYTEX_RUNTIME_QUALIFIED`  
**Canonical owner:** `packages/platform/src/helios/execution-twin/bytex-native/`  
**Upstream reference:** `docs/helios/open-source/upstream-lock.json` and `docs/helios/native-assimilation/quarantine-manifest.json` (BYTEX pin `67b3e103`, Apache-2.0, study-only)

## Scope

Native TypeScript port of BYTEX **deterministic trading-runtime** concepts:

- simulation/live clock abstraction (`BytexSimulationClock`, `BytexLiveClockFacade`)
- deterministic market-data ordering (timestamp + insertion index)
- timer scheduling (BYTEX `TestClock` parity vectors embedded)
- order and portfolio event lifecycles
- strategy runtime lifecycle and restart checkpoints
- reproducible replay digests (capsule + observations + assumptions + seed)

HELIOS authority remains canonical: no .NET runtime dependency, no BYTEX binary invocation in CI, no replacement of Risk Engine, Compliance Kernel, Execution Authority, Ledger, Settlement, or Exchange.

## Integration surfaces

| Consumer | Bridge (platform-owned) |
|----------|-------------------------|
| Strategy Lab | `packages/platform/src/helios/execution-twin/bytex-native/integration/strategy-lab-bridge.ts` |
| Investments read-model | `.../integration/investments-simulation.ts` |
| Risk facts | `.../integration/risk-hooks.ts` |

## Parity tests

- `packages/platform/src/helios/execution-twin/bytex-native/bytex-native.test.ts`
- `tests/helios-native03-bytex-runtime.test.ts`

Reference specification vectors are embedded from BYTEX `TestClockTests` (no .NET at test time).
