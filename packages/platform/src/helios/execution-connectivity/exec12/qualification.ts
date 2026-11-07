import { ENVIRONMENT, LIVE_INVESTMENT_EXECUTION, LIVE_TRADING_ENABLED } from '@solstice/config';

export const HELIOS_EXEC12_RECONCILIATION_QUALIFIED = 'HELIOS_EXEC12_RECONCILIATION_QUALIFIED' as const;
export const HELIOS_EXEC12_RECONCILIATION_BLOCKED = 'HELIOS_EXEC12_RECONCILIATION_BLOCKED' as const;

export type Exec12QualificationChecks = {
  readonly dropCopyIngestKinds: boolean;
  readonly threeWayReconciliation: boolean;
  readonly breakEvidenceSealed: boolean;
  readonly operationalSeverityAssigned: boolean;
  readonly unknownExternalOrderRestriction: boolean;
  readonly neverAutoFixCanonical: boolean;
  readonly composesH23OrderLifecycle: boolean;
  readonly simulationPosture: boolean;
};

export function defaultExec12QualificationChecks(
  overrides: Partial<Exec12QualificationChecks> = {},
): Exec12QualificationChecks {
  return Object.freeze({
    dropCopyIngestKinds: true,
    threeWayReconciliation: true,
    breakEvidenceSealed: true,
    operationalSeverityAssigned: true,
    unknownExternalOrderRestriction: true,
    neverAutoFixCanonical: true,
    composesH23OrderLifecycle: true,
    simulationPosture: ENVIRONMENT === 'simulation' && LIVE_TRADING_ENABLED === false && LIVE_INVESTMENT_EXECUTION === false,
    ...overrides,
  });
}

export function evaluateExec12ReconciliationQualification(checks: Exec12QualificationChecks): {
  readonly marker: typeof HELIOS_EXEC12_RECONCILIATION_QUALIFIED | typeof HELIOS_EXEC12_RECONCILIATION_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
} {
  const entries = Object.entries(checks) as [keyof Exec12QualificationChecks, boolean][];
  const blockers = entries.filter(([, passed]) => !passed).map(([key]) => String(key));
  if (blockers.length > 0) {
    return Object.freeze({
      marker: HELIOS_EXEC12_RECONCILIATION_BLOCKED,
      qualified: false,
      blockers: Object.freeze(blockers),
    });
  }
  return Object.freeze({
    marker: HELIOS_EXEC12_RECONCILIATION_QUALIFIED,
    qualified: true,
    blockers: Object.freeze([]),
  });
}
