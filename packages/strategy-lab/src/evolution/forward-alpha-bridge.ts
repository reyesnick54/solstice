/**
 * EVOL programs must keep forward alpha evidence lanes separate from historical evolution trials.
 */

import type { ForwardAlphaEvidenceLane } from '../forward-alpha/taxonomy.ts';
import { assertEvidenceLanesDisjoint } from '../forward-alpha/lane-separation.ts';

export const EVOL_FORWARD_ALPHA_LANE_BINDINGS = Object.freeze({
  HISTORICAL_TRIAL: 'HISTORICAL_BACKTEST',
  NESTED_HOLDOUT: 'SEALED_HOLDOUT',
  WALK_FORWARD_TRIAL: 'WALK_FORWARD',
  FORWARD_SHADOW_TRIAL: 'FORWARD_SHADOW',
  PAPER_TRIAL: 'FORWARD_PAPER',
} as const satisfies Record<string, ForwardAlphaEvidenceLane>);

export type EvolForwardAlphaLaneBinding = keyof typeof EVOL_FORWARD_ALPHA_LANE_BINDINGS;

export function assertEvolTrialLanesSeparated(bindings: readonly EvolForwardAlphaLaneBinding[]): boolean {
  const lanes = bindings.map((key) => EVOL_FORWARD_ALPHA_LANE_BINDINGS[key]);
  return assertEvidenceLanesDisjoint(lanes).length === 0;
}
