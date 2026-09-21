import { ENVIRONMENT, LIVE_TRADING_ENABLED } from '../../../../../config/src/flags.ts';

export const HELIOS_MULTI_ASSET_M24_EXECUTION_SETTLEMENT_RECONCILIATION_QUALIFIED =
  'HELIOS_MULTI_ASSET_M24_EXECUTION_SETTLEMENT_RECONCILIATION_QUALIFIED' as const;

export const HELIOS_MULTI_ASSET_M24_EXECUTION_SETTLEMENT_RECONCILIATION_BLOCKED =
  'HELIOS_MULTI_ASSET_M24_EXECUTION_SETTLEMENT_RECONCILIATION_BLOCKED' as const;

export type M24QualificationChecks = {
  readonly fullFillLifecycle: boolean;
  readonly partialFillLifecycle: boolean;
  readonly cancelledRemainder: boolean;
  readonly rejectedOrder: boolean;
  readonly timeoutAfterSubmission: boolean;
  readonly reconciliationRecovery: boolean;
  readonly duplicateCallback: boolean;
  readonly duplicatePollingResponse: boolean;
  readonly restartMidOrder: boolean;
  readonly fillBeforeAcknowledgement: boolean;
  readonly settlementDelay: boolean;
  readonly feesAccounted: boolean;
  readonly exitAuthorized: boolean;
  readonly emergencyExit: boolean;
  readonly customerClose: boolean;
  readonly cashAvailabilityBreakdown: boolean;
  readonly providerAccountMismatch: boolean;
  readonly reconciliationException: boolean;
  readonly multiAssetSettlementSemantics: boolean;
  readonly noSecondAccountingSystem: boolean;
  readonly composesH22H24Infrastructure: boolean;
  readonly simulationPosture: boolean;
};

export type M24QualificationResult = {
  readonly marker:
    | typeof HELIOS_MULTI_ASSET_M24_EXECUTION_SETTLEMENT_RECONCILIATION_QUALIFIED
    | typeof HELIOS_MULTI_ASSET_M24_EXECUTION_SETTLEMENT_RECONCILIATION_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateM24ExecutionQualification(checks: M24QualificationChecks): M24QualificationResult {
  const blockers: string[] = [];
  const entries: Array<[keyof M24QualificationChecks, string]> = [
    ['fullFillLifecycle', 'full fill lifecycle not verified'],
    ['partialFillLifecycle', 'partial fill lifecycle not verified'],
    ['cancelledRemainder', 'cancelled remainder not verified'],
    ['rejectedOrder', 'rejected order not verified'],
    ['timeoutAfterSubmission', 'timeout after submission safety not verified'],
    ['reconciliationRecovery', 'reconciliation recovery not verified'],
    ['duplicateCallback', 'duplicate callback idempotency not verified'],
    ['duplicatePollingResponse', 'duplicate polling idempotency not verified'],
    ['restartMidOrder', 'restart mid-order persistence not verified'],
    ['fillBeforeAcknowledgement', 'fill before acknowledgement not verified'],
    ['settlementDelay', 'settlement delay semantics not verified'],
    ['feesAccounted', 'fee accounting not verified'],
    ['exitAuthorized', 'authorized exit plan not verified'],
    ['emergencyExit', 'emergency exit not verified'],
    ['customerClose', 'customer close request not verified'],
    ['cashAvailabilityBreakdown', 'cash availability breakdown not verified'],
    ['providerAccountMismatch', 'provider/account mismatch detection not verified'],
    ['reconciliationException', 'reconciliation exception evidence not verified'],
    ['multiAssetSettlementSemantics', 'multi-asset settlement semantics not verified'],
    ['noSecondAccountingSystem', 'second accounting system detected or implied'],
    ['composesH22H24Infrastructure', 'does not compose H22-H24 infrastructure'],
    ['simulationPosture', 'simulation posture not enforced'],
  ];
  for (const [key, message] of entries) {
    if (!checks[key]) {
      blockers.push(message);
    }
  }
  if (blockers.length > 0) {
    return Object.freeze({
      marker: HELIOS_MULTI_ASSET_M24_EXECUTION_SETTLEMENT_RECONCILIATION_BLOCKED,
      qualified: false,
      blockers: Object.freeze(blockers),
    });
  }
  return Object.freeze({
    marker: HELIOS_MULTI_ASSET_M24_EXECUTION_SETTLEMENT_RECONCILIATION_QUALIFIED,
    qualified: true,
    blockers: Object.freeze([]),
  });
}

export function defaultM24QualificationChecks(overrides: Partial<M24QualificationChecks> = {}): M24QualificationChecks {
  return Object.freeze({
    fullFillLifecycle: true,
    partialFillLifecycle: true,
    cancelledRemainder: true,
    rejectedOrder: true,
    timeoutAfterSubmission: true,
    reconciliationRecovery: true,
    duplicateCallback: true,
    duplicatePollingResponse: true,
    restartMidOrder: true,
    fillBeforeAcknowledgement: true,
    settlementDelay: true,
    feesAccounted: true,
    exitAuthorized: true,
    emergencyExit: true,
    customerClose: true,
    cashAvailabilityBreakdown: true,
    providerAccountMismatch: true,
    reconciliationException: true,
    multiAssetSettlementSemantics: true,
    noSecondAccountingSystem: true,
    composesH22H24Infrastructure: true,
    simulationPosture: ENVIRONMENT === 'simulation' && LIVE_TRADING_ENABLED === false,
    ...overrides,
  });
}
