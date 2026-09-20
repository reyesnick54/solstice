import type { UtcInstant } from '@solstice/domain';
import type { MarketCalendarReasonCode, MarketState } from './taxonomy.ts';
import { isWithinWindow, localDateKey, localDateTimeParts, localTimeMinutes } from './timezone.ts';
import type {
  LocalDateKey,
  MarketCalendarDefinition,
  MarketHoliday,
  MarketSessionSnapshot,
  VenueSignal,
} from './types.ts';

function findHoliday(calendar: MarketCalendarDefinition, date: LocalDateKey): MarketHoliday | null {
  for (const holiday of calendar.holidays) {
    if (holiday.date === date) {
      return holiday;
    }
  }
  return null;
}

function maintenanceActive(calendar: MarketCalendarDefinition, at: UtcInstant): boolean {
  const weekday = localDateTimeParts(at, calendar.timeZone).weekday;
  const nowMinutes = localTimeMinutes(at, calendar.timeZone);
  for (const window of calendar.maintenanceWindows) {
    if (window.weekdays && !window.weekdays.includes(weekday)) {
      continue;
    }
    if (isWithinWindow({ nowMinutes, window })) {
      return true;
    }
  }
  return false;
}

function applyVenueSignals(input: {
  readonly baseState: MarketState;
  readonly baseReason: MarketCalendarReasonCode;
  readonly venueSignals: readonly VenueSignal[];
}): { readonly state: MarketState; readonly reasonCode: MarketCalendarReasonCode } {
  for (const signal of input.venueSignals) {
    if (signal.kind === 'AUTHORITATIVE_HALT' && signal.authoritative) {
      return Object.freeze({ state: 'HALTED', reasonCode: 'AUTHORITATIVE_HALT' });
    }
  }
  for (const signal of input.venueSignals) {
    if (signal.kind === 'MAINTENANCE' || signal.kind === 'PROVIDER_OUTAGE') {
      return Object.freeze({ state: 'MAINTENANCE', reasonCode: signal.kind === 'PROVIDER_OUTAGE' ? 'PROVIDER_OUTAGE' : 'MAINTENANCE_WINDOW' });
    }
  }
  for (const signal of input.venueSignals) {
    if (signal.kind === 'STALE_FEED') {
      return Object.freeze({ state: 'UNKNOWN', reasonCode: 'STALE_FEED' });
    }
    if (signal.kind === 'DEGRADED_VENUE') {
      return Object.freeze({ state: 'UNKNOWN', reasonCode: 'DEGRADED_VENUE' });
    }
    if (signal.kind === 'UNKNOWN_STATUS') {
      return Object.freeze({ state: 'UNKNOWN', reasonCode: 'UNKNOWN_STATUS' });
    }
  }
  return Object.freeze({ state: input.baseState, reasonCode: input.baseReason });
}

function resolveScheduledSession(input: {
  readonly calendar: MarketCalendarDefinition;
  readonly at: UtcInstant;
  readonly holiday: MarketHoliday | null;
  readonly weekend: boolean;
}): { readonly state: MarketState; readonly reasonCode: MarketCalendarReasonCode; readonly earlyClose: MarketHoliday['earlyClose'] | null } {
  const { calendar, at, holiday, weekend } = input;
  const nowMinutes = localTimeMinutes(at, calendar.timeZone);
  const earlyClose = holiday?.earlyClose ?? null;

  if (holiday?.closed) {
    return Object.freeze({ state: 'CLOSED', reasonCode: 'HOLIDAY', earlyClose: null });
  }
  if (weekend && calendar.sessionMode !== 'TWENTY_FOUR_SEVEN') {
    return Object.freeze({ state: 'CLOSED', reasonCode: 'WEEKEND', earlyClose: null });
  }

  const regularEnd = earlyClose ?? calendar.regularSession?.end ?? null;
  const regularWindow =
    calendar.regularSession && regularEnd
      ? Object.freeze({ start: calendar.regularSession.start, end: regularEnd })
      : calendar.regularSession;

  if (calendar.preMarketSession && isWithinWindow({ nowMinutes, window: calendar.preMarketSession })) {
    return Object.freeze({ state: 'PRE_MARKET', reasonCode: 'PRE_MARKET', earlyClose });
  }
  if (regularWindow && isWithinWindow({ nowMinutes, window: regularWindow })) {
    return Object.freeze({ state: 'OPEN', reasonCode: 'OK', earlyClose });
  }
  if (calendar.postMarketSession && isWithinWindow({ nowMinutes, window: calendar.postMarketSession })) {
    return Object.freeze({ state: 'POST_MARKET', reasonCode: 'POST_MARKET', earlyClose });
  }
  return Object.freeze({ state: 'CLOSED', reasonCode: 'OUTSIDE_SESSION', earlyClose });
}

