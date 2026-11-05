import { asUtcInstant } from '@solstice/domain';

import type {
  Val05CapitalStructure,
  Val05DiscountRateDistribution,
  Val05MarketPriceInput,
  Val05OperatingEconomics,
} from './types.ts';

export const VAL05_FIXTURE_ENTITY_ID = 'entity/demo-val05' as const;
export const VAL05_FIXTURE_AS_OF = asUtcInstant('2026-11-05T06:00:00.000Z');

export function val05DemoCapitalStructure(): Val05CapitalStructure {
  return Object.freeze({
    sharesOutstanding: 1_000_000_000n,
    netDebtMinor: 5_000_000_000_00n,
    cashMinor: 10_000_000_000_00n,
    minorityInterestMinor: 0n,
  });
}

export function val05DemoOperatingEconomics(): Val05OperatingEconomics {
  return Object.freeze({
    baseRevenueMinor: 100_000_000_000_00n,
    operatingMarginBps: 2_500,
    fcfMarginBps: 1_800,
    roicBps: 1_500,
    reinvestmentBps: 600,
    effectiveTaxRateBps: 2_100,
    fiscalPeriod: 'FY2025',
    knowableAt: VAL05_FIXTURE_AS_OF,
  });
}

export function val05DemoDiscountRate(): Val05DiscountRateDistribution {
  return Object.freeze({
    samplesBps: Object.freeze([850, 900, 950, 1_000, 1_050]),
    p10: 850,
    p50: 950,
    p90: 1_050,
  });
}

export function val05DemoPrice(): Val05MarketPriceInput {
  return Object.freeze({
    pricePerShareMinor: 15_000n,
    currency: 'USD',
    asOf: VAL05_FIXTURE_AS_OF,
    evidenceRef: 'fixture/val05/market/close',
  });
}
