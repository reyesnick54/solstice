export const HELIOS_AAF10_POINT_IN_TIME_MACRO_INTELLIGENCE_QUALIFIED =
  'HELIOS_AAF10_POINT_IN_TIME_MACRO_INTELLIGENCE_QUALIFIED' as const;

export const HELIOS_AAF10_POINT_IN_TIME_MACRO_INTELLIGENCE_BLOCKED =
  'HELIOS_AAF10_POINT_IN_TIME_MACRO_INTELLIGENCE_BLOCKED' as const;

export type Aaf10QualificationChecks = {
  readonly initialVsRevisionSafe: boolean;
  readonly delayedReleaseKnowable: boolean;
  readonly missingReleaseSurpriseUnavailable: boolean;
  readonly providerOutageDegrades: boolean;
  readonly conflictingSourceDetected: boolean;
  readonly staleSeriesDegraded: boolean;
  readonly timezoneNormalizationUtc: boolean;
  readonly scheduledThenPublishedEvent: boolean;
  readonly pointInTimeRegimeInput: boolean;
  readonly noExecutionAuthority: boolean;
};

export type Aaf10QualificationResult = {
  readonly marker:
    | typeof HELIOS_AAF10_POINT_IN_TIME_MACRO_INTELLIGENCE_QUALIFIED
    | typeof HELIOS_AAF10_POINT_IN_TIME_MACRO_INTELLIGENCE_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateAaf10Qualification(checks: Aaf10QualificationChecks): Aaf10QualificationResult {
  const blockers: string[] = [];
  if (!checks.initialVsRevisionSafe) blockers.push('initial_vs_revision');
  if (!checks.delayedReleaseKnowable) blockers.push('delayed_release');
  if (!checks.missingReleaseSurpriseUnavailable) blockers.push('missing_release');
  if (!checks.providerOutageDegrades) blockers.push('provider_outage');
  if (!checks.conflictingSourceDetected) blockers.push('conflicting_source');
  if (!checks.staleSeriesDegraded) blockers.push('stale_series');
  if (!checks.timezoneNormalizationUtc) blockers.push('timezone_normalization');
  if (!checks.scheduledThenPublishedEvent) blockers.push('scheduled_then_published');
  if (!checks.pointInTimeRegimeInput) blockers.push('pit_regime_input');
  if (!checks.noExecutionAuthority) blockers.push('no_execution_authority');

  const qualified = blockers.length === 0;
  return Object.freeze({
    marker: qualified
      ? HELIOS_AAF10_POINT_IN_TIME_MACRO_INTELLIGENCE_QUALIFIED
      : HELIOS_AAF10_POINT_IN_TIME_MACRO_INTELLIGENCE_BLOCKED,
    qualified,
    blockers: Object.freeze(blockers),
  });
}