function resolveTwentyThreeFiveSession(input: {
  readonly calendar: MarketCalendarDefinition;
  readonly at: UtcInstant;
}): { readonly state: MarketState; readonly reasonCode: MarketCalendarReasonCode } {
  const weekday = localDateTimeParts(input.at, input.calendar.timeZone).weekday;
  if (weekday === 6) {
    return Object.freeze({ state: 'CLOSED', reasonCode: 'WEEKEND' });
  }
  const nowMinutes = localTimeMinutes(input.at, input.calendar.timeZone);
  if (input.calendar.regularSession && isWithinWindow({ nowMinutes, window: input.calendar.regularSession })) {
    return Object.freeze({ state: 'OPEN', reasonCode: 'OK' });
  }
  return Object.freeze({ state: 'CLOSED', reasonCode: 'OUTSIDE_SESSION' });
}

function resolveFxWeekdaySession(input: {
  readonly calendar: MarketCalendarDefinition;
  readonly at: UtcInstant;
}): { readonly state: MarketState; readonly reasonCode: MarketCalendarReasonCode } {
  const weekday = localDateTimeParts(input.at, input.calendar.timeZone).weekday;
  if (weekday === 0 || weekday === 6) {
    return Object.freeze({ state: 'CLOSED', reasonCode: 'WEEKEND' });
  }
  const window = input.calendar.fxWeekdayOpen ?? input.calendar.regularSession;
  if (!window) {
    return Object.freeze({ state: 'UNKNOWN', reasonCode: 'UNKNOWN_CALENDAR' });
  }
  const nowMinutes = localTimeMinutes(input.at, input.calendar.timeZone);
  if (isWithinWindow({ nowMinutes, window })) {
    return Object.freeze({ state: 'OPEN', reasonCode: 'OK' });
  }
  return Object.freeze({ state: 'CLOSED', reasonCode: 'OUTSIDE_SESSION' });
}

export function resolveMarketSession(input: {
  readonly calendar: MarketCalendarDefinition | null;
  readonly at: UtcInstant;
  readonly venueSignals?: readonly VenueSignal[];
}): MarketSessionSnapshot {
  const venueSignals = Object.freeze([...(input.venueSignals ?? [])]);
  if (!input.calendar) {
    const applied = applyVenueSignals({
      baseState: 'UNKNOWN',
      baseReason: 'CALENDAR_MISSING',
      venueSignals,
    });
    return Object.freeze({
      calendarId: 'unknown',
      at: input.at,
      timeZone: 'UTC',
      localDate: '1970-01-01' as LocalDateKey,
      localTimeMinutes: 0,
      state: applied.state,
      reasonCode: applied.reasonCode,
      regularSession: null,
      preMarketSession: null,
      postMarketSession: null,
      earlyClose: null,
      maintenanceActive: false,
      venueSignals,
    });
  }

  const calendar = input.calendar;
  const localDate: LocalDateKey = localDateKey(input.at, calendar.timeZone);
  const weekday = localDateTimeParts(input.at, calendar.timeZone).weekday;
  const holiday = findHoliday(calendar, localDate);
  const weekend = calendar.weekendDays.includes(weekday);
  const maintenance = maintenanceActive(calendar, input.at);

  let baseState: MarketState;
  let baseReason: MarketCalendarReasonCode;
  let earlyClose: MarketHoliday['earlyClose'] | null = null;

  if (maintenance) {
    baseState = 'MAINTENANCE';
    baseReason = 'MAINTENANCE_WINDOW';
  } else if (calendar.sessionMode === 'TWENTY_FOUR_SEVEN') {
    baseState = 'OPEN';
    baseReason = 'OK';
  } else if (calendar.sessionMode === 'TWENTY_THREE_FIVE') {
    const resolved = resolveTwentyThreeFiveSession({ calendar, at: input.at });
    baseState = resolved.state;
    baseReason = resolved.reasonCode;
  } else if (calendar.sessionMode === 'FX_WEEKDAY') {
    const resolved = resolveFxWeekdaySession({ calendar, at: input.at });
    baseState = resolved.state;
    baseReason = resolved.reasonCode;
  } else {
    const resolved = resolveScheduledSession({ calendar, at: input.at, holiday, weekend });
    baseState = resolved.state;
    baseReason = resolved.reasonCode;
    earlyClose = resolved.earlyClose;
  }

  const applied = applyVenueSignals({ baseState, baseReason, venueSignals });

  const snapshot: MarketSessionSnapshot = Object.freeze({
    calendarId: calendar.calendarId,
    at: input.at,
    timeZone: calendar.timeZone,
    localDate,
    localTimeMinutes: localTimeMinutes(input.at, calendar.timeZone),
    state: applied.state,
    reasonCode: applied.reasonCode,
    regularSession: calendar.regularSession,
    preMarketSession: calendar.preMarketSession,
    postMarketSession: calendar.postMarketSession,
    earlyClose: earlyClose ?? null,
    maintenanceActive: maintenance,
    venueSignals,
  });
  return snapshot;
}

export function marketStatePermitsExecution(state: MarketState): boolean {
  return state === 'OPEN' || state === 'PRE_MARKET' || state === 'POST_MARKET';
}
