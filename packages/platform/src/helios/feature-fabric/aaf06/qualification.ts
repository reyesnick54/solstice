export const HELIOS_AAF06_COVERAGE_BIAS_AND_REVISION_LEDGER_QUALIFIED =
  'HELIOS_AAF06_COVERAGE_BIAS_AND_REVISION_LEDGER_QUALIFIED' as const;

export const HELIOS_AAF06_COVERAGE_BIAS_AND_REVISION_LEDGER_BLOCKED =
  'HELIOS_AAF06_COVERAGE_BIAS_AND_REVISION_LEDGER_BLOCKED' as const;

export type Aaf06QualificationChecks = {
  readonly coverageBiasDeterministic: boolean;
  readonly survivorshipDiagnostic: boolean;
  readonly coverageSelectionDiagnostic: boolean;
  readonly revisionLedgerAppendOnly: boolean;
  readonly knowableAtBacktestSemantics: boolean;
  readonly providerCorrectionPreservesHistory: boolean;
  readonly restartPersistence: boolean;
  readonly severeRequiresControlledReview: boolean;
  readonly noCausalClaimsFromCorrelation: boolean;
};

export type Aaf06QualificationResult = {
  readonly marker:
    | typeof HELIOS_AAF06_COVERAGE_BIAS_AND_REVISION_LEDGER_QUALIFIED
    | typeof HELIOS_AAF06_COVERAGE_BIAS_AND_REVISION_LEDGER_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateAaf06Qualification(checks: Aaf06QualificationChecks): Aaf06QualificationResult {
  const blockers: string[] = [];
  for (const [key, passed] of Object.entries(checks) as [keyof Aaf06QualificationChecks, boolean][]) {
    if (!passed) {
      blockers.push(String(key));
    }
  }
  const qualified = blockers.length === 0;
  return Object.freeze({
    marker: qualified
      ? HELIOS_AAF06_COVERAGE_BIAS_AND_REVISION_LEDGER_QUALIFIED
      : HELIOS_AAF06_COVERAGE_BIAS_AND_REVISION_LEDGER_BLOCKED,
    qualified,
    blockers: Object.freeze(blockers),
  });
}
