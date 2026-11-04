import type { UtcInstant } from '@solstice/domain';
import { EVENT_EMBARGO_DAYS } from './taxonomy.ts';
import type { ChronologySummary } from './types.ts';

export type ChronologicalEarningsObservation = {
  readonly eventId: string;
  readonly issuerId: string;
  readonly scheduledAt: UtcInstant;
  readonly decisionAt: UtcInstant;
  readonly knowableAt: UtcInstant;
};

export type ChronologySplit = {
  readonly train: readonly ChronologicalEarningsObservation[];
  readonly validation: readonly ChronologicalEarningsObservation[];
  readonly holdout: readonly ChronologicalEarningsObservation[];
  readonly walkForwardFolds: readonly (readonly ChronologicalEarningsObservation[])[];
  readonly summary: ChronologySummary;
};

const MS_PER_DAY = 86_400_000;

export function splitChronologicalEarnings(input: {
  readonly observations: readonly ChronologicalEarningsObservation[];
}): ChronologySplit {
  const sorted = [...input.observations].sort(
    (a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt),
  );
  const n = sorted.length;
  const trainEnd = Math.floor(n * 0.6);
  const valEnd = Math.floor(n * 0.8);
  const train = sorted.slice(0, trainEnd);
  const validation = sorted.slice(trainEnd, valEnd);
  const holdout = sorted.slice(valEnd);

  let embargoViolations = 0;
  let issuerLeakageViolations = 0;
  const issuerTrainLast = new Map<string, number>();

  for (const row of train) {
    issuerTrainLast.set(row.issuerId, Date.parse(row.knowableAt));
  }

  for (const row of [...validation, ...holdout]) {
    if (Date.parse(row.knowableAt) <= Date.parse(row.decisionAt)) {
      embargoViolations += 1;
    }
    const lastTrain = issuerTrainLast.get(row.issuerId);
    if (lastTrain !== undefined) {
      const embargoMs = EVENT_EMBARGO_DAYS * MS_PER_DAY;
      if (Date.parse(row.decisionAt) - lastTrain < embargoMs) {
        issuerLeakageViolations += 1;
      }
    }
  }

  const foldSize = Math.max(3, Math.floor(n / 5));
  const walkForwardFolds: ChronologicalEarningsObservation[][] = [];
  for (let start = 0; start + foldSize <= n; start += foldSize) {
    walkForwardFolds.push(sorted.slice(start, start + foldSize));
  }

  const summary: ChronologySummary = Object.freeze({
    trainEventCount: train.length,
    validationEventCount: validation.length,
    holdoutEventCount: holdout.length,
    walkForwardFoldCount: walkForwardFolds.length,
    embargoViolations,
    issuerLeakageViolations,
  });

  return Object.freeze({
    train: Object.freeze(train),
    validation: Object.freeze(validation),
    holdout: Object.freeze(holdout),
    walkForwardFolds: Object.freeze(walkForwardFolds.map((fold) => Object.freeze(fold))),
    summary,
  });
}

export function chronologySplitValid(summary: ChronologySummary): boolean {
  return summary.embargoViolations === 0 && summary.issuerLeakageViolations === 0;
}
