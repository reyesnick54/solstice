import { ALPHA_DECAY_SCHEMA, ALPHA_MONITORED_METRICS } from './taxonomy.ts';
import { attributeAlphaDecay } from './attribution.ts';
import { buildChangePointEvidence } from './change-points.ts';
import { baselineMap, buildPerformanceDrift, groupObservationsByMetric } from './drift.ts';
import { recommendAlphaDemotion } from './demotion-policy.ts';
import type { AlphaHealthState } from './taxonomy.ts';
import type { AlphaDecayMonitorInput, AlphaDecayState } from './types.ts';

const DEFAULT_MIN_OBS = 8;

function resolveHealth(input: {
  readonly insufficient: boolean;
  readonly worseDriftCount: number;
  readonly changePointCount: number;
  readonly brokenChangePoints: number;
}): AlphaHealthState {
  if (input.insufficient) return 'INSUFFICIENT_DATA';
  if (input.brokenChangePoints >= 2 || input.worseDriftCount >= 4) return 'BROKEN';
  if (input.worseDriftCount >= 2 || input.changePointCount >= 2) return 'DEGRADED';
  if (input.worseDriftCount >= 1 || input.changePointCount >= 1) return 'WATCH';
  return 'HEALTHY';
}

/**
 * Forward-alpha health monitor — multi-detector drift/break evaluation (research only).
 */
export class AlphaDecayMonitor {
  evaluate(input: AlphaDecayMonitorInput): AlphaDecayState {
    const minObs = input.minimumObservationsPerMetric ?? DEFAULT_MIN_OBS;
    const byMetric = groupObservationsByMetric(input.observations);
    const baselines = baselineMap(input.baselines);

    const keyObservations = [
      ...(byMetric.get('ACTIVE_RETURN_BPS') ?? []),
      ...(byMetric.get('HIT_RATE_BPS') ?? []),
    ];
    const insufficient = keyObservations.length < minObs;

    const drifts = ALPHA_MONITORED_METRICS.map((metric) => {
      const series = byMetric.get(metric) ?? [];
      return buildPerformanceDrift({
        metric,
        baseline: baselines.get(metric),
        series,
      });
    }).filter((row): row is NonNullable<typeof row> => row !== null);

    const changePoints = ALPHA_MONITORED_METRICS.map((metric) => {
      const series = byMetric.get(metric) ?? [];
      if (series.length < 3) {
        return null;
      }
      return buildChangePointEvidence({
        strategyId: input.strategyId,
        metric,
        series,
        observations: input.observations,
      });
    }).filter((row): row is NonNullable<typeof row> => row !== null);

    const worseDriftCount = drifts.filter((d) => d.materiallyWorse).length;
    const changePointCount = changePoints.filter((c) => c.changeDetected).length;
    const brokenChangePoints = changePoints.filter(
      (c) => c.changeDetected && c.consensusDetectorCount >= 2,
    ).length;

    const health = resolveHealth({
      insufficient,
      worseDriftCount,
      changePointCount,
      brokenChangePoints,
    });

    const attribution = attributeAlphaDecay({ drifts, changePoints });
    const demotion = recommendAlphaDemotion({ health, attribution, drifts });

    return Object.freeze({
      schema: ALPHA_DECAY_SCHEMA,
      strategyId: input.strategyId,
      evaluatedAt: input.evaluatedAt,
      health,
      attribution,
      drifts: Object.freeze(drifts),
      changePoints: Object.freeze(changePoints),
      demotion,
      grantsFinancialAuthority: false,
    });
  }
}
