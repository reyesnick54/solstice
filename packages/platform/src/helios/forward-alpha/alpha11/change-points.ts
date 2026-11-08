import type { UtcInstant } from '@solstice/domain';

import {
  runBayesianOnlineChangeDetector,
  runCusumDetector,
  runEwmaDetector,
  runPageHinkleyDetector,
} from './detectors/index.ts';
import { metricWorseIsLower } from './drift.ts';
import type { AlphaMonitoredMetric } from './taxonomy.ts';
import type { AlphaMetricObservation, ChangePointEvidence } from './types.ts';

function earliestTimestamp(
  observations: readonly AlphaMetricObservation[],
  metric: AlphaMonitoredMetric,
): UtcInstant | null {
  const rows = observations.filter((o) => o.metric === metric);
  if (rows.length === 0) return null;
  return rows.reduce((min, row) => (row.observedAt < min ? row.observedAt : min), rows[0]!.observedAt);
}

export function buildChangePointEvidence(input: {
  readonly strategyId: string;
  readonly metric: AlphaMonitoredMetric;
  readonly series: readonly number[];
  readonly observations: readonly AlphaMetricObservation[];
  readonly includeBayesian?: boolean;
}): ChangePointEvidence {
  const detectors = [
    runEwmaDetector({ metric: input.metric, series: input.series }),
    runCusumDetector({ metric: input.metric, series: input.series }),
    runPageHinkleyDetector({
      metric: input.metric,
      series: input.series,
      worseIsLower: metricWorseIsLower(input.metric),
    }),
    ...(input.includeBayesian !== false
      ? [runBayesianOnlineChangeDetector({ metric: input.metric, series: input.series })]
      : []),
  ];
  const alarmed = detectors.filter((d) => d.alarmed);
  const consensus = alarmed.filter(
    (d) => d.detector === 'EWMA' || d.detector === 'CUSUM' || d.detector === 'PAGE_HINKLEY',
  ).length;
  const changeDetected = consensus >= 2 || alarmed.length >= 3;
  const recent = input.series.slice(-3);
  const early = input.series.slice(0, 3);
  const recentMean = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : 0;
  const earlyMean = early.length ? early.reduce((a, b) => a + b, 0) / early.length : 0;
  let direction: ChangePointEvidence['direction'] = 'UNKNOWN';
  if (recentMean > earlyMean + 1) {
    direction = metricWorseIsLower(input.metric) ? 'POSITIVE_DRIFT' : 'NEGATIVE_DRIFT';
  } else if (recentMean < earlyMean - 1) {
    direction = metricWorseIsLower(input.metric) ? 'NEGATIVE_DRIFT' : 'POSITIVE_DRIFT';
  } else if (changeDetected) {
    direction = 'LEVEL_SHIFT';
  }
  return Object.freeze({
    evidenceId: `cp_${input.strategyId}_${input.metric}`,
    metric: input.metric,
    detectors: Object.freeze(detectors),
    changeDetected,
    consensusDetectorCount: consensus,
    earliestSuspectedAt: changeDetected ? earliestTimestamp(input.observations, input.metric) : null,
    direction,
  });
}
