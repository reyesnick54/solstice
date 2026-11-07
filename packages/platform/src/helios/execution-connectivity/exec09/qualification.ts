import { ENVIRONMENT, LIVE_INVESTMENT_EXECUTION, LIVE_TRADING_ENABLED } from '@solstice/config';

export const HELIOS_EXEC09_SETTLEMENT_LIFECYCLE_QUALIFIED = 'HELIOS_EXEC09_SETTLEMENT_LIFECYCLE_QUALIFIED' as const;
export const HELIOS_EXEC09_SETTLEMENT_LIFECYCLE_BLOCKED = 'HELIOS_EXEC09_SETTLEMENT_LIFECYCLE_BLOCKED' as const;

export type Exec09QualificationChecks = {
  readonly versionedPolicyByMarketAssetJurisdiction: boolean;
  readonly noUniversalTPlusOneHardCode: boolean;
  readonly marketCalendarApplied: boolean;
  readonly currencyCalendarApplied: boolean;
  readonly tradeContractualActualSettlementDates: boolean;
  readonly dvpLinkedLegsWithoutInventedAtomic: boolean;
  readonly providerAtomicDvpOnlyWhenDeclared: boolean;
  readonly partialFillsSupported: boolean;
  readonly multipleFillsSupported: boolean;
  readonly feesRepresented: boolean;
  readonly tradeCorrectionsSupported: boolean;
  readonly tradeBustsSupported: boolean;
  readonly settlementFailuresHandled: boolean;
  readonly lateSettlementRespected: boolean;
  readonly fillIsNotSettled: boolean;
  readonly simulationPosture: boolean;
};

export function evaluateExec09SettlementQualification(checks: Exec09QualificationChecks): {
  readonly marker:
    | typeof HELIOS_EXEC09_SETTLEMENT_LIFECYCLE_QUALIFIED
    | typeof HELIOS_EXEC09_SETTLEMENT_LIFECYCLE_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
} {
  const blockers = (Object.entries(checks) as [keyof Exec09QualificationChecks, boolean][])
    .filter(([, passed]) => !passed)
    .map(([key]) => key);
  if (blockers.length > 0) {
    return Object.freeze({
      marker: HELIOS_EXEC09_SETTLEMENT_LIFECYCLE_BLOCKED,
      qualified: false,
      blockers: Object.freeze(blockers),
    });
  }
  return Object.freeze({
    marker: HELIOS_EXEC09_SETTLEMENT_LIFECYCLE_QUALIFIED,
    qualified: true,
    blockers: Object.freeze([]),
  });
}

export function defaultExec09QualificationChecksFromPosture(): Pick<Exec09QualificationChecks, 'simulationPosture'> {
  return Object.freeze({
    simulationPosture:
      ENVIRONMENT === 'simulation' && LIVE_TRADING_ENABLED === false && LIVE_INVESTMENT_EXECUTION === false,
  });
}
