/**
 * AAFV2.3 qualification gate for the point-in-time dataset compiler.
 */

export const HELIOS_AAFV2_03_POINT_IN_TIME_COMPILER_QUALIFIED =
  'HELIOS_AAFV2_03_POINT_IN_TIME_COMPILER_QUALIFIED' as const;
export const HELIOS_AAFV2_03_POINT_IN_TIME_COMPILER_BLOCKED =
  'HELIOS_AAFV2_03_POINT_IN_TIME_COMPILER_BLOCKED' as const;

export type Aafv203QualificationChecks = {
  readonly earningsAfterDecisionRejected: boolean;
  readonly macroRevisionAfterDecisionRejected: boolean;
  readonly futureIndexMembershipRejected: boolean;
  readonly mergerAfterDecisionRejected: boolean;
  readonly tickerMappingAfterDecisionRejected: boolean;
  readonly providerArrivalAfterDecisionRejected: boolean;
  readonly alternativeDataAfterDecisionRejected: boolean;
  readonly finalMacroRevisionRejected: boolean;
  readonly manifestReproducible: boolean;
  readonly strategyLabSeamAcceptsManifest: boolean;
};

export type Aafv203QualificationResult = {
  readonly marker:
    | typeof HELIOS_AAFV2_03_POINT_IN_TIME_COMPILER_QUALIFIED
    | typeof HELIOS_AAFV2_03_POINT_IN_TIME_COMPILER_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateAafv203Qualification(
  checks: Aafv203QualificationChecks,
): Aafv203QualificationResult {
  const blockers: string[] = [];
  if (!checks.earningsAfterDecisionRejected) {
    blockers.push('earnings filed after decision not rejected');
  }
  if (!checks.macroRevisionAfterDecisionRejected) {
    blockers.push('macro revision after decision not rejected');
  }
  if (!checks.futureIndexMembershipRejected) {
    blockers.push('future index membership not rejected');
  }
  if (!checks.mergerAfterDecisionRejected) {
    blockers.push('merger announced after decision not rejected');
  }
  if (!checks.tickerMappingAfterDecisionRejected) {
    blockers.push('future ticker mapping not rejected');
  }
  if (!checks.providerArrivalAfterDecisionRejected) {
    blockers.push('late provider payload not rejected');
  }
  if (!checks.alternativeDataAfterDecisionRejected) {
    blockers.push('future alternative-data observation not rejected');
  }
  if (!checks.finalMacroRevisionRejected) {
    blockers.push('final revised macro value leak not rejected');
  }
  if (!checks.manifestReproducible) {
    blockers.push('manifest reproduction failed');
  }
  if (!checks.strategyLabSeamAcceptsManifest) {
    blockers.push('Strategy Lab manifest seam not wired');
  }

  if (blockers.length > 0) {
    return Object.freeze({
      marker: HELIOS_AAFV2_03_POINT_IN_TIME_COMPILER_BLOCKED,
      qualified: false,
      blockers: Object.freeze(blockers),
    });
  }
  return Object.freeze({
    marker: HELIOS_AAFV2_03_POINT_IN_TIME_COMPILER_QUALIFIED,
    qualified: true,
    blockers: Object.freeze([]),
  });
}
