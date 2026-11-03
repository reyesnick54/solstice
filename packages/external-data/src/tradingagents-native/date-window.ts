/**
 * Point-in-time date/window discipline (native port of TradingAgents dataflows/date_window.py).
 * Historical runs must not reach vendors with dates after the decision date.
 */

import { asUtcInstant, type UtcInstant } from '../../../domain/src/time.ts';

export function toUtcMs(iso: string): number {
  return Date.parse(iso);
}

/** Half-open window [start, end + 1 day) in UTC. Undated items kept only when window reaches present. */
export function inWindow(
  pubIso: string | null | undefined,
  startIso: string,
  endIso: string,
  nowUtc: UtcInstant,
): boolean {
  const endMs = toUtcMs(endIso);
  const startMs = toUtcMs(startIso);
  const endExclusive = endMs + 86_400_000;
  if (pubIso != null && pubIso !== '') {
    const pubMs = toUtcMs(pubIso);
    return startMs <= pubMs && pubMs < endExclusive;
  }
  const nowMs = toUtcMs(nowUtc);
  return endMs >= nowMs - 86_400_000;
}

export function calendarDateUtc(nowUtc: UtcInstant): string {
  return nowUtc.slice(0, 10);
}

export function isHistoricalRun(tradeDate: string, nowUtc: UtcInstant): boolean {
  return Boolean(tradeDate) && tradeDate < calendarDateUtc(nowUtc);
}

function parseYmd(date: string | null | undefined): Date | null {
  if (date == null || date === '') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/** Model-requested date clamped to trade date (canonical YYYY-MM-DD). */
export function asOf(requested: string | null | undefined, tradeDate: string): string | null {
  const parsed = parseYmd(requested ?? null);
  if (!tradeDate) {
    return requested == null ? null : parsed ? formatYmd(parsed) : requested;
  }
  const trade = parseYmd(tradeDate);
  if (!trade) return tradeDate;
  if (parsed != null && parsed.getTime() <= trade.getTime()) {
    return formatYmd(parsed);
  }
  return tradeDate;
}

export function asOfWindow(
  startDate: string,
  endDate: string,
  tradeDate: string,
): readonly [string, string] {
  const start = parseYmd(startDate);
  if (!start) {
    throw new Error(`start_date ${JSON.stringify(startDate)} is not a date; give it as YYYY-MM-DD`);
  }
  const oldEnd = parseYmd(endDate);
  if (oldEnd != null && start.getTime() > oldEnd.getTime()) {
    throw new Error(`start_date ${startDate} is after end_date ${endDate}; give the earlier date first`);
  }
  const end = asOf(endDate, tradeDate);
  const endDt = parseYmd(end);
  if (endDt == null || oldEnd == null || endDt.getTime() === oldEnd.getTime() || start.getTime() <= endDt.getTime()) {
    return Object.freeze([formatYmd(start), end ?? tradeDate]);
  }
  const spanMs = oldEnd.getTime() - start.getTime();
  return Object.freeze([formatYmd(new Date(endDt.getTime() - spanMs)), end ?? tradeDate]);
}

export function withholdLiveProfile(asOfDate: string | null | undefined, label: string, nowUtc: UtcInstant): string | null {
  if (!isHistoricalRun(asOfDate ?? '', nowUtc)) return null;
  return (
    `# Company Fundamentals for ${label}\n` +
    `# Point-in-time as of: ${asOfDate}\n\n` +
    `Profile fundamentals are withheld for this date. Live-only vendor snapshots leak post-decision ` +
    `information. SEC EDGAR as-filed statements are served where filing dates are known.`
  );
}

export function filterKnowableByDecisionTime<T extends { readonly knowableAt: UtcInstant }>(
  rows: readonly T[],
  evaluationTimeUtc: UtcInstant,
): readonly T[] {
  const cutoff = toUtcMs(evaluationTimeUtc);
  return Object.freeze(rows.filter((row) => toUtcMs(row.knowableAt) <= cutoff));
}

function formatYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function evaluationInstantFromTradeDate(tradeDate: string): UtcInstant {
  return asUtcInstant(`${tradeDate}T23:59:59.000Z`);
}
