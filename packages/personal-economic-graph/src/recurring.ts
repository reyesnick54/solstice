import { addMs } from '../../config/src/clock.ts';
import type { UtcInstant } from '../../domain/src/time.ts';
import type { EconomicActivity } from './store.ts';
import type { ActivityClassification, RecurringCadence } from './taxonomy.ts';

const DAY_MS = 86_400_000n;

export type RecurringPattern = {
  readonly key: string;
  readonly direction: 'INFLOW' | 'OUTFLOW';
  readonly counterpartRef: string;
  readonly counterpartKind: string;
  readonly counterpartLabel?: string;
  readonly amount: { readonly minorUnits: string; readonly currency: string };
  readonly cadence: RecurringCadence;
  readonly classification: ActivityClassification;
  readonly lastObserved: UtcInstant;
  readonly nextExpected: UtcInstant;
  readonly sourceRefs: readonly string[];
  readonly occurrenceCount: number;
  readonly confidence: 'DERIVED';
  readonly patternConfidence: 'LOW' | 'MEDIUM' | 'HIGH';
};

function intervalDays(from: UtcInstant, to: UtcInstant): bigint {
  const delta = BigInt(Date.parse(to) - Date.parse(from));
  if (delta < 0n) {
    return 0n;
  }
  return delta / DAY_MS;
}

function cadenceFromIntervals(intervals: readonly bigint[]): RecurringCadence | null {
  if (intervals.length === 0) {
    return null;
  }
  const allIn = (min: bigint, max: bigint): boolean => intervals.every((value) => value >= min && value <= max);
  if (allIn(6n, 8n)) {
    return 'WEEKLY';
  }
  if (allIn(13n, 16n)) {
    return 'BIWEEKLY';
  }
  if (allIn(28n, 33n)) {
    return 'MONTHLY';
  }
  if (allIn(89n, 93n)) {
    return 'QUARTERLY';
  }
  if (allIn(360n, 370n)) {
    return 'YEARLY';
  }
  return null;
}

function cadenceAdvanceMs(cadence: RecurringCadence): bigint {
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
  }
}

function classifyPattern(
  direction: 'INFLOW' | 'OUTFLOW',
  counterpartKind: string,
  existing: ActivityClassification,
): ActivityClassification {
  if (existing !== 'UNKNOWN') {
    return existing;
  }
  if (direction === 'INFLOW') {
    if (counterpartKind === 'EMPLOYER') {
      return 'SALARY';
    }
    return 'UNKNOWN';
  }
  if (counterpartKind === 'LANDLORD') {
    return 'RENT';
  }
  if (counterpartKind === 'LENDER') {
    return 'LOAN_PAYMENT';
  }
  if (counterpartKind === 'MERCHANT') {
    return 'SUBSCRIPTION';
  }
  return 'UNKNOWN';
}

/**
 * Deterministic recurring-pattern detection. No LLM. Groups exact
 * counterpart + currency + amount + direction sequences.
 */
export function detectRecurringPatterns(activities: readonly EconomicActivity[]): readonly RecurringPattern[] {
  const groups = new Map<string, EconomicActivity[]>();
  for (const activity of activities) {
    if (!activity.counterpart) {
      continue;
    }
    const key = [
      activity.direction,
      activity.counterpart.ref,
      activity.amount.currency,
      activity.amount.minorUnits,
    ].join('|');
    const list = groups.get(key) ?? [];
    list.push(activity);
    groups.set(key, list);
  }

  const patterns: RecurringPattern[] = [];
  for (const [key, group] of groups) {
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
    const first = ordered[0]!;
    const last = ordered[ordered.length - 1]!;
    const counterpart = first.counterpart!;
    const classification = classifyPattern(
      first.direction,
      counterpart.kind,
      first.classification,
    );
    if (first.direction === 'INFLOW' && classification === 'UNKNOWN') {
      continue;
    }
    patterns.push(
      Object.freeze({
        key,
        direction: first.direction,
        counterpartRef: counterpart.ref,
        counterpartKind: counterpart.kind,
        ...(counterpart.label ? { counterpartLabel: counterpart.label } : {}),
        amount: Object.freeze({ ...first.amount }),
        cadence,
        classification,
        lastObserved: last.occurredAt,
        nextExpected: addMs(last.occurredAt, cadenceAdvanceMs(cadence)),
        sourceRefs: Object.freeze(ordered.map((item) => item.sourceRef)),
        occurrenceCount: ordered.length,
        confidence: 'DERIVED',
        patternConfidence: ordered.length >= 4 ? 'HIGH' : ordered.length >= 3 ? 'MEDIUM' : 'LOW',
      }),
    );
  }
  return Object.freeze(patterns);
}

export function incomeKindFromClassification(
  classification: ActivityClassification,
): 'SALARY' | 'FREELANCE' | 'BENEFITS' | 'INVESTMENT_INCOME' | 'BUSINESS_DISTRIBUTION' | 'OTHER' {
  switch (classification) {
    case 'SALARY':
      return 'SALARY';
    case 'FREELANCE':
      return 'FREELANCE';
    case 'BENEFITS':
      return 'BENEFITS';
    case 'INVESTMENT_INCOME':
      return 'INVESTMENT_INCOME';
    case 'BUSINESS_DISTRIBUTION':
      return 'BUSINESS_DISTRIBUTION';
    default:
      return 'OTHER';
  }
}
