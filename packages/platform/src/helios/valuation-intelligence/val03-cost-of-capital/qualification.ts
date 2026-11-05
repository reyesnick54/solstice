/**
 * VAL03 qualification — HELIOS_VAL03_COST_OF_CAPITAL_QUALIFIED
 */

import {
  HELIOS_VAL03_COST_OF_CAPITAL_BLOCKED,
  HELIOS_VAL03_COST_OF_CAPITAL_QUALIFIED,
} from './taxonomy.ts';

export { HELIOS_VAL03_COST_OF_CAPITAL_QUALIFIED, HELIOS_VAL03_COST_OF_CAPITAL_BLOCKED };

export type Val03CostOfCapitalQualificationChecks = {
  readonly dynamicRatesFromYieldCurve: boolean;
  readonly multiBetaEstimatorsPresent: boolean;
  readonly betaBlendNotRawOnly: boolean;
  readonly marketValueCapitalStructure: boolean;
  readonly uncertaintyRangesPresent: boolean;
  readonly currencyConsistencyEnforced: boolean;
  readonly termStructureYearSpecific: boolean;
  readonly noFlatWaccOnlyPath: boolean;
  readonly simulationOnly: boolean;
  readonly noExecutionAuthority: boolean;
};

export type Val03CostOfCapitalQualificationResult = {
  readonly marker:
    | typeof HELIOS_VAL03_COST_OF_CAPITAL_QUALIFIED
    | typeof HELIOS_VAL03_COST_OF_CAPITAL_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateVal03CostOfCapitalQualification(
  checks: Val03CostOfCapitalQualificationChecks,
): Val03CostOfCapitalQualificationResult {
  const entries: [keyof Val03CostOfCapitalQualificationChecks, string][] = [
    ['dynamicRatesFromYieldCurve', 'dynamic_rates_from_yield_curve'],
    ['multiBetaEstimatorsPresent', 'multi_beta_estimators'],
    ['betaBlendNotRawOnly', 'beta_blend_not_raw_only'],
    ['marketValueCapitalStructure', 'market_value_capital_structure'],
    ['uncertaintyRangesPresent', 'uncertainty_ranges'],
    ['currencyConsistencyEnforced', 'currency_consistency'],
    ['termStructureYearSpecific', 'term_structure_year_specific'],
    ['noFlatWaccOnlyPath', 'no_flat_wacc_only_path'],
    ['simulationOnly', 'simulation_only'],
    ['noExecutionAuthority', 'no_execution_authority'],
  ];
  const blockers = entries.filter(([key]) => !checks[key]).map(([, label]) => label);
  const qualified = blockers.length === 0;
  return Object.freeze({
    marker: qualified
      ? HELIOS_VAL03_COST_OF_CAPITAL_QUALIFIED
      : HELIOS_VAL03_COST_OF_CAPITAL_BLOCKED,
    qualified,
    blockers: Object.freeze(blockers),
  });
}
