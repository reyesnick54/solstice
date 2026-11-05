/**
 * Consume EARN09 probabilistic earnings state for forward cash-flow anchors.
 */

import type { UtcInstant } from '@solstice/domain';
import type { ProbabilisticEarningsState } from '../earnings-intelligence/state-estimator/types.ts';
import type { Earn09ProbabilisticStateBinding } from './input-manifest.ts';

export const VAL01_EARN09_BRIDGE_VERSION = 'helios-val01-earn09-bridge-v1' as const;

export function bindEarn09ProbabilisticState(input: {
  readonly state: ProbabilisticEarningsState;
  readonly stateRef: string;
}): Earn09ProbabilisticStateBinding {
  return Object.freeze({
    source: 'earn09_probabilistic_earnings_state',
    stateRef: input.stateRef,
    evaluationTime: input.state.asOf,
    knowableAt: input.state.asOf,
    grantsExecutionAuthority: false,
  });
}

export function forwardEpsAnchorMinor(state: ProbabilisticEarningsState): bigint | null {
  const raw = state.nextQuarterEps?.pointEstimate;
  if (!raw) {
    return null;
  }
  try {
    const asNumber = Number(raw);
    if (!Number.isFinite(asNumber)) {
      return null;
    }
    return BigInt(Math.round(asNumber * 100));
  } catch {
    return null;
  }
}

export function earn09KnowableAt(state: ProbabilisticEarningsState): UtcInstant {
  return state.asOf;
}
