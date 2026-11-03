/**
 * Simulated CLOB fills against observed book depth (paper research only).
 */

import { computeClobBookMetrics } from './clob-metrics.ts';
import type { SimulatedFillInput, SimulatedFillResult } from './types.ts';

export function simulateClobFill(input: SimulatedFillInput): SimulatedFillResult {
  const { side, quantityContracts, book } = input;
  if (quantityContracts <= 0n) {
    return Object.freeze({
      filled: false,
      partial: false,
      filledQuantity: 0n,
      averagePriceMinor: 0n,
      spreadCostMinor: 0n,
      reason: 'NON_POSITIVE_QUANTITY',
    });
  }

  const metrics = computeClobBookMetrics(book);
  const levels = side === 'BUY' ? book.book.asks : book.book.bids;
  if (levels.length === 0) {
    return Object.freeze({
      filled: false,
      partial: false,
      filledQuantity: 0n,
      averagePriceMinor: 0n,
      spreadCostMinor: 0n,
      reason: 'EMPTY_BOOK',
    });
  }

  let remaining = quantityContracts;
  let filled = 0n;
  let notional = 0n;
  for (const level of levels) {
    if (remaining <= 0n) {
      break;
    }
    const take = level.quantityMinorUnits < remaining ? level.quantityMinorUnits : remaining;
    notional += take * level.priceMinorUnits;
    filled += take;
    remaining -= take;
  }

  const partial = filled > 0n && filled < quantityContracts;
  if (filled === 0n) {
    return Object.freeze({
      filled: false,
      partial: false,
      filledQuantity: 0n,
      averagePriceMinor: 0n,
      spreadCostMinor: 0n,
      reason: 'NO_LIQUIDITY',
    });
  }

  const avg = notional / filled;
  const ref = side === 'BUY' ? metrics.bestAskMinor : metrics.bestBidMinor;
  const spreadCostMinor =
    ref !== null && metrics.spreadMinor !== null ? (metrics.spreadMinor * filled) / 2n : 0n;

  return Object.freeze({
    filled: true,
    partial,
    filledQuantity: filled,
    averagePriceMinor: avg,
    spreadCostMinor,
    reason: partial ? 'PARTIAL_FILL' : 'FULL_FILL',
  });
}
