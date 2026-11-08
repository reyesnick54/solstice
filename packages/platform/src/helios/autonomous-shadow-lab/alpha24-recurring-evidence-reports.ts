/**
 * ALPHA24 — recurring daily and weekly shadow evidence reports.
 */

export const HELIOS_ALPHA24_RECURRING_EVIDENCE_REPORTS =
  'HELIOS_ALPHA24_RECURRING_EVIDENCE_REPORTS' as const;

export function reportCadenceIds(dailyId: string, weeklyId: string): { readonly daily: string; readonly weekly: string } {
  return Object.freeze({ daily: dailyId, weekly: weeklyId });
}
