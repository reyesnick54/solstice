export const HELIOS_MULTI_ASSET_M25_CONTINUOUS_RUNTIME_QUALIFIED =
  'HELIOS_MULTI_ASSET_M25_CONTINUOUS_RUNTIME_QUALIFIED' as const;
export const HELIOS_MULTI_ASSET_M25_CONTINUOUS_RUNTIME_BLOCKED =
  'HELIOS_MULTI_ASSET_M25_CONTINUOUS_RUNTIME_BLOCKED' as const;

export type M25QualificationChecks = {
  readonly normalContinuousCycle: boolean;
  readonly noOpportunityNoAction: boolean;
  readonly marketClosedWaiting: boolean;
  readonly cryptoWeekendContinuous: boolean;
  readonly providerOutageBlocked: boolean;
  readonly restartMidCycleRecovery: boolean;
  readonly duplicateScheduledWorkSkipped: boolean;
  readonly customerPauseHonored: boolean;
  readonly riskPauseHonored: boolean;
  readonly compliancePauseHonored: boolean;
  readonly staleDataWaiting: boolean;
  readonly reconciliationRequiredBlocked: boolean;
  readonly strategyDemotionBlocked: boolean;
  readonly expiredOpportunityNoAction: boolean;
  readonly gracefulShutdownExitOnly: boolean;
  readonly recoveryAfterRestart: boolean;
  readonly customerIsolation: boolean;
  readonly noBusyLoopPolling: boolean;
  readonly governedAutomationOnly: boolean;
  readonly observableMetrics: boolean;
  readonly simulationPosture: boolean;
};

export type M25QualificationResult = {
  readonly marker:
    | typeof HELIOS_MULTI_ASSET_M25_CONTINUOUS_RUNTIME_QUALIFIED
    | typeof HELIOS_MULTI_ASSET_M25_CONTINUOUS_RUNTIME_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateM25ContinuousRuntimeQualification(
  checks: M25QualificationChecks,
): M25QualificationResult {
  const blockers: string[] = [];
  for (const [key, passed] of Object.entries(checks) as [keyof M25QualificationChecks, boolean][]) {
    if (!passed) blockers.push(String(key));
  }
  if (blockers.length > 0) {
    return Object.freeze({
      marker: HELIOS_MULTI_ASSET_M25_CONTINUOUS_RUNTIME_BLOCKED,
      qualified: false,
      blockers: Object.freeze(blockers),
    });
  }
  return Object.freeze({
    marker: HELIOS_MULTI_ASSET_M25_CONTINUOUS_RUNTIME_QUALIFIED,
    qualified: true,
    blockers: Object.freeze([]),
  });
}
