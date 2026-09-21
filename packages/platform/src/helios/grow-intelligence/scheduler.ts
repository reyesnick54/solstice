import type { UtcInstant } from '@solstice/domain';
import { localDateKey, localTimeMinutes } from '../multi-asset/market-calendar/timezone.ts';
import type { LocalDateKey } from '../multi-asset/market-calendar/types.ts';
import type { GrowReportType } from './taxonomy.ts';
import type { GrowNotificationPreferences } from './types.ts';

export const DEFAULT_MORNING_BRIEF_MINUTES = 7 * 60;
export const DEFAULT_EVENING_RECAP_MINUTES = 18 * 60;

export type GrowReportScheduleDecision = {
  readonly shouldGenerate: boolean;
  readonly shouldNotify: boolean;
  readonly reportingDate: LocalDateKey;
  readonly nowMinutes: number;
  readonly reason: string;
};

export function resolveReportingDate(now: UtcInstant, timeZone: string): LocalDateKey {
  return localDateKey(now, timeZone);
}

export function resolveNowMinutes(now: UtcInstant, timeZone: string): number {
  return localTimeMinutes(now, timeZone);
}

export function evaluateReportSchedule(input: {
  readonly reportType: GrowReportType;
  readonly now: UtcInstant;
  readonly prefs: GrowNotificationPreferences;
  readonly targetMinutes?: number;
  readonly alreadyGeneratedForDate?: boolean;
}): GrowReportScheduleDecision {
  const timeZone = input.prefs.timeZone;
  const reportingDate = resolveReportingDate(input.now, timeZone);
  const nowMinutes = resolveNowMinutes(input.now, timeZone);
  const targetMinutes =
    input.targetMinutes ??
    (input.reportType === 'MORNING_BRIEF' ? DEFAULT_MORNING_BRIEF_MINUTES : DEFAULT_EVENING_RECAP_MINUTES);

  const enabled =
    input.reportType === 'MORNING_BRIEF'
      ? input.prefs.morningBriefEnabled
      : input.prefs.eveningRecapEnabled;

  if (!enabled) {
    return Object.freeze({
      shouldGenerate: false,
      shouldNotify: false,
      reportingDate,
      nowMinutes,
      reason: 'notification_disabled',
    });
  }

  if (input.alreadyGeneratedForDate) {
    return Object.freeze({
      shouldGenerate: false,
      shouldNotify: false,
      reportingDate,
      nowMinutes,
      reason: 'already_generated',
    });
  }

  if (nowMinutes < targetMinutes) {
    return Object.freeze({
      shouldGenerate: false,
      shouldNotify: false,
      reportingDate,
      nowMinutes,
      reason: 'before_delivery_window',
    });
  }

  return Object.freeze({
    shouldGenerate: true,
    shouldNotify: true,
    reportingDate,
    nowMinutes,
    reason: 'due',
  });
}
