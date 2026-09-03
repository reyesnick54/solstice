// @ts-nocheck
import type { UtcInstant } from '../../../domain/src/time.ts';
import type { EconomicActivity } from '../../../personal-economic-graph/src/store.ts';
import type { PriceChange, RecurringObligation } from './models.ts';
import { normalizeMerchant } from './merchant.ts';
import type { ConfidenceLevel } from './taxonomy.ts';
import { UTILITY_MERCHANT_PATTERNS } from './taxonomy.ts';

const DEFAULT_TOLERANCE_BPS = 500;
const UTILITY_TOLERANCE_BPS = 2500;

function isUtility(descriptor: string): boolean {
  return UTILITY_MERCHANT_PATTERNS.some((pattern) => pattern.test(descriptor));
}

function toleranceFor(obligation: RecurringObligation): number {
  if (obligation.category === 'UTILITIES' || isUtility(obligation.merchant.normalizedMerchant)) {
    return UTILITY_TOLERANCE_BPS;
  }
  if (obligation.variableAmount) {
    return UTILITY_TOLERANCE_BPS;
  }
  return DEFAULT_TOLERANCE_BPS;
}

function detectChange(
  previousMinor: bigint,
  currentMinor: bigint,
  toleranceBps: number,
): { readonly absolute: bigint; readonly bps: number } | null {
  if (previousMinor === 0n) {
    return null;
  }
  const absolute = currentMinor > previousMinor ? currentMinor - previousMinor : previousMinor - currentMinor;
  const bps = Number((absolute * 10_000n) / previousMinor);
  if (bps < toleranceBps) {
    return null;
  }
  return { absolute, bps };
}

/**
 * Detect meaningful price changes in recurring bills.
 */
export function detectPriceChanges(
  obligation: RecurringObligation,
  activities: readonly EconomicActivity[],
  now: UtcInstant,
): PriceChange | null {
  if (obligation.variableAmount || obligation.category === 'UTILITIES') {
    return null;
  }
  const merchantKey = obligation.merchant.merchantKey;
  const matching = activities
    .filter(
      (item) =>
        item.direction === 'OUTFLOW' &&
        item.amount.currency === obligation.currency &&
        normalizeMerchant(
          item.counterpart?.label ?? item.counterpart?.ref ?? '',
        ).merchantKey === merchantKey,
    )
    .sort((a, b) => (a.occurredAt < b.occurredAt ? -1 : 1));

  if (matching.length < 2) {
    return null;
  }

  const previous = matching[matching.length - 2]!;
  const current = matching[matching.length - 1]!;
  const prevMinor = BigInt(previous.amount.minorUnits);
  const currMinor = BigInt(current.amount.minorUnits);
  const tolerance = toleranceFor(obligation);
  const change = detectChange(prevMinor, currMinor, tolerance);
  if (!change) {
    return null;
  }

  const confidence: ConfidenceLevel =
    obligation.variableAmount && obligation.category === 'UTILITIES' ? 'LOW' : change.bps >= 1000 ? 'HIGH' : 'MEDIUM';

  return Object.freeze({
    previousAmount: Object.freeze({ ...previous.amount }),
    currentAmount: Object.freeze({ ...current.amount }),
    absoluteChangeMinorUnits: change.absolute.toString(),
    percentageChangeBps: change.bps,
    changeConfidence: confidence,
    detectedAt: now,
  });
}

export function applyPriceChanges(
  obligations: readonly RecurringObligation[],
  activities: readonly EconomicActivity[],
  now: UtcInstant,
): readonly RecurringObligation[] {
  return Object.freeze(
    obligations.map((obligation) => {
      const priceChange = detectPriceChanges(obligation, activities, now);
      if (!priceChange) {
        return obligation;
      }
      return Object.freeze({
        ...obligation,
        amount: priceChange.currentAmount,
        priceChange,
      });
    }),
  );
}
