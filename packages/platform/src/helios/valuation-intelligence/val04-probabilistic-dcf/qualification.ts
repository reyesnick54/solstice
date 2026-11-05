import {
  HELIOS_VAL04_PROBABILISTIC_DCF_BLOCKED,
  HELIOS_VAL04_PROBABILISTIC_DCF_QUALIFIED,
  TERMINAL_VALUE_METHODS,
} from './taxonomy.ts';

export { HELIOS_VAL04_PROBABILISTIC_DCF_QUALIFIED, HELIOS_VAL04_PROBABILISTIC_DCF_BLOCKED };

export type Val04ProbabilisticDcfQualificationChecks = {
  readonly fcffAndFcfePaths: boolean;
  readonly explicitForecastSupport: boolean;
  readonly terminalGrowthMethod: boolean;
  readonly exitMultipleMethod: boolean;
  readonly fadeToMaturityMethod: boolean;
  readonly monteCarloCorrelatedAssumptions: boolean;
  readonly deterministicSeed: boolean;
  readonly percentileOutputs: boolean;
  readonly sensitivitySurfaces: boolean;
  readonly economicGrowthCap: boolean;
  readonly roicReinvestmentCoherence: boolean;
  readonly noExecutionAuthority: boolean;
  readonly researchOnly: boolean;
};

export type Val04ProbabilisticDcfQualificationResult = {
  readonly marker:
    | typeof HELIOS_VAL04_PROBABILISTIC_DCF_QUALIFIED
    | typeof HELIOS_VAL04_PROBABILISTIC_DCF_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
  readonly terminalMethodsSupported: readonly (typeof TERMINAL_VALUE_METHODS)[number][];
};

export function evaluateVal04ProbabilisticDcfQualification(
  checks: Val04ProbabilisticDcfQualificationChecks,
): Val04ProbabilisticDcfQualificationResult {
  const entries: [keyof Val04ProbabilisticDcfQualificationChecks, string][] = [
    ['fcffAndFcfePaths', 'fcff_fcfe'],
    ['explicitForecastSupport', 'explicit_forecasts'],
    ['terminalGrowthMethod', 'terminal_growth'],
    ['exitMultipleMethod', 'exit_multiple'],
    ['fadeToMaturityMethod', 'fade_to_maturity'],
    ['monteCarloCorrelatedAssumptions', 'monte_carlo_correlated'],
    ['deterministicSeed', 'deterministic_seed'],
    ['percentileOutputs', 'percentiles'],
    ['sensitivitySurfaces', 'sensitivity_surfaces'],
    ['economicGrowthCap', 'economic_growth_cap'],
    ['roicReinvestmentCoherence', 'roic_reinvestment'],
    ['noExecutionAuthority', 'no_execution_authority'],
    ['researchOnly', 'research_only'],
  ];
  const blockers = entries.filter(([key]) => !checks[key]).map(([, label]) => label);
  const qualified = blockers.length === 0;
  return Object.freeze({
    marker: qualified ? HELIOS_VAL04_PROBABILISTIC_DCF_QUALIFIED : HELIOS_VAL04_PROBABILISTIC_DCF_BLOCKED,
    qualified,
    blockers: Object.freeze(blockers),
    terminalMethodsSupported: TERMINAL_VALUE_METHODS,
  });
}
