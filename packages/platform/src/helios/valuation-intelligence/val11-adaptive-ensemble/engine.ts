import type { UtcInstant } from '@solstice/domain';

import type { ValuationMethod } from '../taxonomy.ts';
import { distributionPercentiles } from '../val04-probabilistic-dcf/percentiles.ts';
import { VAL11_ADAPTIVE_ENSEMBLE_SCHEMA } from './taxonomy.ts';

export type EnsembleModelSample = {
  readonly method: ValuationMethod;
  readonly applicabilityScore: number;
  readonly valuePerShareSamples: readonly number[];
};

export type AdaptiveEnsembleResult = {
  readonly schema: typeof VAL11_ADAPTIVE_ENSEMBLE_SCHEMA;
  readonly entityId: string;
  readonly asOf: UtcInstant;
  readonly modelWeights: Readonly<Record<string, number>>;
  readonly modelApplicability: Readonly<Record<string, number>>;
  readonly independentIntrinsicValuePerShare: ReturnType<typeof distributionPercentiles>;
  readonly evidenceRef: string;
  readonly grantsExecutionAuthority: false;
  readonly researchOnly: true;
};

function normalizeWeights(scores: readonly number[]): readonly number[] {
  const sum = scores.reduce((acc, row) => acc + row, 0);
  if (sum <= 0) return scores.map(() => 1 / scores.length);
  return scores.map((row) => row / sum);
}

export function runAdaptiveEnsemble(input: {
  readonly entityId: string;
  readonly asOf: UtcInstant;
  readonly models: readonly EnsembleModelSample[];
  readonly evidenceRef: string;
}): AdaptiveEnsembleResult {
  const pathCount = input.models[0]?.valuePerShareSamples.length ?? 0;
  const applicability = Object.fromEntries(
    input.models.map((row) => [row.method, row.applicabilityScore]),
  );
  const rawWeights = normalizeWeights(input.models.map((row) => row.applicabilityScore));
  const modelWeights = Object.fromEntries(
    input.models.map((row, index) => [row.method, rawWeights[index] ?? 0]),
  );
  const blended: number[] = [];
  for (let i = 0; i < pathCount; i += 1) {
    let value = 0;
    for (let m = 0; m < input.models.length; m += 1) {
      value += (rawWeights[m] ?? 0) * (input.models[m]!.valuePerShareSamples[i] ?? 0);
    }
    blended.push(value);
  }
  return Object.freeze({
    schema: VAL11_ADAPTIVE_ENSEMBLE_SCHEMA,
    entityId: input.entityId,
    asOf: input.asOf,
    modelWeights: Object.freeze(modelWeights),
    modelApplicability: Object.freeze(applicability),
    independentIntrinsicValuePerShare: distributionPercentiles(blended),
    evidenceRef: input.evidenceRef,
    grantsExecutionAuthority: false,
    researchOnly: true,
  });
}
