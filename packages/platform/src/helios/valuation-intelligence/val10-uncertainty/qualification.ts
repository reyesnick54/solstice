import { HELIOS_VAL10_UNCERTAINTY_BLOCKED, HELIOS_VAL10_UNCERTAINTY_QUALIFIED } from './taxonomy.ts';

export { HELIOS_VAL10_UNCERTAINTY_QUALIFIED, HELIOS_VAL10_UNCERTAINTY_BLOCKED };

export function evaluateVal10UncertaintyQualification(input: {
  readonly dispersionMetricPresent: boolean;
  readonly fragilityMetricPresent: boolean;
  readonly simulationOnly: boolean;
}) {
  const blockers: string[] = [];
  if (!input.dispersionMetricPresent) blockers.push('dispersion');
  if (!input.fragilityMetricPresent) blockers.push('fragility');
  if (!input.simulationOnly) blockers.push('simulation_only');
  const qualified = blockers.length === 0;
  return Object.freeze({
    marker: qualified ? HELIOS_VAL10_UNCERTAINTY_QUALIFIED : HELIOS_VAL10_UNCERTAINTY_BLOCKED,
    qualified,
    blockers: Object.freeze(blockers),
  });
}
