import type { UtcInstant } from '../../../../../domain/src/time.ts';
import type { Aaf10ComputedFeature, M13MacroRegimeInputBundle } from './types.ts';

export function buildM13MacroRegimeInputs(input: {
  readonly evaluationTime: UtcInstant;
  readonly features: readonly Aaf10ComputedFeature[];
  readonly highImpactReleaseActive: boolean;
}): M13MacroRegimeInputBundle {
  const byId = new Map(input.features.map((row) => [row.featureId, row]));
  const inflation = byId.get('aaf10.inflation_trend');
  const unemployment = byId.get('aaf10.unemployment_trend');
  const slope = byId.get('aaf10.yield_curve_slope');
  const realRate = byId.get('aaf10.real_rate_proxy');
  const rateState = byId.get('aaf10.rate_change_state');

  const evidenceRefs = input.features.flatMap((row) => row.observationRefs);

  return Object.freeze({
    evaluationTime: input.evaluationTime,
    inflationTrendBps: inflation?.valueMinor ?? null,
    unemploymentTrendBps: unemployment?.valueMinor ?? null,
    yieldCurveSlopeBps: slope?.valueMinor ?? null,
    realRateProxyBps: realRate?.valueMinor ?? null,
    rateChangeState: rateState?.valueText ?? null,
    highImpactReleaseActive: input.highImpactReleaseActive,
    evidenceRefs: Object.freeze([...new Set(evidenceRefs)]),
    grantsExecutionAuthority: false,
  });
}
