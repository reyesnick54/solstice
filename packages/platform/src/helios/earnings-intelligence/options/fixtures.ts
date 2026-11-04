import { asUtcInstant } from '@solstice/domain';
import {
  HELIOS_EARN07_OPTIONS_INTELLIGENCE_AUTHORITY,
  HELIOS_EARN07_OPTIONS_INTELLIGENCE_SCHEMA,
} from './taxonomy.ts';
import type { OptionChainSnapshot, OptionContractObservation } from './types.ts';

const SCHEMA = HELIOS_EARN07_OPTIONS_INTELLIGENCE_SCHEMA;

function quote(
  ref: string,
  symbol: string,
  midMinor: bigint,
  knowableAt: string,
): OptionContractObservation['quote'] {
  return Object.freeze({
    schema: SCHEMA,
    observationRef: ref,
    contractSymbol: symbol,
    bidMinor: midMinor - 5n,
    askMinor: midMinor + 5n,
    midMinor,
    quoteTime: asUtcInstant(knowableAt),
    knowableAt: asUtcInstant(knowableAt),
    source: Object.freeze({
      providerId: 'sandbox.options',
      capability: 'options_chain_research',
      observationRef: ref,
    }),
    grantsExecutionAuthority: false,
  });
}

function contract(input: {
  symbol: string;
  right: 'CALL' | 'PUT';
  strikeMinor: bigint;
  expirationDate: string;
  midMinor: bigint;
  ivBps: number;
  volume: bigint;
  oi: bigint;
  knowableAt: string;
  gammaBps?: number;
}): OptionContractObservation {
  const ref = `obs.${input.symbol}`;
  return Object.freeze({
    schema: SCHEMA,
    contractSymbol: input.symbol,
    underlyingInstrumentId: 'instrument.AAPL',
    right: input.right,
    strikeMinor: input.strikeMinor,
    expirationDate: input.expirationDate,
    quote: quote(ref, input.symbol, input.midMinor, input.knowableAt),
    volume: Object.freeze({
      schema: SCHEMA,
      observationRef: `${ref}.vol`,
      contractSymbol: input.symbol,
      volumeContracts: input.volume,
      sessionDate: input.knowableAt.slice(0, 10),
      asOf: asUtcInstant(input.knowableAt),
      knowableAt: asUtcInstant(input.knowableAt),
      source: Object.freeze({
        providerId: 'sandbox.options',
        capability: 'options_chain_research',
        observationRef: `${ref}.vol`,
      }),
      grantsExecutionAuthority: false,
    }),
    openInterest: Object.freeze({
      schema: SCHEMA,
      observationRef: `${ref}.oi`,
      contractSymbol: input.symbol,
      openInterestContracts: input.oi,
      asOf: asUtcInstant(input.knowableAt),
      knowableAt: asUtcInstant(input.knowableAt),
      source: Object.freeze({
        providerId: 'sandbox.options',
        capability: 'options_chain_research',
        observationRef: `${ref}.oi`,
      }),
      grantsExecutionAuthority: false,
    }),
    impliedVolatility: Object.freeze({
      schema: SCHEMA,
      observationRef: `${ref}.iv`,
      contractSymbol: input.symbol,
      impliedVolBps: input.ivBps,
      asOf: asUtcInstant(input.knowableAt),
      knowableAt: asUtcInstant(input.knowableAt),
      source: Object.freeze({
        providerId: 'sandbox.options',
        capability: 'options_chain_research',
        observationRef: `${ref}.iv`,
      }),
      grantsExecutionAuthority: false,
    }),
    greeks: Object.freeze({
      deltaBps: input.right === 'CALL' ? 5200 : -4800,
      gammaBps: input.gammaBps ?? 800,
      vegaBps: 1200,
      thetaBps: -900,
      vannaBps: null,
      volgaBps: null,
      charmBps: null,
    }),
    grantsExecutionAuthority: false,
  });
}

export function fixturePreEventOptionChainSnapshot(): OptionChainSnapshot {
  const knowableAt = '2026-01-15T20:00:00.000Z';
  const eventAt = '2026-01-16T21:00:00.000Z';
  const spotMinor = 180_0000n;
  const contracts = Object.freeze([
    contract({
      symbol: 'AAPL260117C00180000',
      right: 'CALL',
      strikeMinor: 180_0000n,
      expirationDate: '2026-01-17',
      midMinor: 350n,
      ivBps: 4200,
      volume: 12_000n,
      oi: 50_000n,
      knowableAt,
    }),
    contract({
      symbol: 'AAPL260117P00180000',
      right: 'PUT',
      strikeMinor: 180_0000n,
      expirationDate: '2026-01-17',
      midMinor: 340n,
      ivBps: 4100,
      volume: 9_000n,
      oi: 45_000n,
      knowableAt,
    }),
    contract({
      symbol: 'AAPL260124C00185000',
      right: 'CALL',
      strikeMinor: 185_0000n,
      expirationDate: '2026-01-24',
      midMinor: 280n,
      ivBps: 3800,
      volume: 4_000n,
      oi: 20_000n,
      knowableAt,
    }),
    contract({
      symbol: 'AAPL260124P00175000',
      right: 'PUT',
      strikeMinor: 175_0000n,
      expirationDate: '2026-01-24',
      midMinor: 260n,
      ivBps: 3900,
      volume: 3_500n,
      oi: 18_000n,
      knowableAt,
    }),
  ]);
  return Object.freeze({
    schema: SCHEMA,
    authority: HELIOS_EARN07_OPTIONS_INTELLIGENCE_AUTHORITY,
    snapshotId: 'snap.earn07.fixture.1',
    underlyingInstrumentId: 'instrument.AAPL',
    underlyingSpotMinor: spotMinor,
    chainTimestamp: asUtcInstant(knowableAt),
    knowableAt: asUtcInstant(knowableAt),
    earningsEventId: 'earnings.AAPL.2026Q1',
    eventScheduledAt: asUtcInstant(eventAt),
    contracts,
    aafCertification: Object.freeze({
      certified: true,
      providerId: 'sandbox.options',
      certifiedAt: asUtcInstant(knowableAt),
      evidenceRef: 'evidence.aaf07.sandbox.options',
      aafProgram: 'AAF07_EXTERNAL_MARKET_DATA',
    }),
    grantsExecutionAuthority: false,
  });
}

export const FIXTURE_HISTORICAL_IV = Object.freeze([
  { asOf: asUtcInstant('2025-10-01T20:00:00.000Z'), atmIvBps: 3000 },
  { asOf: asUtcInstant('2025-11-01T20:00:00.000Z'), atmIvBps: 3500 },
  { asOf: asUtcInstant('2025-12-01T20:00:00.000Z'), atmIvBps: 4000 },
]);
