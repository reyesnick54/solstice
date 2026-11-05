import { equityValueMinor } from './numeric.ts';
import { buildMarketImpliedExpectationSurface } from './surface.ts';
import type {
  Val05CapitalStructure,
  Val05DiscountRateDistribution,
  Val05MarketPriceInput,
  Val05OperatingEconomics,
  Val05PriceLevelScenario,
  Val05WhatMustBeTrueClaim,
} from './types.ts';
import type { UtcInstant } from '@solstice/domain';

function whatMustBeTrueFromCombo(
  combo: Val05PriceLevelScenario['representativeCombo'],
): readonly Val05WhatMustBeTrueClaim[] {
  const { implied } = combo;
  const rows: Val05WhatMustBeTrueClaim[] = [
    {
      metric: 'revenueCagrBps',
      requiredBps: implied.revenueCagrBps,
      label: `Revenue must compound near ${(implied.revenueCagrBps / 100).toFixed(1)}% CAGR over the explicit horizon.`,
    },
    {
      metric: 'operatingMarginBps',
      requiredBps: implied.operatingMarginBps,
      label: `Operating margin near ${(implied.operatingMarginBps / 100).toFixed(1)}% sustained.`,
    },
    {
      metric: 'fcfMarginBps',
      requiredBps: implied.fcfMarginBps,
      label: `FCF margin near ${(implied.fcfMarginBps / 100).toFixed(1)}% of revenue.`,
    },
    {
      metric: 'roicBps',
      requiredBps: implied.roicBps,
      label: `ROIC near ${(implied.roicBps / 100).toFixed(1)}%.`,
    },
    {
      metric: 'reinvestmentBps',
      requiredBps: implied.reinvestmentBps,
      label: `Reinvestment rate near ${(implied.reinvestmentBps / 100).toFixed(1)}% of operating profit.`,
    },
    {
      metric: 'terminalGrowthBps',
      requiredBps: implied.terminalGrowthBps,
      label: `Terminal growth near ${(implied.terminalGrowthBps / 100).toFixed(1)}%.`,
    },
    {
      metric: 'discountRateBps',
      requiredBps: implied.discountRateBps,
      label: `Discount rate near ${(implied.discountRateBps / 100).toFixed(1)}%.`,
    },
  ];
  return Object.freeze(rows);
}

export function buildPriceLevelScenarios(input: {
  readonly entityId: string;
  readonly asOf: UtcInstant;
  readonly capitalStructure: Val05CapitalStructure;
  readonly discountRate: Val05DiscountRateDistribution;
  readonly operatingEconomics: Val05OperatingEconomics;
  readonly priceLevelsMinor: readonly bigint[];
  readonly currency: string;
  readonly evidenceRef: string;
}): readonly Val05PriceLevelScenario[] {
  const scenarios: Val05PriceLevelScenario[] = [];

  for (const pricePerShareMinor of input.priceLevelsMinor) {
    const price: Val05MarketPriceInput = Object.freeze({
      pricePerShareMinor,
      currency: input.currency,
      asOf: input.asOf,
      evidenceRef: input.evidenceRef,
    });
    const surface = buildMarketImpliedExpectationSurface({
      entityId: input.entityId,
      asOf: input.asOf,
      price,
      capitalStructure: input.capitalStructure,
      discountRate: input.discountRate,
      operatingEconomics: input.operatingEconomics,
      terminalGrowthGridBps: [150, 200],
      fcfMarginGridBps: [input.operatingEconomics.fcfMarginBps],
      roicGridBps: [input.operatingEconomics.roicBps],
    });
    const representativeCombo = surface.combos[0];
    if (!representativeCombo) {
      continue;
    }
    const targetEquityMinor = equityValueMinor({
      pricePerShareMinor,
      sharesOutstanding: input.capitalStructure.sharesOutstanding,
      netDebtMinor: input.capitalStructure.netDebtMinor,
      cashMinor: input.capitalStructure.cashMinor,
      minorityInterestMinor: input.capitalStructure.minorityInterestMinor,
    });
    scenarios.push(
      Object.freeze({
        pricePerShareMinor,
        targetEquityMinor,
        representativeCombo,
        whatMustBeTrue: whatMustBeTrueFromCombo(representativeCombo),
        researchEvidenceOnly: true as const,
      }),
    );
  }

  return Object.freeze(scenarios);
}
