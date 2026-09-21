/**
 * HELIOS Multi-Asset M21 — universal multi-asset execution plan qualification gate.
 */

export const HELIOS_MULTI_ASSET_M21_EXECUTION_PLAN_QUALIFIED =
  'HELIOS_MULTI_ASSET_M21_EXECUTION_PLAN_QUALIFIED' as const;

export const HELIOS_MULTI_ASSET_M21_EXECUTION_PLAN_BLOCKED =
  'HELIOS_MULTI_ASSET_M21_EXECUTION_PLAN_BLOCKED' as const;

export type M21QualificationChecks = {
  readonly singleEquityTradePlan: boolean;
  readonly cryptoTradePlan: boolean;
  readonly futuresTradePlan: boolean;
  readonly longDirectionSupported: boolean;
  readonly shortDirectionPermitted: boolean;
  readonly multiLegStatArbPlan: boolean;
  readonly expiredEnvelopeRejected: boolean;
  readonly missingRiskApprovalRejected: boolean;
  readonly missingComplianceApprovalRejected: boolean;
  readonly insufficientCapitalRejected: boolean;
  readonly pausedMandateRejected: boolean;
  readonly expiredFuturesContractRejected: boolean;
  readonly staleMarketRejected: boolean;
  readonly restartPersistence: boolean;
  readonly idempotentStateTransitions: boolean;
  readonly customerIsolation: boolean;
  readonly capitalLifecyclePreserved: boolean;
  readonly noSecondExecutionAuthority: boolean;
  readonly noSecondOrderManager: boolean;
  readonly noSecondRiskEngine: boolean;
  readonly aiCannotAuthorize: boolean;
  readonly simulationPosture: boolean;
};

export type M21QualificationResult = {
  readonly marker:
    | typeof HELIOS_MULTI_ASSET_M21_EXECUTION_PLAN_QUALIFIED
    | typeof HELIOS_MULTI_ASSET_M21_EXECUTION_PLAN_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
  readonly status: 'ENGINEERING_EVALUATION_COMPLETE' | 'ENGINEERING_EVALUATION_BLOCKED';
};

export function evaluateM21Qualification(checks: M21QualificationChecks): M21QualificationResult {
  const blockers: string[] = [];
  const entries = Object.entries(checks) as [keyof M21QualificationChecks, boolean][];
  for (const [key, passed] of entries) {
    if (!passed) {
      blockers.push(String(key));
    }
  }
  if (blockers.length > 0) {
    return Object.freeze({
      marker: HELIOS_MULTI_ASSET_M21_EXECUTION_PLAN_BLOCKED,
      qualified: false,
      blockers: Object.freeze(blockers),
      status: 'ENGINEERING_EVALUATION_BLOCKED',
    });
  }
  return Object.freeze({
    marker: HELIOS_MULTI_ASSET_M21_EXECUTION_PLAN_QUALIFIED,
    qualified: true,
    blockers: Object.freeze([]),
    status: 'ENGINEERING_EVALUATION_COMPLETE',
  });
}
