import type { UtcInstant } from '../../domain/src/time.ts';
import type { ReplenishmentPolicyKind } from './taxonomy.ts';
import type { ReplenishmentPolicy } from './types.ts';

type UsageWindowRecord = {
  readonly consumedAt: UtcInstant;
  readonly quantity: bigint;
};

type ActiveReservationRecord = {
  readonly quantity: bigint;
  readonly expiresAt: UtcInstant;
};

const MS_PER_DAY = 86_400_000;

function parseInstant(value: UtcInstant): number {
  return Date.parse(value);
}

function startOfUtcDay(instant: UtcInstant): UtcInstant {
  const date = new Date(parseInstant(instant));
  date.setUTCHours(0, 0, 0, 0);
  return date.toISOString() as UtcInstant;
}

function startOfUtcWeek(instant: UtcInstant): UtcInstant {
  const date = new Date(parseInstant(instant));
  const day = date.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  date.setUTCDate(date.getUTCDate() - diff);
  date.setUTCHours(0, 0, 0, 0);
  return date.toISOString() as UtcInstant;
}

function startOfUtcMonth(instant: UtcInstant): UtcInstant {
  const date = new Date(parseInstant(instant));
  date.setUTCDate(1);
  date.setUTCHours(0, 0, 0, 0);
  return date.toISOString() as UtcInstant;
}

export function replenishmentWindow(
  kind: ReplenishmentPolicyKind,
  evaluatedAt: UtcInstant,
  policy: ReplenishmentPolicy,
): { readonly windowStartAt: UtcInstant; readonly windowEndAt: UtcInstant | null } {
  switch (kind) {
    case 'NONE':
      return { windowStartAt: policy.windowStartAt, windowEndAt: policy.windowEndAt };
    case 'FIXED_WINDOW':
      return { windowStartAt: policy.windowStartAt, windowEndAt: policy.windowEndAt };
    case 'DAILY':
      return {
        windowStartAt: startOfUtcDay(evaluatedAt),
        windowEndAt: new Date(parseInstant(startOfUtcDay(evaluatedAt)) + MS_PER_DAY).toISOString() as UtcInstant,
      };
    case 'WEEKLY':
      return {
        windowStartAt: startOfUtcWeek(evaluatedAt),
        windowEndAt: new Date(parseInstant(startOfUtcWeek(evaluatedAt)) + 7 * MS_PER_DAY).toISOString() as UtcInstant,
      };
    case 'MONTHLY': {
      const start = startOfUtcMonth(evaluatedAt);
      const end = new Date(parseInstant(start));
      end.setUTCMonth(end.getUTCMonth() + 1);
      return { windowStartAt: start, windowEndAt: end.toISOString() as UtcInstant };
    }
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

export function usageInWindow(
  usage: readonly UsageWindowRecord[],
  windowStartAt: UtcInstant,
  windowEndAt: UtcInstant | null,
): bigint {
  const startMs = parseInstant(windowStartAt);
  const endMs = windowEndAt ? parseInstant(windowEndAt) : Number.POSITIVE_INFINITY;
  let total = 0n;
  for (const record of usage) {
    const at = parseInstant(record.consumedAt);
    if (at >= startMs && at < endMs) {
      total += record.quantity;
    }
  }
  return total;
}

export function activeReservationsTotal(
  reservations: readonly ActiveReservationRecord[],
  evaluatedAt: UtcInstant,
): bigint {
  const now = parseInstant(evaluatedAt);
  let total = 0n;
  for (const reservation of reservations) {
    if (parseInstant(reservation.expiresAt) > now) {
      total += reservation.quantity;
    }
  }
  return total;
}

export function nextReplenishmentAt(
  kind: ReplenishmentPolicyKind,
  evaluatedAt: UtcInstant,
  policy: ReplenishmentPolicy,
): UtcInstant | null {
  const window = replenishmentWindow(kind, evaluatedAt, policy);
  return window.windowEndAt;
}
