import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { LocalDateKey, LocalTimeOfDay } from './types.ts';

export type LocalDateTimeParts = {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
  readonly weekday: number;
};

const WEEKDAY: Record<string, number> = Object.freeze({
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
});

export function localDateTimeParts(at: UtcInstant, timeZone: string): LocalDateTimeParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'short',
    hourCycle: 'h23',
  }).formatToParts(new Date(Date.parse(at)));
  const lookup = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  return Object.freeze({
    year: Number(lookup.year),
    month: Number(lookup.month),
    day: Number(lookup.day),
    hour: Number(lookup.hour),
    minute: Number(lookup.minute),
    second: Number(lookup.second),
    weekday: WEEKDAY[lookup.weekday ?? 'Mon'] ?? 1,
  });
}

export function localDateKey(at: UtcInstant, timeZone: string): LocalDateKey {
  const parts = localDateTimeParts(at, timeZone);
  const month = String(parts.month).padStart(2, '0');
  const day = String(parts.day).padStart(2, '0');
  return `${parts.year}-${month}-${day}` as LocalDateKey;
}

export function localTimeMinutes(at: UtcInstant, timeZone: string): number {
  const parts = localDateTimeParts(at, timeZone);
  return parts.hour * 60 + parts.minute;
}

export function timeOfDayToMinutes(time: LocalTimeOfDay): number {
  return time.hour * 60 + time.minute;
}

export function isWithinWindow(input: {
  readonly nowMinutes: number;
  readonly window: { readonly start: LocalTimeOfDay; readonly end: LocalTimeOfDay };
}): boolean {
  const start = timeOfDayToMinutes(input.window.start);
  const end = timeOfDayToMinutes(input.window.end);
  if (start === end) {
    return true;
  }
  if (start < end) {
    return input.nowMinutes >= start && input.nowMinutes < end;
  }
  return input.nowMinutes >= start || input.nowMinutes < end;
}

export function daysBetween(fromDate: LocalDateKey, toDate: LocalDateKey): number {
  const from = Date.parse(`${fromDate}T00:00:00Z`);
  const to = Date.parse(`${toDate}T00:00:00Z`);
  return Math.round((to - from) / 86_400_000);
}

export function offsetLabel(at: UtcInstant, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'shortOffset',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(Date.parse(at)));
  const zone = parts.find((part) => part.type === 'timeZoneName')?.value ?? 'UTC';
  return zone;
}
