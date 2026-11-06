/**
 * VAL07 bridge — cost of equity from canonical VAL03 Cost of Capital Engine.
 */

import type { CostOfCapitalSnapshot } from '../val03-cost-of-capital/types.ts';

export const VAL07_VAL03_BRIDGE_VERSION = 'helios-val07-val03-cost-of-equity-bridge-v1' as const;

export function costOfEquityMidBpsFromVal03(snapshot: CostOfCapitalSnapshot): number {
  return snapshot.costOfEquity.capm.midBps;
}

export function costOfEquityUncertaintyBpsFromVal03(snapshot: CostOfCapitalSnapshot): {
  readonly lowBps: number;
  readonly midBps: number;
  readonly highBps: number;
} {
  const capm = snapshot.costOfEquity.capm;
  return Object.freeze({
    lowBps: capm.lowBps,
    midBps: capm.midBps,
    highBps: capm.highBps,
  });
}
