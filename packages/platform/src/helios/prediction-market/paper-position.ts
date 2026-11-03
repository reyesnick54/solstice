/**
 * Paper position tracking for prediction-market research (not a wallet subsystem).
 */

import type { UtcInstant } from '@solstice/domain';
import type { PredictionOutcomeSide } from './taxonomy.ts';
import type { PaperPositionLeg, PaperPositionRecord } from './types.ts';

export type ApplyPaperFillInput = {
  readonly positions: readonly PaperPositionRecord[];
  readonly conditionId: string;
  readonly outcomeSide: PredictionOutcomeSide;
  readonly side: 'BUY' | 'SELL';
  readonly quantityContracts: bigint;
  readonly priceMinor: bigint;
  readonly asOf: UtcInstant;
  readonly positionIdPrefix: string;
};

function updateLeg(
  legs: PaperPositionLeg[],
  outcomeSide: PredictionOutcomeSide,
  deltaQty: bigint,
  priceMinor: bigint,
): PaperPositionLeg[] {
  const idx = legs.findIndex((l) => l.side === outcomeSide);
  if (idx < 0) {
    if (deltaQty <= 0n) {
      return legs;
    }
    return [...legs, Object.freeze({ side: outcomeSide, quantityContracts: deltaQty, averagePriceMinor: priceMinor })];
  }
  const leg = legs[idx]!;
  const newQty = leg.quantityContracts + deltaQty;
  if (newQty <= 0n) {
    return legs.filter((_, i) => i !== idx);
  }
  const notional = leg.quantityContracts * leg.averagePriceMinor + deltaQty * priceMinor;
  const avg = notional / newQty;
  const next = [...legs];
  next[idx] = Object.freeze({ side: outcomeSide, quantityContracts: newQty, averagePriceMinor: avg });
  return next;
}

export function applyPaperFill(input: ApplyPaperFillInput): readonly PaperPositionRecord[] {
  const delta = input.side === 'BUY' ? input.quantityContracts : -input.quantityContracts;
  const existing = input.positions.find((p) => p.conditionId === input.conditionId);
  if (!existing) {
    if (delta <= 0n) {
      return input.positions;
    }
    const created: PaperPositionRecord = Object.freeze({
      positionId: `${input.positionIdPrefix}_pos`,
      conditionId: input.conditionId,
      legs: Object.freeze([
        Object.freeze({
          side: input.outcomeSide,
          quantityContracts: delta,
          averagePriceMinor: input.priceMinor,
        }),
      ]),
      openedAt: input.asOf,
      lastUpdatedAt: input.asOf,
      markPriceMinor: input.priceMinor,
      unrealizedPnlMinor: 0n,
    });
    return Object.freeze([...input.positions, created]);
  }

  const legs = updateLeg([...existing.legs], input.outcomeSide, delta, input.priceMinor);
  const updated: PaperPositionRecord = Object.freeze({
    ...existing,
    legs: Object.freeze(legs),
    lastUpdatedAt: input.asOf,
    markPriceMinor: input.priceMinor,
    unrealizedPnlMinor: markUnrealized(legs, input.priceMinor, input.outcomeSide),
  });
  return Object.freeze(input.positions.map((p) => (p.positionId === existing.positionId ? updated : p)));
}

function markUnrealized(
  legs: readonly PaperPositionLeg[],
  markMinor: bigint,
  side: PredictionOutcomeSide,
): bigint {
  const leg = legs.find((l) => l.side === side);
  if (!leg) {
    return 0n;
  }
  return (markMinor - leg.averagePriceMinor) * leg.quantityContracts;
}
