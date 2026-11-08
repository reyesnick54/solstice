/**
 * HELIOS Forward Alpha ALPHA09 — performance concentration attribution.
 */

import { RATIO_UNIT, ratioFromUnits, type Ratio } from '@solstice/risk';

import {
  ALPHA09_SINGLE_SLICE_DOMINANCE_BPS,
  ALPHA09_TOP5_TRADES_DOMINANCE_BPS,
} from './taxonomy.ts';
import type { ForwardAlpha09ConcentrationState, ForwardAlpha09TradeObservation } from './types.ts';

function topShareByKey(
  trades: readonly ForwardAlpha09TradeObservation[],
  totalMinor: bigint,
  pick: (t: ForwardAlpha09TradeObservation) => string,
): Ratio {
  if (totalMinor <= 0n || trades.length === 0) {
    return ratioFromUnits(0n);
  }
  const buckets = new Map<string, bigint>();
  for (const trade of trades) {
    const key = pick(trade);
    buckets.set(key, (buckets.get(key) ?? 0n) + trade.realizedPnlMinor);
  }
  let max = 0n;
  for (const value of buckets.values()) {
    if (value > max) {
      max = value;
    }
  }
  return ratioFromUnits((max * RATIO_UNIT) / totalMinor);
}

function computeTopTradeShare(
  trades: readonly ForwardAlpha09TradeObservation[],
  totalMinor: bigint,
): Ratio {
  if (totalMinor <= 0n || trades.length === 0) {
    return ratioFromUnits(0n);
  }
  let max = 0n;
  for (const trade of trades) {
    if (trade.realizedPnlMinor > max) {
      max = trade.realizedPnlMinor;
    }
  }
  return ratioFromUnits((max * RATIO_UNIT) / totalMinor);
}

function computeTop5TradesShare(
  trades: readonly ForwardAlpha09TradeObservation[],
  totalMinor: bigint,
): Ratio {
  if (totalMinor <= 0n || trades.length === 0) {
    return ratioFromUnits(0n);
  }
  const sorted = [...trades]
    .map((t) => t.realizedPnlMinor)
    .sort((a, b) => (a > b ? -1 : a < b ? 1 : 0));
  const top5 = sorted.slice(0, Math.min(5, sorted.length));
  const sum = top5.reduce((acc, v) => acc + v, 0n);
  return ratioFromUnits((sum * RATIO_UNIT) / totalMinor);
}

function ratioToBps(ratio: Ratio): number {
  return Number((ratio.units * 10_000n) / RATIO_UNIT);
}

export function analyzeForwardAlphaConcentration(
  trades: readonly ForwardAlpha09TradeObservation[],
): ForwardAlpha09ConcentrationState {
  const totalAttributedPnlMinor = trades.reduce((sum, row) => sum + row.realizedPnlMinor, 0n);
  const denominator = totalAttributedPnlMinor > 0n ? totalAttributedPnlMinor : 1n;

  const topTradeShare = computeTopTradeShare(trades, denominator);
  const top5TradesShare = computeTop5TradesShare(trades, denominator);
  const topInstrumentShare = topShareByKey(trades, denominator, (t) => t.instrumentId);
  const topSectorShare = topShareByKey(trades, denominator, (t) => t.sectorId);
  const topMonthShare = topShareByKey(trades, denominator, (t) => t.monthKey);
  const topEventShare = topShareByKey(trades, denominator, (t) => t.eventId);

  const slices = [
    topTradeShare,
    topInstrumentShare,
    topSectorShare,
    topMonthShare,
    topEventShare,
  ];
  const singleSliceDominance = slices.some((row) => ratioToBps(row) > ALPHA09_SINGLE_SLICE_DOMINANCE_BPS);
  const top5Dominance = ratioToBps(top5TradesShare) > ALPHA09_TOP5_TRADES_DOMINANCE_BPS;
  const repeatabilityClaimBlocked =
    totalAttributedPnlMinor > 0n && (singleSliceDominance || top5Dominance);

  return Object.freeze({
    schema: 'sunrey.helios.forward-alpha.concentration-state.v1',
    totalAttributedPnlMinor,
    topTradeShare,
    top5TradesShare,
    topInstrumentShare,
    topSectorShare,
    topMonthShare,
    topEventShare,
    singleSliceDominance,
    repeatabilityClaimBlocked,
  });
}
