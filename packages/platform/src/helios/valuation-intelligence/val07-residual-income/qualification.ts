import {
  HELIOS_VAL07_RESIDUAL_INCOME_BLOCKED,
  HELIOS_VAL07_RESIDUAL_INCOME_QUALIFIED,
} from './taxonomy.ts';

export { HELIOS_VAL07_RESIDUAL_INCOME_QUALIFIED, HELIOS_VAL07_RESIDUAL_INCOME_BLOCKED };

export function evaluateVal07ResidualIncomeQualification(input: {
  readonly economicProfitModeled: boolean;
  readonly distributionPresent: boolean;
  readonly simulationOnly: boolean;
}): {
  readonly marker:
    | typeof HELIOS_VAL07_RESIDUAL_INCOME_QUALIFIED
    | typeof HELIOS_VAL07_RESIDUAL_INCOME_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
} {
  const blockers: string[] = [];
  if (!input.economicProfitModeled) blockers.push('economic_profit');
  if (!input.distributionPresent) blockers.push('distribution');
  if (!input.simulationOnly) blockers.push('simulation_only');
  const qualified = blockers.length === 0;
  return Object.freeze({
    marker: qualified ? HELIOS_VAL07_RESIDUAL_INCOME_QUALIFIED : HELIOS_VAL07_RESIDUAL_INCOME_BLOCKED,
    qualified,
    blockers: Object.freeze(blockers),
  });
}
