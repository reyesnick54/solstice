/**
 * Observed quote topology — preserve locked/crossed markets; never auto-correct.
 */

import type { QuoteTopologyState } from './taxonomy.ts';
import { QUOTE_TOPOLOGY_STATES } from './taxonomy.ts';
import type { UsEquityQuoteSide } from './types.ts';

export function deriveQuoteTopology(
  bid: UsEquityQuoteSide | null,
  ask: UsEquityQuoteSide | null,
): QuoteTopologyState {
  if (!bid && !ask) {
    return 'EMPTY';
  }
  if (!bid || !ask) {
    return 'ONE_SIDED';
  }
  if (bid.priceMinorUnits > ask.priceMinorUnits) {
    return 'CROSSED';
  }
  if (bid.priceMinorUnits === ask.priceMinorUnits) {
    return 'LOCKED';
  }
  return 'NORMAL';
}

export function isObservedTopology(state: QuoteTopologyState): boolean {
  return (QUOTE_TOPOLOGY_STATES as readonly string[]).includes(state);
}
