import type { UtcInstant } from '@solstice/domain';

import {
  HELIOS_VALUATION_INTELLIGENCE_AUTHORITY,
  HELIOS_VALUATION_INTELLIGENCE_SCHEMA,
  VAL05_REVERSE_DCF_MODULE,
} from '../taxonomy.ts';

export type Val05Bps = number;

export type Val05DistributionSummary = {
  readonly p10: Val05Bps;
  readonly p50: Val05Bps;
  readonly p90: Val05Bps;
};

export type Val05DiscountRateDistribution = {
  readonly samplesBps: readonly Val05Bps[];
  readonly p10: Val05Bps;
  readonly p50: Val05Bps;
  readonly p90: Val05Bps;
};

export type Val05CapitalStructure = {
  readonly sharesOutstanding: bigint;
  readonly netDebtMinor: bigint;
  readonly cashMinor: bigint;
  readonly minorityInterestMinor: bigint;
};

export type Val05OperatingEconomics = {
  readonly baseRevenueMinor: bigint;
  readonly operatingMarginBps: Val05Bps;
  readonly fcfMarginBps: Val05Bps;
  readonly roicBps: Val05Bps;
  readonly reinvestmentBps: Val05Bps;
  readonly effectiveTaxRateBps: Val05Bps;
  readonly fiscalPeriod: string;
  readonly knowableAt: UtcInstant;
};

export type Val05MarketPriceInput = {
  readonly pricePerShareMinor: bigint;
  readonly currency: string;
  readonly asOf: UtcInstant;
  readonly evidenceRef: string;
};

export type Val05ImpliedFundamentals = {
  readonly revenueCagrBps: Val05Bps;
  readonly operatingMarginBps: Val05Bps;
  readonly fcfMarginBps: Val05Bps;
  readonly roicBps: Val05Bps;
  readonly reinvestmentBps: Val05Bps;
  readonly terminalGrowthBps: Val05Bps;
  readonly discountRateBps: Val05Bps;
};

export type Val05ImpliedCombo = {
  readonly comboId: string;
  readonly implied: Val05ImpliedFundamentals;
  readonly impliedEquityMinor: bigint;
  readonly targetEquityMinor: bigint;
  readonly equityResidualMinor: bigint;
  readonly fitQuality: number;
  readonly narrative: string;
};

/** Multiple consistent solutions — not a single implied point estimate. */
export type MarketImpliedExpectationSurface = {
  readonly schema: typeof HELIOS_VALUATION_INTELLIGENCE_SCHEMA;
  readonly module: typeof VAL05_REVERSE_DCF_MODULE;
  readonly authority: typeof HELIOS_VALUATION_INTELLIGENCE_AUTHORITY;
  readonly entityId: string;
  readonly asOf: UtcInstant;
  readonly targetEquityMinor: bigint;
  readonly combos: readonly Val05ImpliedCombo[];
  readonly combinationCount: number;
  readonly nonUniqueAcknowledged: true;
  readonly researchEvidenceOnly: true;
};

export type HeliosProbabilisticExpectations = {
  readonly schema: typeof HELIOS_VALUATION_INTELLIGENCE_SCHEMA;
  readonly module: 'HELIOS_PROBABILISTIC_EXPECTATIONS';
  readonly entityId: string;
  readonly asOf: UtcInstant;
  readonly revenueCagr: Val05DistributionSummary;
  readonly operatingMargin: Val05DistributionSummary;
  readonly fcfMargin: Val05DistributionSummary;
  readonly roic: Val05DistributionSummary;
  readonly reinvestment: Val05DistributionSummary;
  readonly terminalGrowth: Val05DistributionSummary;
  readonly researchEvidenceOnly: true;
};

export type ExpectationGap = {
  readonly growthGapBps: Val05Bps;
  readonly marginGapBps: Val05Bps;
  readonly fcfGapBps: Val05Bps;
  readonly roicGapBps: Val05Bps;
  readonly reinvestmentGapBps: Val05Bps;
  readonly terminalGrowthGapBps: Val05Bps;
  readonly marketImpliedMedianSource: 'SURFACE_MEDIAN';
  readonly heliosReference: 'HELIOS_P50';
  readonly investmentRecommendation: null;
  readonly researchEvidenceOnly: true;
};

export type Val05WhatMustBeTrueClaim = {
  readonly metric: keyof Val05ImpliedFundamentals;
  readonly requiredBps: Val05Bps;
  readonly label: string;
};

export type Val05PriceLevelScenario = {
  readonly pricePerShareMinor: bigint;
  readonly targetEquityMinor: bigint;
  readonly representativeCombo: Val05ImpliedCombo;
  readonly whatMustBeTrue: readonly Val05WhatMustBeTrueClaim[];
  readonly researchEvidenceOnly: true;
};

export type Val05ReverseDcfArtifact = {
  readonly schema: typeof HELIOS_VALUATION_INTELLIGENCE_SCHEMA;
  readonly module: typeof VAL05_REVERSE_DCF_MODULE;
  readonly authority: typeof HELIOS_VALUATION_INTELLIGENCE_AUTHORITY;
  readonly entityId: string;
  readonly asOf: UtcInstant;
  readonly price: Val05MarketPriceInput;
  readonly capitalStructure: Val05CapitalStructure;
  readonly discountRate: Val05DiscountRateDistribution;
  readonly operatingEconomics: Val05OperatingEconomics;
  readonly marketImplied: MarketImpliedExpectationSurface;
  readonly heliosExpectations: HeliosProbabilisticExpectations;
  readonly expectationGap: ExpectationGap;
  readonly priceLevelScenarios: readonly Val05PriceLevelScenario[];
  readonly grantsExecutionAuthority: false;
  readonly authorizesFinancialExecution: false;
};
