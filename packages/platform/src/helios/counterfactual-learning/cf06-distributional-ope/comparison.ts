import type { CounterfactualOutcomeDistribution, DistributionalPolicyEstimate, EstimatedPolicyOutcomeDifference } from './types.ts';
import { parseMinor, formatMinor } from './numeric.ts';

function diff(a: string, b: string): string {
  return formatMinor(parseMinor(a) - parseMinor(b));
}

/**
 * Contrast factual empirical distribution with an estimated alternative-policy distribution.
 */
export function compareFactualToEstimatedPolicyDistribution(input: {
  readonly factual: CounterfactualOutcomeDistribution;
  readonly alternativePolicyEstimate: DistributionalPolicyEstimate;
}): EstimatedPolicyOutcomeDifference {
  const { factual, alternativePolicyEstimate: alt } = input;
  const fd = factual;
  const aq = alt.quantiles;

  const meanDiff = diff(aq.mean.valueMinor, fd.meanMinor);
  const medianDiff = diff(aq.median.valueMinor, fd.medianMinor);

  return {
    schema: 'sunrey.helios.cf06.estimated-policy-outcome-difference.v1',
    factual: fd,
    alternativePolicyEstimate: alt,
    meanDifferenceMinor: meanDiff,
    medianDifferenceMinor: medianDiff,
    p05DifferenceMinor: diff(aq.p05.valueMinor, fd.p05Minor),
    p10DifferenceMinor: diff(aq.p10.valueMinor, fd.p10Minor),
    p25DifferenceMinor: diff(aq.p25.valueMinor, fd.p25Minor),
    p75DifferenceMinor: diff(aq.p75.valueMinor, fd.p75Minor),
    p90DifferenceMinor: diff(aq.p90.valueMinor, fd.p90Minor),
    p95DifferenceMinor: diff(aq.p95.valueMinor, fd.p95Minor),
    meanDifferenceStandardErrorMinor: aq.mean.standardErrorMinor,
  };
}
