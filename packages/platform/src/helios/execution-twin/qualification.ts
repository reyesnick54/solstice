/**
 * HELIOS OS02 — execution twin qualification marker.
 */

export const HELIOS_OS02_EXECUTION_TWIN_QUALIFIED = 'HELIOS_OS02_EXECUTION_TWIN_QUALIFIED' as const;
export const HELIOS_OS02_EXECUTION_TWIN_BLOCKED = 'HELIOS_OS02_EXECUTION_TWIN_BLOCKED' as const;

export type Os02ExecutionTwinQualificationChecks = {
  readonly replayDeterministic: boolean;
  readonly capsuleUnchangedAcrossEnvironments: boolean;
  readonly historicalBlocksLiveProviderApi: boolean;
  readonly riskRejectionParity: boolean;
  readonly assumptionsExplicitInManifest: boolean;
  readonly restartResumePreservesState: boolean;
  readonly liveFlagsInactive: boolean;
};

export type Os02ExecutionTwinQualificationResult = {
  readonly marker:
    | typeof HELIOS_OS02_EXECUTION_TWIN_QUALIFIED
    | typeof HELIOS_OS02_EXECUTION_TWIN_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateOs02ExecutionTwinQualification(
  checks: Os02ExecutionTwinQualificationChecks,
): Os02ExecutionTwinQualificationResult {
  const blockers: string[] = [];
  for (const [key, passed] of Object.entries(checks) as [keyof Os02ExecutionTwinQualificationChecks, boolean][]) {
    if (!passed) {
      blockers.push(key);
    }
  }
  if (blockers.length === 0) {
    return Object.freeze({
      marker: HELIOS_OS02_EXECUTION_TWIN_QUALIFIED,
      qualified: true,
      blockers: Object.freeze([]),
    });
  }
  return Object.freeze({
    marker: HELIOS_OS02_EXECUTION_TWIN_BLOCKED,
    qualified: false,
    blockers: Object.freeze(blockers),
  });
}
