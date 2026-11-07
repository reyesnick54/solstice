import { ENVIRONMENT, LIVE_INVESTMENT_EXECUTION, LIVE_TRADING_ENABLED } from '@solstice/config';

import {
  HELIOS_EXEC07_TCA_BLOCKED,
  HELIOS_EXEC07_TCA_QUALIFIED,
} from './taxonomy.ts';

export { HELIOS_EXEC07_TCA_QUALIFIED, HELIOS_EXEC07_TCA_BLOCKED };

export type Exec07TcaQualificationChecks = {
  readonly benchmarksCoverDecisionArrivalShortfall: boolean;
  readonly measuresExplicitFeesSpreadImpactTiming: boolean;
  readonly operationalRatesMeasured: boolean;
  readonly strategyAlphaSeparatedFromExecution: boolean;
  readonly incompleteBenchmarkSuppressesStrategyCredit: boolean;
  readonly validatedReportsFeedExec05Hints: boolean;
  readonly evol13ExecutionPolicyEvidenceSeparate: boolean;
  readonly deterministicAnalysisIds: boolean;
  readonly noExecutionAuthorityIssued: boolean;
  readonly productionDisabled: boolean;
};

export type Exec07TcaQualificationResult = {
  readonly marker: typeof HELIOS_EXEC07_TCA_QUALIFIED | typeof HELIOS_EXEC07_TCA_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateExec07TcaQualification(
  checks: Exec07TcaQualificationChecks,
): Exec07TcaQualificationResult {
  const entries: [keyof Exec07TcaQualificationChecks, string][] = [
    ['benchmarksCoverDecisionArrivalShortfall', 'benchmarks_cover_decision_arrival_shortfall'],
    ['measuresExplicitFeesSpreadImpactTiming', 'measures_fees_spread_impact_timing'],
    ['operationalRatesMeasured', 'operational_rates_measured'],
    ['strategyAlphaSeparatedFromExecution', 'strategy_alpha_separated'],
    ['incompleteBenchmarkSuppressesStrategyCredit', 'incomplete_benchmark_suppresses_strategy_credit'],
    ['validatedReportsFeedExec05Hints', 'validated_reports_feed_exec05'],
    ['evol13ExecutionPolicyEvidenceSeparate', 'evol13_execution_policy_separate'],
    ['deterministicAnalysisIds', 'deterministic_analysis_ids'],
    ['noExecutionAuthorityIssued', 'no_execution_authority'],
    ['productionDisabled', 'production_disabled'],
  ];
  const blockers = entries.filter(([key]) => !checks[key]).map(([, label]) => label);
  const productionOk =
    checks.productionDisabled &&
    !LIVE_INVESTMENT_EXECUTION &&
    !LIVE_TRADING_ENABLED &&
    ENVIRONMENT === 'simulation';
  if (!productionOk) {
    blockers.push('production_posture');
  }
  const qualified = blockers.length === 0;
  return Object.freeze({
    marker: qualified ? HELIOS_EXEC07_TCA_QUALIFIED : HELIOS_EXEC07_TCA_BLOCKED,
    qualified,
    blockers: Object.freeze(blockers),
  });
}
