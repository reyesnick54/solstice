/**
 * ALPHA01 alignment — Strategy Lab evaluation modes map into canonical forward evidence lanes.
 * Historical replay (REPLAY) is not forward evidence and must not be relabeled.
 */

import type { EvaluationMode } from './types.ts';
import type { ForwardAlphaEvidenceLane } from '../forward-alpha/taxonomy.ts';
import {
  assertCannotRelabelBacktestAsForward,
  assertCannotRelabelHistoricalReplayAsForward,
} from '../forward-alpha/lane-separation.ts';

export const EVALUATION_MODE_TO_FORWARD_ALPHA_LANE: Readonly<Partial<Record<EvaluationMode, ForwardAlphaEvidenceLane>>> =
  Object.freeze({
    HISTORICAL_BACKTEST: 'HISTORICAL_BACKTEST',
    WALK_FORWARD: 'WALK_FORWARD',
    SHADOW_FORWARD: 'FORWARD_SHADOW',
    PAPER_FORWARD: 'FORWARD_PAPER',
  });

export function forwardAlphaLaneForEvaluationMode(mode: EvaluationMode): ForwardAlphaEvidenceLane | null {
  if (mode === 'REPLAY') {
    return null;
  }
  return EVALUATION_MODE_TO_FORWARD_ALPHA_LANE[mode] ?? null;
}

export function assertEvaluationModeNotRelabeledAsForward(input: {
  readonly fromMode: EvaluationMode;
  readonly toLane: ForwardAlphaEvidenceLane;
  readonly syntheticHistoricalReplay: boolean;
}): boolean {
  if (input.fromMode === 'REPLAY') {
    return assertCannotRelabelHistoricalReplayAsForward(input.syntheticHistoricalReplay);
  }
  const fromLane = forwardAlphaLaneForEvaluationMode(input.fromMode);
  if (!fromLane) {
    return true;
  }
  return assertCannotRelabelBacktestAsForward({ fromLane, toLane: input.toLane });
}

export function sealedHoldoutForwardAlphaLane(): ForwardAlphaEvidenceLane {
  return 'SEALED_HOLDOUT';
}
