/**
 * ALPHA03 — prequential (predictive) sequential evaluation without peeking.
 */

export const HELIOS_ALPHA03_PREQUENTIAL_EVALUATION = 'HELIOS_ALPHA03_PREQUENTIAL_EVALUATION' as const;

export type PrequentialObservation = {
  readonly predictedExcessMinor: bigint;
  readonly realizedExcessMinor: bigint;
};

export function sumPredictiveLoss(observations: readonly PrequentialObservation[]): bigint {
  let loss = 0n;
  for (const row of observations) {
    const err = row.realizedExcessMinor - row.predictedExcessMinor;
    loss += err < 0n ? -err : err;
  }
  return loss;
}

export function prequentialBeatsNaiveZero(
  observations: readonly PrequentialObservation[],
): boolean {
  if (observations.length === 0) {
    return false;
  }
  const modelLoss = sumPredictiveLoss(observations);
  const naiveLoss = observations.reduce(
    (acc, row) => acc + (row.realizedExcessMinor < 0n ? -row.realizedExcessMinor : row.realizedExcessMinor),
    0n,
  );
  return modelLoss < naiveLoss;
}
