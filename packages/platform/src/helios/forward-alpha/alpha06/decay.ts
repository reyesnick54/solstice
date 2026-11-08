/**
 * ALPHA06 — SignalToImplementationDecay between theoretical and paper lanes.
 */

import { clampBps } from '../../execution-connectivity/exec07/numeric.ts';
import type { Alpha06LaneReturn } from './types.ts';

export function pickLane(lanes: readonly Alpha06LaneReturn[], lane: Alpha06LaneReturn['lane']): Alpha06LaneReturn | null {
  return lanes.find((row) => row.lane === lane) ?? null;
}

/**
 * Decay in basis points: positive when execution erodes signal edge (signal bps − implementable bps).
 */
export function computeSignalToImplementationDecay(lanes: readonly Alpha06LaneReturn[]): number | null {
  const signal = pickLane(lanes, 'SIGNAL_ONLY_RETURN');
  const implementable = pickLane(lanes, 'IMPLEMENTABLE_RETURN');
  if (signal?.returnBps == null || implementable?.returnBps == null) {
    return null;
  }
  return clampBps(signal.returnBps - implementable.returnBps);
}

export function alphaSurvivesAfterExecution(lanes: readonly Alpha06LaneReturn[]): boolean {
  const signal = pickLane(lanes, 'SIGNAL_ONLY_RETURN');
  const implementable = pickLane(lanes, 'IMPLEMENTABLE_RETURN');
  if (!signal || !implementable) {
    return false;
  }
  if (signal.netPnlMinor <= 0n) {
    return false;
  }
  return implementable.netPnlMinor > 0n;
}
