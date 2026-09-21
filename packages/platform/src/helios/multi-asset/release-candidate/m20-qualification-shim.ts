/**
 * M28 forward-paper shim for M20 portfolio-risk qualification markers.
 * Mirrors packages/risk/src/portfolio/qualification.ts without importing risk.
 */

export const HELIOS_MULTI_ASSET_M20_PORTFOLIO_RISK_CONTROLS_QUALIFIED =
  'HELIOS_MULTI_ASSET_M20_PORTFOLIO_RISK_CONTROLS_QUALIFIED' as const;

export const HELIOS_MULTI_ASSET_M20_PORTFOLIO_RISK_CONTROLS_BLOCKED =
  'HELIOS_MULTI_ASSET_M20_PORTFOLIO_RISK_CONTROLS_BLOCKED' as const;

export const M28_M20_RISK_POLICY_VERSION = 'helios-m20-portfolio-risk-v1' as const;

export type M20QualificationChecks = {
  readonly normalOperation: boolean;
  readonly positionCap: boolean;
  readonly assetClassCap: boolean;
  readonly correlationClusterCap: boolean;
  readonly dailyLossThreshold: boolean;
  readonly portfolioDrawdown: boolean;
  readonly strategyDrawdown: boolean;
  readonly staleData: boolean;
  readonly providerOutage: boolean;
  readonly customerPause: boolean;
  readonly emergencyCloseRequest: boolean;
  readonly partialFillDuringRiskEvent: boolean;
  readonly restartExitOnlyPersisted: boolean;
  readonly reconciliationFailure: boolean;
  readonly policyVersionUpdate: boolean;
  readonly noFalseResetAcrossMidnight: boolean;
  readonly auditEvidenceComplete: boolean;
  readonly extendsCanonicalRiskEngine: boolean;
  readonly noSeparateRiskAuthority: boolean;
  readonly policyDrivenLimits: boolean;
  readonly simulationPosture: boolean;
};

export function evaluateM20PortfolioRiskQualification(checks: M20QualificationChecks): {
  readonly marker:
    | typeof HELIOS_MULTI_ASSET_M20_PORTFOLIO_RISK_CONTROLS_QUALIFIED
    | typeof HELIOS_MULTI_ASSET_M20_PORTFOLIO_RISK_CONTROLS_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
} {
  const blockers = (Object.entries(checks) as [keyof M20QualificationChecks, boolean][])
    .filter(([, passed]) => !passed)
    .map(([key]) => key);
  if (blockers.length > 0) {
    return Object.freeze({
      marker: HELIOS_MULTI_ASSET_M20_PORTFOLIO_RISK_CONTROLS_BLOCKED,
      qualified: false,
      blockers: Object.freeze(blockers),
    });
  }
  return Object.freeze({
    marker: HELIOS_MULTI_ASSET_M20_PORTFOLIO_RISK_CONTROLS_QUALIFIED,
    qualified: true,
    blockers: Object.freeze([]),
  });
}
