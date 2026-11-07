import type { Jurisdiction, UtcInstant } from '@solstice/domain';
import { localDateKey } from '../../multi-asset/market-calendar/timezone.ts';
import type { LocalDateKey } from '../../multi-asset/market-calendar/types.ts';
import type { Exec09AssetClass } from './taxonomy.ts';
import type { SettlementCalendarPort, VersionedSettlementPolicy } from './types.ts';

export type SettlementPolicyLookupInput = {
  readonly market: string;
  readonly assetClass: Exec09AssetClass;
  readonly jurisdiction: Jurisdiction;
  readonly tradeTimestamp: UtcInstant;
  readonly marketTimeZone: string;
};

export function resolveActiveSettlementPolicy(
  policies: readonly VersionedSettlementPolicy[],
  input: SettlementPolicyLookupInput,
): VersionedSettlementPolicy | null {
  const tradeDate = localDateKey(input.tradeTimestamp, input.marketTimeZone);
  const matches = policies.filter(
    (policy) =>
      policy.market === input.market &&
      policy.assetClass === input.assetClass &&
      policy.jurisdiction === input.jurisdiction &&
      policy.effectiveFrom <= tradeDate &&
      (policy.effectiveTo === null || policy.effectiveTo >= tradeDate),
  );
  if (matches.length === 0) {
    return null;
  }
  return matches
    .slice()
    .sort((left, right) => (left.effectiveFrom < right.effectiveFrom ? 1 : -1))[0]!;
}

export function contractualSettlementDate(input: {
  readonly tradeTimestamp: UtcInstant;
  readonly marketTimeZone: string;
  readonly policy: VersionedSettlementPolicy;
  readonly marketCalendar: SettlementCalendarPort;
  readonly currencyCalendar: SettlementCalendarPort;
}): LocalDateKey {
  const tradeDate = localDateKey(input.tradeTimestamp, input.marketTimeZone);
  const marketAdjusted = input.marketCalendar.addBusinessDays(tradeDate, input.policy.settlementLagBusinessDays);
  if (input.currencyCalendar.isBusinessDay(marketAdjusted)) {
    return marketAdjusted;
  }
  return input.currencyCalendar.addBusinessDays(marketAdjusted, 1);
}

export function actualSettlementEligible(input: {
  readonly contractualSettlementDate: LocalDateKey;
  readonly now: UtcInstant;
  readonly marketTimeZone: string;
  readonly currencyCalendar: SettlementCalendarPort;
}): boolean {
  const today = localDateKey(input.now, input.marketTimeZone);
  if (today < input.contractualSettlementDate) {
    return false;
  }
  return input.currencyCalendar.isBusinessDay(today);
}
