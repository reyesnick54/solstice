import type { OutcomeDimensionKey } from './taxonomy.ts';
import { OUTCOME_DIMENSION_KEYS } from './taxonomy.ts';
import type { OutcomeVector } from './types.ts';

export const OUTCOME_VECTOR_KEYS: readonly OutcomeDimensionKey[] = OUTCOME_DIMENSION_KEYS;

export function outcomeVectorToArray(v: OutcomeVector): number[] {
  return OUTCOME_VECTOR_KEYS.map((k) => v[k]);
}

export function arrayToOutcomeVector(values: readonly number[]): OutcomeVector {
  if (values.length !== OUTCOME_VECTOR_KEYS.length) {
    throw new Error('cf04: outcome vector length mismatch');
  }
  const entries = OUTCOME_VECTOR_KEYS.map((k, i) => [k, values[i]!] as const);
  return Object.freeze(Object.fromEntries(entries) as OutcomeVector);
}

export function zeroOutcomeVector(): OutcomeVector {
  return arrayToOutcomeVector(OUTCOME_VECTOR_KEYS.map(() => 0));
}
