/**
 * NATIVE06 feature-fabric indicator port qualification.
 */

export const HELIOS_NATIVE06_BYTEX_INDICATORS_QUALIFIED = 'HELIOS_NATIVE06_BYTEX_INDICATORS_QUALIFIED' as const;
export const HELIOS_NATIVE06_BYTEX_INDICATORS_BLOCKED = 'HELIOS_NATIVE06_BYTEX_INDICATORS_BLOCKED' as const;

export type Native06IndicatorQualificationChecks = {
  readonly smaEmaWmaPresent: boolean;
  readonly rsiAtrVolatilityPresent: boolean;
  readonly momentumVolumePriceLevelPresent: boolean;
  readonly goldenVectorsPass: boolean;
  readonly noNetworkOrEval: boolean;
};

export type Native06IndicatorQualificationResult = {
  readonly marker:
    | typeof HELIOS_NATIVE06_BYTEX_INDICATORS_QUALIFIED
    | typeof HELIOS_NATIVE06_BYTEX_INDICATORS_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateNative06BytexIndicatorQualification(
  checks: Native06IndicatorQualificationChecks,
): Native06IndicatorQualificationResult {
  const blockers: string[] = [];
  for (const [key, pass] of Object.entries(checks) as [keyof Native06IndicatorQualificationChecks, boolean][]) {
    if (!pass) {
      blockers.push(String(key));
    }
  }
  if (blockers.length > 0) {
    return Object.freeze({
      marker: HELIOS_NATIVE06_BYTEX_INDICATORS_BLOCKED,
      qualified: false,
      blockers: Object.freeze(blockers),
    });
  }
  return Object.freeze({
    marker: HELIOS_NATIVE06_BYTEX_INDICATORS_QUALIFIED,
    qualified: true,
    blockers: Object.freeze([]),
  });
}
