import type {
  ContinuousSeriesDefinition,
  FuturesContractDefinition,
  InstrumentMarketBinding,
  MarketCalendarDefinition,
  MarketCalendarRegistry,
} from './types.ts';
import {
  CONTINUOUS_SERIES,
  DEFAULT_HELIOS_MARKET_CALENDARS,
  GOLD_CONTRACTS,
  WTI_CONTRACTS,
} from './fixtures.ts';

const DEFAULT_INSTRUMENT_BINDINGS: readonly InstrumentMarketBinding[] = Object.freeze([
  Object.freeze({
    instrumentId: 'SECURITY:US:AAPL:XNAS',
    kind: 'EQUITY',
    calendarId: 'cal_nyse_equity',
    contractId: null,
    continuousSeriesId: null,
    rootSymbol: 'AAPL',
  }),
  Object.freeze({
    instrumentId: 'SECURITY:US:SPY:ARCX',
    kind: 'ETF',
    calendarId: 'cal_nyse_equity',
    contractId: null,
    continuousSeriesId: null,
    rootSymbol: 'SPY',
  }),
  Object.freeze({
    instrumentId: 'CRYPTO:BTC:USD',
    kind: 'CRYPTO',
    calendarId: 'cal_crypto_24_7',
    contractId: null,
    continuousSeriesId: null,
    rootSymbol: 'BTC',
  }),
  Object.freeze({
    instrumentId: 'CRYPTO:ETH:USD',
    kind: 'CRYPTO',
    calendarId: 'cal_crypto_24_7',
    contractId: null,
    continuousSeriesId: null,
    rootSymbol: 'ETH',
  }),
  Object.freeze({
    instrumentId: 'FUT:CL:2026-10',
    kind: 'FUTURES',
    calendarId: 'cal_cme_cl_futures',
    contractId: 'FUT:CL:2026-10',
    continuousSeriesId: null,
    rootSymbol: 'CL',
  }),
  Object.freeze({
    instrumentId: 'FUT:CL:2026-11',
    kind: 'FUTURES',
    calendarId: 'cal_cme_cl_futures',
    contractId: 'FUT:CL:2026-11',
    continuousSeriesId: null,
    rootSymbol: 'CL',
  }),
  Object.freeze({
    instrumentId: 'FUT:GC:2026-12',
    kind: 'COMMODITY_FUTURES',
    calendarId: 'cal_cme_cl_futures',
    contractId: 'FUT:GC:2026-12',
    continuousSeriesId: null,
    rootSymbol: 'GC',
  }),
  Object.freeze({
    instrumentId: 'FX:EURUSD',
    kind: 'FX',
    calendarId: 'cal_fx_weekday',
    contractId: null,
    continuousSeriesId: null,
    rootSymbol: 'EURUSD',
  }),
  Object.freeze({
    instrumentId: 'CONT:CL:FRONT',
    kind: 'CONTINUOUS_RESEARCH',
    calendarId: 'cal_cme_cl_futures',
    contractId: null,
    continuousSeriesId: 'CONT:CL:FRONT',
    rootSymbol: 'CL',
  }),
  Object.freeze({
    instrumentId: 'CONT:GC:FRONT',
    kind: 'CONTINUOUS_RESEARCH',
    calendarId: 'cal_cme_cl_futures',
    contractId: null,
    continuousSeriesId: 'CONT:GC:FRONT',
    rootSymbol: 'GC',
  }),
]);

export function createMarketCalendarRegistry(input?: {
  readonly calendars?: readonly MarketCalendarDefinition[];
  readonly contracts?: readonly FuturesContractDefinition[];
  readonly continuousSeries?: readonly ContinuousSeriesDefinition[];
  readonly instruments?: readonly InstrumentMarketBinding[];
}): MarketCalendarRegistry {
  const calendars = new Map((input?.calendars ?? DEFAULT_HELIOS_MARKET_CALENDARS).map((row) => [row.calendarId, row]));
  const contractRows = input?.contracts ?? Object.freeze([...WTI_CONTRACTS, ...GOLD_CONTRACTS]);
  const contracts = new Map(contractRows.map((row) => [row.contractId, row]));
  const continuous = new Map((input?.continuousSeries ?? CONTINUOUS_SERIES).map((row) => [row.seriesId, row]));
  const instruments = new Map((input?.instruments ?? DEFAULT_INSTRUMENT_BINDINGS).map((row) => [row.instrumentId, row]));

  return Object.freeze({
    getCalendar(calendarId: string) {
      return calendars.get(calendarId) ?? null;
    },
    getContract(contractId: string) {
      return contracts.get(contractId) ?? null;
    },
    getContinuousSeries(seriesId: string) {
      return continuous.get(seriesId) ?? null;
    },
    getInstrumentBinding(instrumentId: string) {
      return instruments.get(instrumentId) ?? null;
    },
    listContractsForRoot(rootSymbol: string) {
      return Object.freeze([...contracts.values()].filter((row) => row.rootSymbol === rootSymbol));
    },
  });
}
