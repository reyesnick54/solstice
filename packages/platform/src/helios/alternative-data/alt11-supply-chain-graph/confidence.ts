import type { ConfidenceState } from '../../feature-fabric/entity-resolution/types.ts';

/** Maps entity-resolution confidence states to a deterministic 0–1000 milli score for graph propagation. */
export function confidenceScoreMilliFromState(state: ConfidenceState): number {
  switch (state) {
    case 'CONFIRMED':
      return 900;
    case 'PROVISIONAL':
      return 650;
    case 'INFERRED':
      return 400;
    case 'DISPUTED':
      return 200;
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}

export function combinePathConfidenceMilli(edgeScoresMilli: readonly number[]): number {
  if (edgeScoresMilli.length === 0) {
    return 0;
  }
  let product = 1000;
  for (const score of edgeScoresMilli) {
    product = Math.floor((product * Math.max(0, Math.min(1000, score))) / 1000);
  }
  return product;
}
