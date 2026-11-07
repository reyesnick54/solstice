/**
 * Simulation fixtures for MD10 macro market reference fabric.
 */

import { asUtcInstant, type UtcInstant } from '@solstice/domain';
import { HELIOS_MD10_MACRO_MARKET_REFERENCE_SCHEMA } from './taxonomy.ts';
import type { MacroCommodityObservation, MacroFxObservation, MacroRateObservation, MacroMarketObservationProvenance } from './types.ts';

const RETRIEVED = asUtcInstant('2026-09-16T15:00:00.000Z');

function provenance(
  observationId: string,
  providerId: string,
  venueId: string | null,
  sourceTimestamp: UtcInstant,
): MacroMarketObservationProvenance {
  return Object.freeze({
    observationId,
    providerId,
    venueId,
    sourceTimestamp,
    retrievedAt: RETRIEVED,
  });
}

export function fixtureEurUsdContributorQuote(input: {
  readonly observationId: string;
  readonly providerId: string;
  readonly bidNumerator: bigint;
  readonly askNumerator: bigint;
  readonly denominator?: bigint;
  readonly observedAt?: UtcInstant;
}): MacroFxObservation {
  const denominator = input.denominator ?? 10_000n;
  const observedAt = input.observedAt ?? RETRIEVED;
  return Object.freeze({
    schema: HELIOS_MD10_MACRO_MARKET_REFERENCE_SCHEMA,
    domain: 'fx',
    kind: 'CONTRIBUTOR_QUOTE',
    baseCurrency: 'EUR',
    quoteCurrency: 'USD',
    tenor: 'SPOT',
    bid: Object.freeze({ numerator: input.bidNumerator, denominator }),
    ask: Object.freeze({ numerator: input.askNumerator, denominator }),
    provenance: provenance(input.observationId, input.providerId, null, observedAt),
    observedAt,
  });
}

export function fixtureEurUsdVenueQuote(input: {
  readonly observationId: string;
  readonly venueId: string;
  readonly providerId: string;
  readonly bidNumerator: bigint;
  readonly askNumerator: bigint;
}): MacroFxObservation {
  return Object.freeze({
    schema: HELIOS_MD10_MACRO_MARKET_REFERENCE_SCHEMA,
    domain: 'fx',
    kind: 'VENUE_QUOTE',
    baseCurrency: 'EUR',
    quoteCurrency: 'USD',
    tenor: 'SPOT',
    bid: Object.freeze({ numerator: input.bidNumerator, denominator: 10_000n }),
    ask: Object.freeze({ numerator: input.askNumerator, denominator: 10_000n }),
    provenance: provenance(input.observationId, input.providerId, input.venueId, RETRIEVED),
    observedAt: RETRIEVED,
  });
}

export function fixtureEurUsdFixing(observationId: string, rateNumerator: bigint): MacroFxObservation {
  return Object.freeze({
    schema: HELIOS_MD10_MACRO_MARKET_REFERENCE_SCHEMA,
    domain: 'fx',
    kind: 'REFERENCE_FIXING',
    baseCurrency: 'EUR',
    quoteCurrency: 'USD',
    tenor: 'FIX_1600',
    bid: Object.freeze({ numerator: rateNumerator, denominator: 10_000n }),
    ask: Object.freeze({ numerator: rateNumerator, denominator: 10_000n }),
    provenance: provenance(observationId, 'wmr_fixture', null, RETRIEVED),
    observedAt: RETRIEVED,
  });
}

export function fixtureUsPolicyRate(observationId: string, valueBps: number): MacroRateObservation {
  return Object.freeze({
    schema: HELIOS_MD10_MACRO_MARKET_REFERENCE_SCHEMA,
    domain: 'rates',
    kind: 'policy_rate',
    currency: 'USD',
    jurisdiction: 'US',
    tenorLabel: 'OVERNIGHT_TARGET',
    tenorYears: null,
    valueBps,
    licensedSwapReference: false,
    provenance: provenance(observationId, 'fred_fixture', null, RETRIEVED),
    observedAt: RETRIEVED,
  });
}

export function fixtureUsTenYearYield(observationId: string, valueBps: number): MacroRateObservation {
  return Object.freeze({
    schema: HELIOS_MD10_MACRO_MARKET_REFERENCE_SCHEMA,
    domain: 'rates',
    kind: 'government_yield',
    currency: 'USD',
    jurisdiction: 'US',
    tenorLabel: '10Y',
    tenorYears: 10,
    valueBps,
    licensedSwapReference: false,
    provenance: provenance(observationId, 'treasury_fixture', null, RETRIEVED),
    observedAt: RETRIEVED,
  });
}

export function fixtureWtiFutures(observationId: string, priceMinorUnits: bigint): MacroCommodityObservation {
  return Object.freeze({
    schema: HELIOS_MD10_MACRO_MARKET_REFERENCE_SCHEMA,
    domain: 'commodity',
    kind: 'futures',
    commodityCode: 'wti',
    currency: 'USD',
    unit: 'barrel',
    priceMinorUnits,
    priceScale: 2,
    contractMonth: '2026-12',
    venueId: 'NYMEX',
    provenance: provenance(observationId, 'nymex_fixture', 'NYMEX', RETRIEVED),
    observedAt: RETRIEVED,
  });
}

export function fixtureWtiPhysicalBenchmark(observationId: string, priceMinorUnits: bigint): MacroCommodityObservation {
  return Object.freeze({
    schema: HELIOS_MD10_MACRO_MARKET_REFERENCE_SCHEMA,
    domain: 'commodity',
    kind: 'physical_benchmark',
    commodityCode: 'wti',
    currency: 'USD',
    unit: 'barrel',
    priceMinorUnits,
    priceScale: 2,
    contractMonth: null,
    venueId: null,
    provenance: provenance(observationId, 'platts_fixture', null, RETRIEVED),
    observedAt: RETRIEVED,
  });
}

export const MD10_FIXTURE_EUR_USD_CONTRIBUTOR_QUOTES: readonly MacroFxObservation[] = Object.freeze([
  fixtureEurUsdContributorQuote({ observationId: 'fx:eurusd:c1', providerId: 'bank_a', bidNumerator: 108_50n, askNumerator: 108_52n }),
  fixtureEurUsdContributorQuote({ observationId: 'fx:eurusd:c2', providerId: 'bank_b', bidNumerator: 108_48n, askNumerator: 108_51n }),
  fixtureEurUsdContributorQuote({ observationId: 'fx:eurusd:c3', providerId: 'bank_c', bidNumerator: 108_49n, askNumerator: 108_53n }),
  fixtureEurUsdContributorQuote({ observationId: 'fx:eurusd:c4', providerId: 'bank_d', bidNumerator: 108_47n, askNumerator: 108_50n }),
  fixtureEurUsdContributorQuote({ observationId: 'fx:eurusd:outlier', providerId: 'bank_e', bidNumerator: 108_00n, askNumerator: 109_20n }),
]);
