import { randomUUID } from 'node:crypto';

export type HeliosExperimentId = string & { readonly __brand: 'HeliosExperimentId' };
export type HeliosEvaluationRunId = string & { readonly __brand: 'HeliosEvaluationRunId' };
export type HeliosMicrocapitalChallengeId = string & { readonly __brand: 'HeliosMicrocapitalChallengeId' };

export function asHeliosExperimentId(value: string): HeliosExperimentId {
  if (!value.startsWith('hexp_')) {
    throw new Error(`invalid HeliosExperimentId: ${value}`);
  }
  return value as HeliosExperimentId;
}

export function asHeliosEvaluationRunId(value: string): HeliosEvaluationRunId {
  if (!value.startsWith('herun_')) {
    throw new Error(`invalid HeliosEvaluationRunId: ${value}`);
  }
  return value as HeliosEvaluationRunId;
}

export function asHeliosMicrocapitalChallengeId(value: string): HeliosMicrocapitalChallengeId {
  if (!value.startsWith('hmc_')) {
    throw new Error(`invalid HeliosMicrocapitalChallengeId: ${value}`);
  }
  return value as HeliosMicrocapitalChallengeId;
}

export function experimentIdFor(seed?: string): HeliosExperimentId {
  return asHeliosExperimentId(`hexp_${seed ?? randomUUID()}`);
}

export function evaluationRunIdFor(seed?: string): HeliosEvaluationRunId {
  return asHeliosEvaluationRunId(`herun_${seed ?? randomUUID()}`);
}

export function microcapitalChallengeIdFor(seed?: string): HeliosMicrocapitalChallengeId {
  return asHeliosMicrocapitalChallengeId(`hmc_${seed ?? randomUUID()}`);
}
