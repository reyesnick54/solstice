import type { MarketCalendarDefinition, ContinuousSeriesDefinition, FuturesContractDefinition } from './types.ts';

export const NYSE_EQUITY_CALENDAR: MarketCalendarDefinition = Object.freeze({
  calendarId: 'cal_nyse_equity',
  displayName: 'NYSE Regular + Extended',
  timeZone: 'America/New_York',
  sessionMode: 'PRE_POST_EXTENDED',
  regularSession: Object.freeze({ start: Object.freeze({ hour: 9, minute: 30 }), end: Object.freeze({ hour: 16, minute: 0 }) }),
  preMarketSession: Object.freeze({ start: Object.freeze({ hour: 4, minute: 0 }), end: Object.freeze({ hour: 9, minute: 30 }) }),
  postMarketSession: Object.freeze({ start: Object.freeze({ hour: 16, minute: 0 }), end: Object.freeze({ hour: 20, minute: 0 }) }),
  weekendDays: Object.freeze([0, 6]),
  holidays: Object.freeze([
    Object.freeze({ date: '2026-01-01', name: 'New Year', closed: true }),
    Object.freeze({ date: '2026-07-03', name: 'Independence Day Observed', closed: true }),
  ]),
  maintenanceWindows: Object.freeze([]),
});

export const CRYPTO_24_7_CALENDAR: MarketCalendarDefinition = Object.freeze({
  calendarId: 'cal_crypto_24_7',
  displayName: 'Crypto 24/7',
  timeZone: 'UTC',
  sessionMode: 'TWENTY_FOUR_SEVEN',
  regularSession: null,
  preMarketSession: null,
  postMarketSession: null,
  weekendDays: Object.freeze([]),
  holidays: Object.freeze([]),
  maintenanceWindows: Object.freeze([
    Object.freeze({
      start: Object.freeze({ hour: 2, minute: 0 }),
      end: Object.freeze({ hour: 2, minute: 30 }),
      weekdays: Object.freeze([0, 1, 2, 3, 4, 5, 6]),
    }),
  ]),
});

export const CME_CL_FUTURES_CALENDAR: MarketCalendarDefinition = Object.freeze({
  calendarId: 'cal_cme_cl_futures',
  displayName: 'CME WTI 23/5',
  timeZone: 'America/New_York',
  sessionMode: 'TWENTY_THREE_FIVE',
  regularSession: Object.freeze({ start: Object.freeze({ hour: 18, minute: 0 }), end: Object.freeze({ hour: 17, minute: 0 }) }),
  preMarketSession: null,
  postMarketSession: null,
  weekendDays: Object.freeze([6]),
  holidays: Object.freeze([]),
  maintenanceWindows: Object.freeze([
    Object.freeze({
      start: Object.freeze({ hour: 17, minute: 0 }),
      end: Object.freeze({ hour: 18, minute: 0 }),
      weekdays: Object.freeze([0, 1, 2, 3, 4, 5]),
    }),
  ]),
});

export const FX_WEEKDAY_CALENDAR: MarketCalendarDefinition = Object.freeze({
  calendarId: 'cal_fx_weekday',
  displayName: 'FX Weekday',
  timeZone: 'America/New_York',
  sessionMode: 'FX_WEEKDAY',
  regularSession: Object.freeze({ start: Object.freeze({ hour: 17, minute: 0 }), end: Object.freeze({ hour: 17, minute: 0 }) }),
  preMarketSession: null,
  postMarketSession: null,
  weekendDays: Object.freeze([0, 6]),
  holidays: Object.freeze([]),
  maintenanceWindows: Object.freeze([]),
  fxWeekdayOpen: Object.freeze({ start: Object.freeze({ hour: 17, minute: 0 }), end: Object.freeze({ hour: 17, minute: 0 }) }),
});

export const WTI_CONTRACTS: readonly FuturesContractDefinition[] = Object.freeze([
  Object.freeze({
    contractId: 'FUT:CL:2026-10',
    rootSymbol: 'CL',
    contractMonth: '2026-10',
    underlying: 'WTI Crude Oil',
    multiplier: 1000,
    settlementType: 'PHYSICAL',
    expirationDate: '2026-09-22',
    lastTradeDate: '2026-09-20',
    firstNoticeDate: '2026-08-21',
    calendarId: 'cal_cme_cl_futures',
    rollWindowDays: 5,
    rollApproachDays: 10,
  }),
  Object.freeze({
    contractId: 'FUT:CL:2026-11',
    rootSymbol: 'CL',
    contractMonth: '2026-11',
    underlying: 'WTI Crude Oil',
    multiplier: 1000,
    settlementType: 'PHYSICAL',
    expirationDate: '2026-10-20',
    lastTradeDate: '2026-10-16',
    firstNoticeDate: '2026-09-22',
    calendarId: 'cal_cme_cl_futures',
    rollWindowDays: 5,
    rollApproachDays: 10,
  }),
  Object.freeze({
    contractId: 'FUT:CL:2026-12',
    rootSymbol: 'CL',
    contractMonth: '2026-12',
    underlying: 'WTI Crude Oil',
    multiplier: 1000,
    settlementType: 'PHYSICAL',
    expirationDate: '2026-11-19',
    lastTradeDate: '2026-11-17',
    firstNoticeDate: '2026-10-20',
    calendarId: 'cal_cme_cl_futures',
    rollWindowDays: 5,
    rollApproachDays: 10,
  }),
]);

export const GOLD_CONTRACTS: readonly FuturesContractDefinition[] = Object.freeze([
  Object.freeze({
    contractId: 'FUT:GC:2026-12',
    rootSymbol: 'GC',
    contractMonth: '2026-12',
    underlying: 'Gold',
    multiplier: 100,
    settlementType: 'PHYSICAL',
    expirationDate: '2026-11-26',
    lastTradeDate: '2026-11-24',
    firstNoticeDate: null,
    calendarId: 'cal_cme_cl_futures',
    rollWindowDays: 5,
    rollApproachDays: 10,
  }),
]);

export const CONTINUOUS_SERIES: readonly ContinuousSeriesDefinition[] = Object.freeze([
  Object.freeze({
    seriesId: 'CONT:CL:FRONT',
    rootSymbol: 'CL',
    displayName: 'WTI Continuous Research',
    underlying: 'WTI Crude Oil',
    rollMethod: 'FRONT_MONTH',
    executable: false,
  }),
  Object.freeze({
    seriesId: 'CONT:GC:FRONT',
    rootSymbol: 'GC',
    displayName: 'Gold Continuous Research',
    underlying: 'Gold',
    rollMethod: 'FRONT_MONTH',
    executable: false,
  }),
]);

export const DEFAULT_HELIOS_MARKET_CALENDARS: readonly MarketCalendarDefinition[] = Object.freeze([
  NYSE_EQUITY_CALENDAR,
  CRYPTO_24_7_CALENDAR,
  CME_CL_FUTURES_CALENDAR,
  FX_WEEKDAY_CALENDAR,
]);
