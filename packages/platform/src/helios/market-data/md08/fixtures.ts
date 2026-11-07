import { asUtcInstant } from '@solstice/domain';
import type { OrderBookSnapshot } from '../../market-observation/types.ts';
import {
  HELIOS_MD08_DERIVATIVES_AUTHORITY,
  HELIOS_MD08_DERIVATIVES_SCHEMA,
} from './taxonomy.ts';
import { observedOptionQuote } from './build.ts';
import type {
  Md08DerivativeTradeObservation,
  Md08FuturesContractState,
  Md08FuturesLifecycle,
  Md08OpenInterestObservation,
  Md08OptionContractState,
  Md08SettlementObservation,
} from './types.ts';

export const MD08_FIXTURE_EVAL_TIME = asUtcInstant('2026-09-15T18:00:00.000Z');

const OBSERVED = Object.freeze({
  kind: 'OBSERVED' as const,
  sourceId: 'helios.md08.cme-simulation-fixture',
  observationRef: 'fixture',
  modelId: null,
  notExchangeObserved: false,
});

function book(midMinor: bigint, at: typeof MD08_FIXTURE_EVAL_TIME): OrderBookSnapshot {
  const tick = 25n;
  return Object.freeze({
    bids: Object.freeze([
      Object.freeze({ priceMinorUnits: midMinor - tick, quantityMinorUnits: 10n, depth: 1 }),
      Object.freeze({ priceMinorUnits: midMinor - tick * 2n, quantityMinorUnits: 20n, depth: 2 }),
    ]),
    asks: Object.freeze([
      Object.freeze({ priceMinorUnits: midMinor + tick, quantityMinorUnits: 12n, depth: 1 }),
      Object.freeze({ priceMinorUnits: midMinor + tick * 2n, quantityMinorUnits: 18n, depth: 2 }),
    ]),
    sequence: 100n,
    version: 'fixture-v1',
    sourceTimestamp: at,
    arrivalTimestamp: at,
    providerSupportsOrderBook: true,
  });
}

function lifecycle(partial: Omit<Md08FuturesLifecycle, 'contractMultiplierMinor' | 'multiplierScale'> & {
  readonly multiplierMinor: bigint;
}): Md08FuturesLifecycle {
  return Object.freeze({
    expiry: partial.expiry,
    lastTradeDate: partial.lastTradeDate,
    firstNoticeDate: partial.firstNoticeDate,
    deliveryDate: partial.deliveryDate,
    rollState: partial.rollState,
    contractMultiplierMinor: partial.multiplierMinor,
    multiplierScale: 1,
  });
}

export const MD08_ESZ2026_ID = 'FUTURE:US:ES:XCME:202612' as const;
export const MD08_ESH2027_ID = 'FUTURE:US:ES:XCME:202703' as const;
export const MD08_CLZ2026_ID = 'FUTURE:US:CL:XCME:202612' as const;

export const MD08_ES_UNDERLYING_ID = 'INDEX:US:SPX:REFERENCE' as const;

