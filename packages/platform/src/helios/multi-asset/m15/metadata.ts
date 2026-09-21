/**
 * HELIOS M15 reference economic metadata for the engineering universe.
 *
 * Sector, factor, and benchmark tags are reference metadata only.
 * Missing metadata must not be fabricated at query time.
 */

import type { InstrumentEconomicMetadata } from './types.ts';

const REF = 'REFERENCE_ONLY' as const;
const SANDBOX = 'SANDBOX' as const;

function meta(input: InstrumentEconomicMetadata): InstrumentEconomicMetadata {
  return Object.freeze(input);
}

export const ENGINEERING_INSTRUMENT_ECONOMIC_METADATA: readonly InstrumentEconomicMetadata[] = Object.freeze([
  meta({
    instrumentId: 'SECURITY:US:NVDA:XNAS',
    sector: 'TECHNOLOGY',
    industry: 'SEMICONDUCTORS',
    factorTags: Object.freeze(['TECHNOLOGY', 'GROWTH', 'RISK_ON']),
    benchmarkInstrumentId: 'SECURITY:US:QQQ:XNAS',
    equityBetaToBenchmark: 1.35,
    volatilitySensitivity: 'HIGH',
    metadataAuthority: SANDBOX,
    sourceRefs: Object.freeze(['helios:m15:reference:nvda']),
  }),
  meta({
    instrumentId: 'SECURITY:US:SPY:ARCX',
    sector: 'BROAD_MARKET',
    industry: 'US_EQUITY_INDEX_ETF',
    factorTags: Object.freeze(['RISK_ON', 'USD']),
    benchmarkInstrumentId: null,
    equityBetaToBenchmark: 1.0,
    volatilitySensitivity: 'MEDIUM',
    metadataAuthority: SANDBOX,
    sourceRefs: Object.freeze(['helios:m15:reference:spy']),
  }),
  meta({
    instrumentId: 'SECURITY:US:QQQ:XNAS',
    sector: 'TECHNOLOGY',
    industry: 'NASDAQ_100_ETF',
    factorTags: Object.freeze(['TECHNOLOGY', 'GROWTH', 'RISK_ON']),
    benchmarkInstrumentId: 'INDEX:US:NDX:NDQ',
    equityBetaToBenchmark: 1.05,
    volatilitySensitivity: 'HIGH',
    metadataAuthority: SANDBOX,
    sourceRefs: Object.freeze(['helios:m15:reference:qqq']),
  }),
  meta({
    instrumentId: 'SECURITY:US:GLD:ARCX',
    sector: 'METALS',
    industry: 'GOLD_ETF',
    factorTags: Object.freeze(['METALS', 'DEFENSIVE', 'USD']),
    benchmarkInstrumentId: 'COMMODITY:GLOBAL:GOLD:XCEC',
    equityBetaToBenchmark: null,
    volatilitySensitivity: 'LOW',
    metadataAuthority: SANDBOX,
    sourceRefs: Object.freeze(['helios:m15:reference:gld']),
  }),
  meta({
    instrumentId: 'CRYPTO:GLOBAL:BTC:USD:SIM',
    sector: 'CRYPTO',
    industry: 'DIGITAL_ASSET',
    factorTags: Object.freeze(['CRYPTO', 'RISK_ON', 'USD']),
    benchmarkInstrumentId: null,
    equityBetaToBenchmark: null,
    volatilitySensitivity: 'HIGH',
    metadataAuthority: REF,
    sourceRefs: Object.freeze(['helios:m15:reference:btc']),
  }),
  meta({
    instrumentId: 'COMMODITY:GLOBAL:GOLD:XCEC',
    sector: 'METALS',
    industry: 'PRECIOUS_METALS',
    factorTags: Object.freeze(['METALS', 'DEFENSIVE', 'COMMODITY', 'USD']),
    benchmarkInstrumentId: null,
    equityBetaToBenchmark: null,
    volatilitySensitivity: 'LOW',
    metadataAuthority: REF,
    sourceRefs: Object.freeze(['helios:m15:reference:gold']),
  }),
  meta({
    instrumentId: 'COMMODITY:GLOBAL:WTI:XNYM',
    sector: 'ENERGY',
    industry: 'CRUDE_OIL',
    factorTags: Object.freeze(['ENERGY', 'COMMODITY', 'USD']),
    benchmarkInstrumentId: null,
    equityBetaToBenchmark: null,
    volatilitySensitivity: 'HIGH',
    metadataAuthority: REF,
    sourceRefs: Object.freeze(['helios:m15:reference:wti']),
  }),
  meta({
    instrumentId: 'FUTURE:GLOBAL:CL:XNYM:202612',
    sector: 'ENERGY',
    industry: 'CRUDE_OIL_FUTURE',
    factorTags: Object.freeze(['ENERGY', 'COMMODITY', 'USD']),
    benchmarkInstrumentId: 'COMMODITY:GLOBAL:WTI:XNYM',
    equityBetaToBenchmark: null,
    volatilitySensitivity: 'HIGH',
    metadataAuthority: REF,
    sourceRefs: Object.freeze(['helios:m15:reference:cl-future']),
  }),
  meta({
    instrumentId: 'FX:GLOBAL:EUR:USD:SIM',
    sector: 'FX',
    industry: 'MAJOR_FX_PAIR',
    factorTags: Object.freeze(['USD']),
    benchmarkInstrumentId: null,
    equityBetaToBenchmark: null,
    volatilitySensitivity: 'MEDIUM',
    metadataAuthority: REF,
    sourceRefs: Object.freeze(['helios:m15:reference:eurusd']),
  }),
  meta({
    instrumentId: 'FX:GLOBAL:USD:JPY:SIM',
    sector: 'FX',
    industry: 'MAJOR_FX_PAIR',
    factorTags: Object.freeze(['USD']),
    benchmarkInstrumentId: null,
    equityBetaToBenchmark: null,
    volatilitySensitivity: 'MEDIUM',
    metadataAuthority: REF,
    sourceRefs: Object.freeze(['helios:m15:reference:usdjpy']),
  }),
]);

export function resolveInstrumentEconomicMetadata(
  instrumentId: string,
  overrides?: Readonly<Record<string, InstrumentEconomicMetadata>>,
): InstrumentEconomicMetadata | undefined {
  return overrides?.[instrumentId] ?? ENGINEERING_INSTRUMENT_ECONOMIC_METADATA.find((row) => row.instrumentId === instrumentId);
}
