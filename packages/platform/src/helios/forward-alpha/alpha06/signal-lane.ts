/**
 * ALPHA06 — theoretical signal-only return lane (no execution friction).
 */

import { bpsFromMinorDelta } from '../../execution-connectivity/exec07/numeric.ts';
import type { ForwardAlphaReturnLane } from '../taxonomy.ts';
import type { Alpha06ForwardScenario, Alpha06LaneReturn } from './types.ts';

export function computeSignalOnlyReturn(scenario: Alpha06ForwardScenario): Alpha06LaneReturn {
  const qty = scenario.entry.quantityUnits;
  const entry = scenario.entry.signalPriceMinor;
  const exit = scenario.exit.signalPriceMinor;
  const directional = exit - entry;
  const netPnlMinor = directional * qty;
  const notionalMinor = entry * qty;
  return Object.freeze({
    lane: 'SIGNAL_ONLY_RETURN' satisfies ForwardAlphaReturnLane,
    netPnlMinor,
    returnBps: bpsFromMinorDelta(netPnlMinor, notionalMinor > 0n ? notionalMinor : 1n),
    quantityUsedUnits: qty,
    notionalMinor,
  });
}