export const MD08_FIXTURE_FUTURES: readonly Md08FuturesContractState[] = Object.freeze([
  Object.freeze({
    schema: HELIOS_MD08_DERIVATIVES_SCHEMA,
    authority: HELIOS_MD08_DERIVATIVES_AUTHORITY,
    instrumentId: MD08_ESZ2026_ID,
    rootSymbol: 'ES',
    book: book(5_525_000n, MD08_FIXTURE_EVAL_TIME),
    trades: Object.freeze<Md08DerivativeTradeObservation[]>([
      Object.freeze({
        tradeId: 'es-tr-1',
        priceMinor: 5_524_750n,
        quantity: 2n,
        tradedAt: MD08_FIXTURE_EVAL_TIME,
        knowableAt: MD08_FIXTURE_EVAL_TIME,
        provenance: OBSERVED,
      }),
    ]),
    settlement: Object.freeze<Md08SettlementObservation>({
      schema: HELIOS_MD08_DERIVATIVES_SCHEMA,
      settlementId: 'es-settle-20260914',
      instrumentId: MD08_ESZ2026_ID,
      settlementMinor: 5_520_000n,
      settlementDate: '2026-09-14',
      asOf: MD08_FIXTURE_EVAL_TIME,
      knowableAt: MD08_FIXTURE_EVAL_TIME,
      provenance: OBSERVED,
      grantsExecutionAuthority: false,
    }),
    openInterest: Object.freeze<Md08OpenInterestObservation>({
      schema: HELIOS_MD08_DERIVATIVES_SCHEMA,
      instrumentId: MD08_ESZ2026_ID,
      openInterestContracts: 2_450_000n,
      asOf: MD08_FIXTURE_EVAL_TIME,
      knowableAt: MD08_FIXTURE_EVAL_TIME,
      provenance: OBSERVED,
      grantsExecutionAuthority: false,
    }),
    sessionVolume: 1_280_000n,
    sessionState: 'OPEN',
    lifecycle: lifecycle({
      expiry: asUtcInstant('2026-12-18T21:00:00.000Z'),
      lastTradeDate: asUtcInstant('2026-12-18T21:00:00.000Z'),
      firstNoticeDate: null,
      deliveryDate: null,
      rollState: 'FRONT',
      multiplierMinor: 50_000n,
    }),
    evaluatedAt: MD08_FIXTURE_EVAL_TIME,
    grantsExecutionAuthority: false,
  }),
  Object.freeze({
    schema: HELIOS_MD08_DERIVATIVES_SCHEMA,
    authority: HELIOS_MD08_DERIVATIVES_AUTHORITY,
    instrumentId: MD08_ESH2027_ID,
    rootSymbol: 'ES',
    book: book(5_538_000n, MD08_FIXTURE_EVAL_TIME),
    trades: Object.freeze([]),
    settlement: null,
    openInterest: Object.freeze({
      schema: HELIOS_MD08_DERIVATIVES_SCHEMA,
      instrumentId: MD08_ESH2027_ID,
      openInterestContracts: 480_000n,
      asOf: MD08_FIXTURE_EVAL_TIME,
      knowableAt: MD08_FIXTURE_EVAL_TIME,
      provenance: OBSERVED,
      grantsExecutionAuthority: false,
    }),
    sessionVolume: 210_000n,
    sessionState: 'OPEN',
    lifecycle: lifecycle({
      expiry: asUtcInstant('2027-03-19T21:00:00.000Z'),
      lastTradeDate: asUtcInstant('2027-03-19T21:00:00.000Z'),
      firstNoticeDate: null,
      deliveryDate: null,
      rollState: 'BACK',
      multiplierMinor: 50_000n,
    }),
    evaluatedAt: MD08_FIXTURE_EVAL_TIME,
    grantsExecutionAuthority: false,
  }),
  Object.freeze({
    schema: HELIOS_MD08_DERIVATIVES_SCHEMA,
    authority: HELIOS_MD08_DERIVATIVES_AUTHORITY,
    instrumentId: MD08_CLZ2026_ID,
    rootSymbol: 'CL',
    book: book(72_500_000n, MD08_FIXTURE_EVAL_TIME),
    trades: Object.freeze([]),
    settlement: Object.freeze({
      schema: HELIOS_MD08_DERIVATIVES_SCHEMA,
      settlementId: 'cl-settle',
      instrumentId: MD08_CLZ2026_ID,
      settlementMinor: 72_450_000n,
      settlementDate: '2026-09-14',
      asOf: MD08_FIXTURE_EVAL_TIME,
      knowableAt: MD08_FIXTURE_EVAL_TIME,
      provenance: OBSERVED,
      grantsExecutionAuthority: false,
    }),
    openInterest: Object.freeze({
      schema: HELIOS_MD08_DERIVATIVES_SCHEMA,
      instrumentId: MD08_CLZ2026_ID,
      openInterestContracts: 890_000n,
      asOf: MD08_FIXTURE_EVAL_TIME,
      knowableAt: MD08_FIXTURE_EVAL_TIME,
      provenance: OBSERVED,
      grantsExecutionAuthority: false,
    }),
    sessionVolume: 95_000n,
    sessionState: 'OPEN',
    lifecycle: lifecycle({
      expiry: asUtcInstant('2026-12-18T21:00:00.000Z'),
      lastTradeDate: asUtcInstant('2026-11-20T21:00:00.000Z'),
      firstNoticeDate: asUtcInstant('2026-11-24T21:00:00.000Z'),
      deliveryDate: asUtcInstant('2026-12-31T21:00:00.000Z'),
      rollState: 'FRONT',
      multiplierMinor: 1_000n,
    }),
    evaluatedAt: MD08_FIXTURE_EVAL_TIME,
    grantsExecutionAuthority: false,
  }),
]);

