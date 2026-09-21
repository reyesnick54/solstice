export const HELIOS_MULTI_ASSET_M13_REGIME_ENGINE_QUALIFIED =
  'HELIOS_MULTI_ASSET_M13_REGIME_ENGINE_QUALIFIED' as const;
export const HELIOS_MULTI_ASSET_M13_REGIME_ENGINE_BLOCKED =
  'HELIOS_MULTI_ASSET_M13_REGIME_ENGINE_BLOCKED' as const;

export type M13QualificationChecks = {
  readonly deterministicRegimeClassification: boolean;
  readonly marketStateOnlyInput: boolean;
  readonly strategyCompatibilityMatrix: boolean;
  readonly noLlmRegimeAssignment: boolean;
  readonly versionTracked: boolean;
};

export type M13QualificationResult = {
  readonly marker:
    | typeof HELIOS_MULTI_ASSET_M13_REGIME_ENGINE_QUALIFIED
    | typeof HELIOS_MULTI_ASSET_M13_REGIME_ENGINE_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateM13Qualification(checks: M13QualificationChecks): M13QualificationResult {
  const blockers: string[] = [];
  for (const [key, passed] of Object.entries(checks) as [keyof M13QualificationChecks, boolean][]) {
    if (!passed) blockers.push(String(key));
  }
  if (blockers.length > 0) {
    return Object.freeze({
      marker: HELIOS_MULTI_ASSET_M13_REGIME_ENGINE_BLOCKED,
      qualified: false,
      blockers: Object.freeze(blockers),
    });
  }
  return Object.freeze({
    marker: HELIOS_MULTI_ASSET_M13_REGIME_ENGINE_QUALIFIED,
    qualified: true,
    blockers: Object.freeze([]),
  });
}
