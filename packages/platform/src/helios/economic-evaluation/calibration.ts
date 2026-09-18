import type { CalibrationBin } from './types.ts';

export function buildCalibrationBins(
  predictions: readonly { readonly confidenceBps: number; readonly succeeded: boolean }[],
): readonly CalibrationBin[] {
  const bins = new Map<number, { predicted: number; observed: number }>();
  for (const row of predictions) {
    const bucket = Math.round(row.confidenceBps / 1000) * 1000;
    const current = bins.get(bucket) ?? { predicted: 0, observed: 0 };
    bins.set(bucket, {
      predicted: current.predicted + 1,
      observed: current.observed + (row.succeeded ? 1 : 0),
    });
  }
  return Object.freeze(
    [...bins.entries()]
      .sort(([a], [b]) => a - b)
      .map(([predictedConfidenceBps, stats]) =>
        Object.freeze({
          predictedConfidenceBps,
          predictedCount: stats.predicted,
          observedSuccessCount: stats.observed,
          observedFrequencyBps: stats.predicted === 0 ? 0 : Math.round((stats.observed * 10_000) / stats.predicted),
        }),
      ),
  );
}

export function calibrationDriftBps(bin: CalibrationBin): number {
  return Math.abs(bin.observedFrequencyBps - bin.predictedConfidenceBps);
}
