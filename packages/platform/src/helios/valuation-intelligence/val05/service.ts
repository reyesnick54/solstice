import type { UtcInstant } from '@solstice/domain';

import {
  HELIOS_VALUATION_INTELLIGENCE_AUTHORITY,
  HELIOS_VALUATION_INTELLIGENCE_SCHEMA,
  VAL05_REVERSE_DCF_MODULE,
} from '../taxonomy.ts';
import { computeExpectationGap } from './gap.ts';
import { buildPriceLevelScenarios } from './scenarios.ts';
import { buildMarketImpliedExpectationSurface } from './surface.ts';
import type {
  HeliosProbabilisticExpectations,
  Val05CapitalStructure,
  Val05DiscountRateDistribution,
  Val05MarketPriceInput,
  Val05OperatingEconomics,
  Val05ReverseDcfArtifact,
} from './types.ts';

export function buildHeliosProbabilisticExpectations(input: {
  readonly entityId: string;
  readonly asOf: UtcInstant;
  readonly operatingEconomics: Val05OperatingEconomics;
  readonly revenueCagr: { readonly p10: number; readonly p50: number; readonly p90: number };
  readonly terminalGrowth: { readonly p10: number; readonly p50: number; readonly p90: number };
}): HeliosProbabilisticExpectations {
  const econ = input.operatingEconomics;
  const spread = (base: number, delta: number) =>
    Object.freeze({ p10: base - delta, p50: base, p90: base + delta });

  return Object.freeze({
    schema: HELIOS_VALUATION_INTELLIGENCE_SCHEMA,
    module: 'HELIOS_PROBABILISTIC_EXPECTATIONS',
    entityId: input.entityId,
    asOf: input.asOf,
    revenueCagr: Object.freeze(input.revenueCagr),
    operatingMargin: spread(econ.operatingMarginBps, 200),
    fcfMargin: spread(econ.fcfMarginBps, 150),
    roic: spread(econ.roicBps, 300),
    reinvestment: spread(econ.reinvestmentBps, 200),
    terminalGrowth: Object.freeze(input.terminalGrowth),
    researchEvidenceOnly: true as const,
  });
}

export function runVal05ReverseDcfAnalysis(input: {
  readonly entityId: string;
  readonly asOf: UtcInstant;
  readonly price: Val05MarketPriceInput;
  readonly capitalStructure: Val05CapitalStructure;
  readonly discountRate: Val05DiscountRateDistribution;
  readonly operatingEconomics: Val05OperatingEconomics;
  readonly heliosExpectations: HeliosProbabilisticExpectations;
  readonly priceLevelScenariosMinor?: readonly bigint[];
}): Val05ReverseDcfArtifact {
  const marketImplied = buildMarketImpliedExpectationSurface({
    entityId: input.entityId,
    asOf: input.asOf,
    price: input.price,
    capitalStructure: input.capitalStructure,
    discountRate: input.discountRate,
    operatingEconomics: input.operatingEconomics,
  });

  const expectationGap = computeExpectationGap({
    marketImplied,
    heliosExpectations: input.heliosExpectations,
  });

  const defaultLevels = [
    (input.price.pricePerShareMinor * 80n) / 100n,
    input.price.pricePerShareMinor,
    (input.price.pricePerShareMinor * 120n) / 100n,
  ];
  const priceLevelScenarios = buildPriceLevelScenarios({
    entityId: input.entityId,
    asOf: input.asOf,
    capitalStructure: input.capitalStructure,
    discountRate: input.discountRate,
    operatingEconomics: input.operatingEconomics,
    priceLevelsMinor: input.priceLevelScenariosMinor ?? defaultLevels,
    currency: input.price.currency,
    evidenceRef: input.price.evidenceRef,
  });

  return Object.freeze({
    schema: HELIOS_VALUATION_INTELLIGENCE_SCHEMA,
    module: VAL05_REVERSE_DCF_MODULE,
    authority: HELIOS_VALUATION_INTELLIGENCE_AUTHORITY,
    entityId: input.entityId,
    asOf: input.asOf,
    price: input.price,
    capitalStructure: input.capitalStructure,
    discountRate: input.discountRate,
    operatingEconomics: input.operatingEconomics,
    marketImplied,
    heliosExpectations: input.heliosExpectations,
    expectationGap,
    priceLevelScenarios,
    grantsExecutionAuthority: false as const,
    authorizesFinancialExecution: false as const,
  });
}
