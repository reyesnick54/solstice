import type { EarningsCalendarEvent, EarningsIssuerProfile } from './types.ts';

export const EARN01_DOMAIN_MODULE = 'packages/platform/src/helios/earnings-intelligence/earn01-domain.ts' as const;

export function normalizeEarningsDomain(input: {
  readonly issuer: EarningsIssuerProfile;
  readonly calendar: readonly EarningsCalendarEvent[];
}): { readonly issuer: EarningsIssuerProfile; readonly calendar: readonly EarningsCalendarEvent[] } {
  const calendar = [...input.calendar].sort(
    (a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt),
  );
  return Object.freeze({ issuer: input.issuer, calendar: Object.freeze(calendar) });
}