export const MD08_FIXTURE_OPTIONS: readonly Md08OptionContractState[] = Object.freeze([
  Object.freeze({
    schema: HELIOS_MD08_DERIVATIVES_SCHEMA,
    authority: HELIOS_MD08_DERIVATIVES_AUTHORITY,
    instrumentId: 'OPTION:US:ES:XCME:202612:C:5500',
    underlyingInstrumentId: MD08_ES_UNDERLYING_ID,
    right: 'CALL',
    strikeMinor: 5_500_000n,
    expiry: asUtcInstant('2026-12-18T21:00:00.000Z'),
    exerciseStyle: 'EUROPEAN',
    quote: observedOptionQuote({
      bidMinor: 112_500n,
      askMinor: 115_000n,
      lastTradeMinor: 113_750n,
      observationRef: 'es-call-5500',
    }),
    volumeContracts: 18_500n,
    openInterest: Object.freeze({
      schema: HELIOS_MD08_DERIVATIVES_SCHEMA,
      instrumentId: 'OPTION:US:ES:XCME:202612:C:5500',
      openInterestContracts: 220_000n,
      asOf: MD08_FIXTURE_EVAL_TIME,
      knowableAt: MD08_FIXTURE_EVAL_TIME,
      provenance: OBSERVED,
      grantsExecutionAuthority: false,
    }),
    exchangeImpliedVolBps: null,
    exchangeIvProvenance: null,
    derivedImpliedVolatility: null,
    researchGreeks: null,
    evaluatedAt: MD08_FIXTURE_EVAL_TIME,
    grantsExecutionAuthority: false,
  }),
  Object.freeze({
    schema: HELIOS_MD08_DERIVATIVES_SCHEMA,
    authority: HELIOS_MD08_DERIVATIVES_AUTHORITY,
    instrumentId: 'OPTION:US:ES:XCME:202612:P:5400',
    underlyingInstrumentId: MD08_ES_UNDERLYING_ID,
    right: 'PUT',
    strikeMinor: 5_400_000n,
    expiry: asUtcInstant('2026-12-18T21:00:00.000Z'),
    exerciseStyle: 'AMERICAN',
    quote: observedOptionQuote({
      bidMinor: 48_000n,
      askMinor: 50_500n,
      lastTradeMinor: 49_250n,
      observationRef: 'es-put-5400',
    }),
    volumeContracts: 9_200n,
    openInterest: Object.freeze({
      schema: HELIOS_MD08_DERIVATIVES_SCHEMA,
      instrumentId: 'OPTION:US:ES:XCME:202612:P:5400',
      openInterestContracts: 145_000n,
      asOf: MD08_FIXTURE_EVAL_TIME,
      knowableAt: MD08_FIXTURE_EVAL_TIME,
      provenance: OBSERVED,
      grantsExecutionAuthority: false,
    }),
    exchangeImpliedVolBps: 1_420,
    exchangeIvProvenance: OBSERVED,
    derivedImpliedVolatility: null,
    researchGreeks: null,
    evaluatedAt: MD08_FIXTURE_EVAL_TIME,
    grantsExecutionAuthority: false,
  }),
]);

export const MD08_FIXTURE_UNDERLYING_SPOT = Object.freeze({
  [MD08_ES_UNDERLYING_ID]: 5_518_000n,
});
