import type { UtcInstant } from '@solstice/domain';
import type { MarketCalendarRollState } from './taxonomy.ts';
import { daysBetween, localDateKey } from './timezone.ts';
import type { FuturesContractDefinition, FuturesContractSnapshot, MarketCalendarRegistry } from './types.ts';

export function evaluateMarketCalendarContract(input: {
  readonly contract: FuturesContractDefinition;
  readonly at: UtcInstant;
  readonly calendarTimeZone: string;
}): FuturesContractSnapshot {
  const asOfDate = localDateKey(input.at, input.calendarTimeZone);
  const daysToExpiration = daysBetween(asOfDate, input.contract.expirationDate);
  const daysToLastTrade = daysBetween(asOfDate, input.contract.lastTradeDate);
  const expired = daysToLastTrade < 0;
  const rollState = deriveMarketCalendarRollState({
    daysToLastTrade,
    rollWindowDays: input.contract.rollWindowDays,
    rollApproachDays: input.contract.rollApproachDays,
    expired,
  });
  const newExposureAllowed = !expired && rollState !== 'EXPIRED';
  return Object.freeze({
    contract: input.contract,
    at: input.at,
    daysToExpiration,
    daysToLastTrade,
    rollState,
    expired,
    newExposureAllowed,
  });
}

export function deriveMarketCalendarRollState(input: {
  readonly daysToLastTrade: number;
  readonly rollWindowDays: number;
  readonly rollApproachDays: number;
  readonly expired: boolean;
}): MarketCalendarRollState {
  if (input.expired || input.daysToLastTrade < 0) {
    return 'EXPIRED';
  }
  if (input.daysToLastTrade <= input.rollWindowDays) {
    return 'ROLL_REQUIRED';
  }
  if (input.daysToLastTrade <= input.rollApproachDays) {
    return 'ROLL_ELIGIBLE';
  }
  if (input.daysToLastTrade <= input.rollApproachDays + 5) {
    return 'APPROACHING_ROLL';
  }
  return 'NO_ROLL_REQUIRED';
}

export function resolveMarketCalendarFrontContract(input: {
  readonly rootSymbol: string;
  readonly at: UtcInstant;
  readonly registry: MarketCalendarRegistry;
}): FuturesContractDefinition | null {
  const calendarTimeZone =
    input.registry.listContractsForRoot(input.rootSymbol)[0] != null
      ? input.registry.getCalendar(input.registry.listContractsForRoot(input.rootSymbol)[0]!.calendarId)?.timeZone ?? 'UTC'
      : 'UTC';
  const asOfDate = localDateKey(input.at, calendarTimeZone);
  const active = input.registry
    .listContractsForRoot(input.rootSymbol)
    .filter((contract) => daysBetween(asOfDate, contract.lastTradeDate) >= 0)
    .sort((left, right) => left.lastTradeDate.localeCompare(right.lastTradeDate));
  return active[0] ?? null;
}

export function resolveMarketCalendarNextContract(input: {
  readonly rootSymbol: string;
  readonly at: UtcInstant;
  readonly registry: MarketCalendarRegistry;
}): FuturesContractDefinition | null {
  const calendarTimeZone =
    input.registry.listContractsForRoot(input.rootSymbol)[0] != null
      ? input.registry.getCalendar(input.registry.listContractsForRoot(input.rootSymbol)[0]!.calendarId)?.timeZone ?? 'UTC'
      : 'UTC';
  const asOfDate = localDateKey(input.at, calendarTimeZone);
  const active = input.registry
    .listContractsForRoot(input.rootSymbol)
    .filter((contract) => daysBetween(asOfDate, contract.lastTradeDate) >= 0)
    .sort((left, right) => left.lastTradeDate.localeCompare(right.lastTradeDate));
  return active[1] ?? null;
}
