import {
  HELIOS_VAL11_ADAPTIVE_ENSEMBLE_BLOCKED,
  HELIOS_VAL11_ADAPTIVE_ENSEMBLE_QUALIFIED,
} from './taxonomy.ts';

export { HELIOS_VAL11_ADAPTIVE_ENSEMBLE_QUALIFIED, HELIOS_VAL11_ADAPTIVE_ENSEMBLE_BLOCKED };

export function evaluateVal11AdaptiveEnsembleQualification(input: {
  readonly adaptiveWeights: boolean;
  readonly applicabilityGating: boolean;
  readonly simulationOnly: boolean;
}) {
  const blockers: string[] = [];
  if (!input.adaptiveWeights) blockers.push('adaptive_weights');
  if (!input.applicabilityGating) blockers.push('applicability_gating');
  if (!input.simulationOnly) blockers.push('simulation_only');
  const qualified = blockers.length === 0;
  return Object.freeze({
    marker: qualified ? HELIOS_VAL11_ADAPTIVE_ENSEMBLE_QUALIFIED : HELIOS_VAL11_ADAPTIVE_ENSEMBLE_BLOCKED,
    qualified,
    blockers: Object.freeze(blockers),
  });
}
