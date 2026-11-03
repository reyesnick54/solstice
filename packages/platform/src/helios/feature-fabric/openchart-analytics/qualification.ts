/**
 * NATIVE07 — OpenChart market analytics nativeization qualification.
 */

export const HELIOS_NATIVE_OPENCHART_ANALYTICS_QUALIFIED =
  'HELIOS_NATIVE_OPENCHART_ANALYTICS_QUALIFIED' as const;

export const HELIOS_NATIVE_OPENCHART_ANALYTICS_BLOCKED =
  'HELIOS_NATIVE_OPENCHART_ANALYTICS_BLOCKED' as const;

export type OpenChartAnalyticsQualificationChecks = {
  readonly timeseriesParity: boolean;
  readonly smaParity: boolean;
  readonly streamingFeatureState: boolean;
  readonly marketLogicTreeValidated: boolean;
  readonly alertableCondition: boolean;
  readonly feedSnapshotUpdate: boolean;
  readonly studyCatalogPresent: boolean;
  readonly noEvalOrDynamicCode: boolean;
};

export type OpenChartAnalyticsQualificationResult = {
  readonly marker:
    | typeof HELIOS_NATIVE_OPENCHART_ANALYTICS_QUALIFIED
    | typeof HELIOS_NATIVE_OPENCHART_ANALYTICS_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

const CHECK_LABELS: Record<keyof OpenChartAnalyticsQualificationChecks, string> = {
  timeseriesParity: 'timeseries_parity',
  smaParity: 'sma_parity',
  streamingFeatureState: 'streaming_feature_state',
  marketLogicTreeValidated: 'market_logic_tree',
  alertableCondition: 'alertable_condition',
  feedSnapshotUpdate: 'feed_snapshot_update',
  studyCatalogPresent: 'study_catalog',
  noEvalOrDynamicCode: 'no_eval_dynamic_code',
};

export function evaluateOpenChartAnalyticsQualification(
  checks: OpenChartAnalyticsQualificationChecks,
): OpenChartAnalyticsQualificationResult {
  const blockers: string[] = [];
  for (const [key, pass] of Object.entries(checks) as [keyof OpenChartAnalyticsQualificationChecks, boolean][]) {
    if (!pass) blockers.push(CHECK_LABELS[key]);
  }
  const qualified = blockers.length === 0;
  return Object.freeze({
    marker: qualified
      ? HELIOS_NATIVE_OPENCHART_ANALYTICS_QUALIFIED
      : HELIOS_NATIVE_OPENCHART_ANALYTICS_BLOCKED,
    qualified,
    blockers: Object.freeze(blockers),
  });
}
