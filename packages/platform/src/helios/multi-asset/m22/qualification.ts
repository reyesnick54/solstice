/**
 * HELIOS Multi-Asset M22 qualification gate.
 */

export const HELIOS_MULTI_ASSET_M22_ORDER_PLANNING_QUALIFIED =
  'HELIOS_MULTI_ASSET_M22_ORDER_PLANNING_QUALIFIED' as const;

export const HELIOS_MULTI_ASSET_M22_ORDER_PLANNING_BLOCKED =
  'HELIOS_MULTI_ASSET_M22_ORDER_PLANNING_BLOCKED' as const;

export type M22QualificationChecks = {
  readonly tightSpreadEquity: boolean;
  readonly wideSpreadEquity: boolean;
  readonly volatileBtc: boolean;
  readonly futures: boolean;
  readonly urgentExit: boolean;
  readonly passiveEntry: boolean;
  readonly partialFill: boolean;
  readonly cancelReplace: boolean;
  readonly staleMarket: boolean;
  readonly tacticExpiry: boolean;
  readonly twapSlicing: boolean;
  readonly insufficientVolumeData: boolean;
  readonly providerUnsupportedOrderType: boolean;
  readonly transactionCostAnalysis: boolean;
  readonly deterministicReplay: boolean;
  readonly restart: boolean;
  readonly executionResearchAdvisoryOnly: boolean;
  readonly noExecutionAuthority: boolean;
  readonly simulationPosture: boolean;
};

export type M22QualificationResult = {
  readonly marker:
    | typeof HELIOS_MULTI_ASSET_M22_ORDER_PLANNING_QUALIFIED
    | typeof HELIOS_MULTI_ASSET_M22_ORDER_PLANNING_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateM22OrderPlanningQualification(
  checks: M22QualificationChecks,
): M22QualificationResult {
  const blockers: string[] = [];
  for (const [key, passed] of Object.entries(checks) as [keyof M22QualificationChecks, boolean][]) {
    if (!passed) {
      blockers.push(String(key));
    }
  }
  if (blockers.length > 0) {
    return Object.freeze({
      marker: HELIOS_MULTI_ASSET_M22_ORDER_PLANNING_BLOCKED,
      qualified: false,
      blockers: Object.freeze(blockers),
    });
  }
  return Object.freeze({
    marker: HELIOS_MULTI_ASSET_M22_ORDER_PLANNING_QUALIFIED,
    qualified: true,
    blockers: Object.freeze([]),
  });
}
