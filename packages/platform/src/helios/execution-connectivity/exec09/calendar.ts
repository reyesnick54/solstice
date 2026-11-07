import type { MarketCalendarDefinition } from '../../multi-asset/market-calendar/types.ts';
import { localDateKey, localDateTimeParts } from '../../multi-asset/market-calendar/timezone.ts';
import type { LocalDateKey } from '../../multi-asset/market-calendar/types.ts';
import type { SettlementCalendarPort } from './types.ts';

function parseLocalDateKey(key: LocalDateKey): { readonly year: number; readonly month: number; readonly day: number } {
  const [year, month, day] = key.split('-').map((part) => Number(part));
  return Object.freeze({ year, month, day });
}

function formatLocalDateKey(year: number, month: number, day: number): LocalDateKey {
  const monthText = String(month).padStart(2, '0');
  const dayText = String(day).padStart(2, '0');
  return `${year}-${monthText}-${dayText}` as LocalDateKey;
}

function addCalendarDays(key: LocalDateKey, days: number): LocalDateKey {
  const parsed = parseLocalDateKey(key);
  const date = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day));
  date.setUTCDate(date.getUTCDate() + days);
  return formatLocalDateKey(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

export function createMarketSettlementCalendar(definition: MarketCalendarDefinition): SettlementCalendarPort {
  const holidayDates = new Set(definition.holidays.map((holiday) => holiday.date));
  return Object.freeze({
    calendarId: definition.calendarId,
    isBusinessDay: (date) => {
      if (holidayDates.has(date)) {
        const holiday = definition.holidays.find((item) => item.date === date);
        if (holiday?.closed !== false) {
          return false;
        }
      }
      const iso = `${date}T12:00:00.000Z`;
      const weekday = localDateTimeParts(iso, definition.timeZone).weekday;
      if (definition.weekendDays.includes(weekday) && definition.sessionMode !== 'TWENTY_FOUR_SEVEN') {
        return false;
      }
      return true;
    },
    addBusinessDays: (start, days) => {
      let cursor = start;
      let remaining = days;
      while (remaining > 0) {
        cursor = addCalendarDays(cursor, 1);
        if (holidayDates.has(cursor)) {
          const holiday = definition.holidays.find((item) => item.date === cursor);
          if (holiday?.closed !== false) {
            continue;
          }
        }
        const iso = `${cursor}T12:00:00.000Z`;
        const weekday = localDateTimeParts(iso, definition.timeZone).weekday;
        if (definition.weekendDays.includes(weekday) && definition.sessionMode !== 'TWENTY_FOUR_SEVEN') {
          continue;
        }
        remaining -= 1;
      }
      return cursor;
    },
  });
}

export function createCurrencySettlementCalendar(input: {
  readonly calendarId: string;
  readonly timeZone: string;
  readonly weekendDays: readonly number[];
  readonly holidays: readonly LocalDateKey[];
}): SettlementCalendarPort {
  const holidayDates = new Set(input.holidays);
  return Object.freeze({
    calendarId: input.calendarId,
    isBusinessDay: (date) => {
      if (holidayDates.has(date)) {
        return false;
      }
      const iso = `${date}T12:00:00.000Z`;
      const weekday = localDateTimeParts(iso, input.timeZone).weekday;
      if (input.weekendDays.includes(weekday)) {
        return false;
      }
      return true;
    },
    addBusinessDays: (start, days) => {
      let cursor = start;
      let remaining = days;
      while (remaining > 0) {
        cursor = addCalendarDays(cursor, 1);
        if (holidayDates.has(cursor)) {
          continue;
        }
        const iso = `${cursor}T12:00:00.000Z`;
        const weekday = localDateTimeParts(iso, input.timeZone).weekday;
        if (input.weekendDays.includes(weekday)) {
          continue;
        }
        remaining -= 1;
      }
      return cursor;
    },
  });
}

export function localDateFromInstant(at: string, timeZone: string): LocalDateKey {
  return localDateKey(at, timeZone);
}
