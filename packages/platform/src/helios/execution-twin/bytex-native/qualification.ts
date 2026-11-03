/**
 * NATIVE03 qualification — HELIOS native BYTEX deterministic runtime.
 */

export const HELIOS_NATIVE_BYTEX_RUNTIME_QUALIFIED = 'HELIOS_NATIVE_BYTEX_RUNTIME_QUALIFIED' as const;
export const HELIOS_NATIVE_BYTEX_RUNTIME_BLOCKED = 'HELIOS_NATIVE_BYTEX_RUNTIME_BLOCKED' as const;

export type NativeBytexRuntimeQualificationChecks = {
  readonly clockParityWithReferenceSpec: boolean;
  readonly marketDataOrderingParity: boolean;
  readonly deterministicReplayDigest: boolean;
  readonly orderLifecycleTransitions: boolean;
  readonly portfolioEventLifecycle: boolean;
  readonly timerSchedulingParity: boolean;
  readonly strategyRuntimeLifecycle: boolean;
  readonly environmentInterfaceParity: boolean;
  readonly restartCheckpointSafe: boolean;
  readonly noDotNetRuntimeDependency: boolean;
  readonly simulationPosturePreserved: boolean;
};

export type NativeBytexRuntimeQualificationResult = {
  readonly marker: typeof HELIOS_NATIVE_BYTEX_RUNTIME_QUALIFIED | typeof HELIOS_NATIVE_BYTEX_RUNTIME_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateNativeBytexRuntimeQualification(
  checks: NativeBytexRuntimeQualificationChecks,
): NativeBytexRuntimeQualificationResult {
  const blockers: string[] = [];
  for (const [key, passed] of Object.entries(checks) as [keyof NativeBytexRuntimeQualificationChecks, boolean][]) {
    if (!passed) {
      blockers.push(key);
    }
  }
  if (blockers.length === 0) {
    return Object.freeze({
      marker: HELIOS_NATIVE_BYTEX_RUNTIME_QUALIFIED,
      qualified: true,
      blockers: Object.freeze([]),
    });
  }
  return Object.freeze({
    marker: HELIOS_NATIVE_BYTEX_RUNTIME_BLOCKED,
    qualified: false,
    blockers: Object.freeze(blockers),
  });
}
