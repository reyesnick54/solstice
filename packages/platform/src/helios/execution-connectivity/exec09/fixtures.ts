import { asJurisdiction } from '@solstice/domain';
import { CRYPTO_24_7_CALENDAR, FX_WEEKDAY_CALENDAR, NYSE_EQUITY_CALENDAR } from '../../multi-asset/market-calendar/fixtures.ts';
import { createCurrencySettlementCalendar, createMarketSettlementCalendar } from './calendar.ts';
import type { SettlementCalendarPort, VersionedSettlementPolicy } from './types.ts';

export const DEFAULT_EXEC09_MARKET_CALENDARS: Readonly<Record<string, SettlementCalendarPort>> = Object.freeze({
  [NYSE_EQUITY_CALENDAR.calendarId]: createMarketSettlementCalendar(NYSE_EQUITY_CALENDAR),
  [CRYPTO_24_7_CALENDAR.calendarId]: createMarketSettlementCalendar(CRYPTO_24_7_CALENDAR),
  [FX_WEEKDAY_CALENDAR.calendarId]: createMarketSettlementCalendar(FX_WEEKDAY_CALENDAR),
});

export const USD_CURRENCY_CALENDAR = createCurrencySettlementCalendar({
  calendarId: 'usd_settlement_v1',
  timeZone: 'America/New_York',
  weekendDays: Object.freeze([0, 6]),
  holidays: Object.freeze([
    '2026-01-01',
    '2026-07-03',
    '2026-09-07',
    '2026-11-26',
    '2026-12-25',
  ]),
});

export const DEFAULT_EXEC09_CURRENCY_CALENDARS: Readonly<Record<string, SettlementCalendarPort>> = Object.freeze({
  usd_settlement_v1: USD_CURRENCY_CALENDAR,
});

export const DEFAULT_EXEC09_SETTLEMENT_POLICIES: readonly VersionedSettlementPolicy[] = Object.freeze([
  Object.freeze({
    policyId: 'us_equity_t1',
    version: '2026-01-01',
    market: 'NYSE',
    assetClass: 'EQUITY',
    jurisdiction: asJurisdiction('US'),
    effectiveFrom: '2025-01-01',
    effectiveTo: null,
    settlementLagBusinessDays: 1,
    marketCalendarId: NYSE_EQUITY_CALENDAR.calendarId,
    currencyCalendarId: 'usd_settlement_v1',
    dvpModel: 'LINKED_LEGS',
    providerSuppliesAtomicDvp: false,
  }),
  Object.freeze({
    policyId: 'us_etf_t1',
    version: '2026-01-01',
    market: 'NYSE',
    assetClass: 'ETF',
    jurisdiction: asJurisdiction('US'),
    effectiveFrom: '2025-01-01',
    effectiveTo: null,
    settlementLagBusinessDays: 1,
    marketCalendarId: NYSE_EQUITY_CALENDAR.calendarId,
    currencyCalendarId: 'usd_settlement_v1',
    dvpModel: 'LINKED_LEGS',
    providerSuppliesAtomicDvp: false,
  }),
  Object.freeze({
    policyId: 'us_equity_t2_legacy',
    version: '2020-01-01',
    market: 'NYSE',
    assetClass: 'EQUITY',
    jurisdiction: asJurisdiction('US'),
    effectiveFrom: '2020-01-01',
    effectiveTo: '2024-12-31',
    settlementLagBusinessDays: 2,
    marketCalendarId: NYSE_EQUITY_CALENDAR.calendarId,
    currencyCalendarId: 'usd_settlement_v1',
    dvpModel: 'LINKED_LEGS',
    providerSuppliesAtomicDvp: false,
  }),
  Object.freeze({
    policyId: 'crypto_t0',
    version: '2026-01-01',
    market: 'CRYPTO_GLOBAL',
    assetClass: 'CRYPTO',
    jurisdiction: asJurisdiction('US'),
    effectiveFrom: '2025-01-01',
    effectiveTo: null,
    settlementLagBusinessDays: 0,
    marketCalendarId: CRYPTO_24_7_CALENDAR.calendarId,
    currencyCalendarId: 'usd_settlement_v1',
    dvpModel: 'PROVIDER_ATOMIC',
    providerSuppliesAtomicDvp: true,
  }),
  Object.freeze({
    policyId: 'fx_spot_t2',
    version: '2026-01-01',
    market: 'FX',
    assetClass: 'FX',
    jurisdiction: asJurisdiction('US'),
    effectiveFrom: '2025-01-01',
    effectiveTo: null,
    settlementLagBusinessDays: 2,
    marketCalendarId: FX_WEEKDAY_CALENDAR.calendarId,
    currencyCalendarId: 'usd_settlement_v1',
    dvpModel: 'LINKED_LEGS',
    providerSuppliesAtomicDvp: false,
  }),
]);
