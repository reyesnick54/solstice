import { addMs } from '../../../config/src/clock.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import type { EconomicActivity } from '../../../personal-economic-graph/src/store.ts';
import type { RecurringCadence } from '../../../personal-economic-graph/src/taxonomy.ts';
import { recurringObligationIdFor } from './ids.ts';
import { normalizeMerchant } from './merchant.ts';
import type { RecurringObligation } from './models.ts';
import { classifySubscription } from './classification.ts';
import { defaultActionCapabilities } from './provider.ts';
import type { ConfidenceLevel, RecurringFrequency } from './taxonomy.ts';
import { DISCRETIONARY_MERCHANT_PATTERNS } from './taxonomy.ts';

const DAY_MS = 86_400_000n;

export type DetectionInput = {
  readonly userId: string;
  readonly activities: readonly EconomicActivity[];
  readonly now: UtcInstant;
};

function intervalDays(from: UtcInstant, to: UtcInstant): bigint {
  const delta = BigInt(Date.parse(to) - Date.parse(from));
  return delta < 0n ? 0n : delta / DAY_MS;
}

function cadenceFromIntervals(intervals: readonly bigint[]): RecurringFrequency | null {
  if (intervals.length === 0) {
    return null;
  }
  const allIn = (min: bigint, max: bigint): boolean => intervals.every((v) => v >= min && v <= max);
  if (allIn(6n, 8n)) return 'WEEKLY';
  if (allIn(13n, 16n)) return 'BIWEEKLY';
  if (allIn(28n, 33n)) return 'MONTHLY';
  if (allIn(89n, 93n)) return 'QUARTERLY';
  if (allIn(360n, 370n)) return 'YEARLY';
  return null;
}

function cadenceAdvanceMs(cadence: RecurringFrequency): bigint {
  switch (cadence) {
    case 'WEEKLY':
      return 7n * DAY_MS;
    case 'BIWEEKLY':
      return 14n * DAY_MS;
    case 'MONTHLY':
      return 30n * DAY_MS;
    case 'QUARTERLY':
      return 91n * DAY_MS;
    case 'YEARLY':
      return 365n * DAY_MS;
    case 'VARIABLE':
      return 30n * DAY_MS;
  }
}

function isDiscretionaryMerchant(descriptor: string): boolean {
  return DISCRETIONARY_MERCHANT_PATTERNS.some((pattern) => pattern.test(descriptor));
}

function amountVarianceBps(amounts: readonly bigint[]): number {
  if (amounts.length < 2) {
    return 0;
  }
  const avg = amounts.reduce((a, b) => a + b, 0n) / BigInt(amounts.length);
  if (avg === 0n) {
    return 0;
  }
  const maxDev = amounts.reduce((max, value) => {
    const dev = value > avg ? value - avg : avg - value;
    return dev > max ? dev : max;
  }, 0n);
  return Number((maxDev * 10_000n) / avg);
}

function confidenceFrom(occurrences: number, varianceBps: number, discretionary: boolean): ConfidenceLevel {
  if (discretionary) {
    return 'LOW';
  }
  if (occurrences >= 4 && varianceBps <= 500) {
    return 'HIGH';
  }
  if (occurrences >= 3 && varianceBps <= 1500) {
    return 'MEDIUM';
  }
  return 'LOW';
}

function toRecurringCadence(freq: RecurringFrequency): RecurringCadence | 'VARIABLE' {
  if (freq === 'VARIABLE') {
    return 'VARIABLE';
  }
  return freq;
}

/**
 * Deterministic recurring-payment detection with merchant normalization,
 * amount tolerance, and discretionary-merchant exclusion.
 */
export function detectRecurringObligations(input: DetectionInput): readonly RecurringObligation[] {
  const groups = new Map<string, EconomicActivity[]>();

  for (const activity of input.activities) {
    if (activity.direction !== 'OUTFLOW') {
      continue;
    }
    const descriptor =
      activity.counterpart?.label ??
      activity.counterpart?.ref ??
      'unknown';
    if (isDiscretionaryMerchant(descriptor)) {
      continue;
    }
    const merchant = normalizeMerchant(descriptor);
    const key = [merchant.merchantKey, activity.amount.currency].join('|');
    const list = groups.get(key) ?? [];
    list.push(activity);
    groups.set(key, list);
  }

  const obligations: RecurringObligation[] = [];

  for (const [, group] of groups) {
    const ordered = [...group].sort((a, b) => (a.occurredAt < b.occurredAt ? -1 : 1));
    if (ordered.length < 2) {
      continue;
    }

    const intervals: bigint[] = [];
    for (let i = 1; i < ordered.length; i += 1) {
      intervals.push(intervalDays(ordered[i - 1]!.occurredAt, ordered[i]!.occurredAt));
    }
    const cadence = cadenceFromIntervals(intervals);
    if (cadence === null) {
      continue;
    }

    const amounts = ordered.map((item) => BigInt(item.amount.minorUnits));
    const varianceBps = amountVarianceBps(amounts);
    const variableAmount = varianceBps > 1500;
    const frequency: RecurringFrequency = variableAmount ? 'VARIABLE' : cadence;

    const first = ordered[0]!;
    const last = ordered[ordered.length - 1]!;
    const descriptor =
      first.counterpart?.label ?? first.counterpart?.ref ?? 'unknown';
    const merchant = normalizeMerchant(descriptor);
    const discretionary = isDiscretionaryMerchant(descriptor);
    const confidence = confidenceFrom(ordered.length, varianceBps, discretionary);

    if (confidence === 'LOW' && discretionary) {
      continue;
    }

    const avgMinor =
      amounts.reduce((a, b) => a + b, 0n) / BigInt(amounts.length);
    const classification = classifySubscription(merchant.normalizedMerchant);

    obligations.push(
      Object.freeze({
        id: recurringObligationIdFor(input.userId, merchant.merchantKey, first.amount.currency),
        userId: input.userId,
        merchant,
        category: classification.category,
        amount: Object.freeze({
          minorUnits: avgMinor.toString(),
          currency: first.amount.currency,
        }),
        currency: first.amount.currency,
        frequency,
        firstObservedAt: first.occurredAt,
        lastObservedAt: last.occurredAt,
        nextExpectedAt:
          frequency === 'VARIABLE'
            ? null
            : addMs(last.occurredAt, cadenceAdvanceMs(frequency)),
        confidence,
        sourceAccount: first.accountId ?? null,
        transactionReferences: Object.freeze(ordered.map((item) => item.sourceRef)),
        priceChange: null,
        status: confidence === 'LOW' ? 'POTENTIAL' : 'ACTIVE',
        subscriptionType: classification.subscriptionType,
        cancellable: classification.cancellable,
        actionCapabilities: defaultActionCapabilities(classification.category),
        provenance: 'OBSERVED',
        occurrenceCount: ordered.length,
        variableAmount,
      }),
    );
  }

  return Object.freeze(obligations);
}

export { toRecurringCadence };
