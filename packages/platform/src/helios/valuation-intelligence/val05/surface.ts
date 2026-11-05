import { createHash } from 'node:crypto';

import type { UtcInstant } from '@solstice/domain';

import {
  HELIOS_VALUATION_INTELLIGENCE_AUTHORITY,
  HELIOS_VALUATION_INTELLIGENCE_SCHEMA,
  VAL05_REVERSE_DCF_MODULE,
} from '../taxonomy.ts';
import {
  equityValueMinor,
  impliedOperatingMarginBps,
  impliedReinvestmentFromGrowthRoic,
  solveRevenueCagrBps,
} from './numeric.ts';
import type {
  MarketImpliedExpectationSurface,
  Val05CapitalStructure,
  Val05DiscountRateDistribution,
  Val05ImpliedCombo,
  Val05MarketPriceInput,
  Val05OperatingEconomics,
} from './types.ts';

function comboId(parts: readonly string[]): string {
  const digest = createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 16);
  return `val05_combo_${digest}`;
}

export function buildMarketImpliedExpectationSurface(input: {
  readonly entityId: string;
  readonly asOf: UtcInstant;
  readonly price: Val05MarketPriceInput;
  readonly capitalStructure: Val05CapitalStructure;
  readonly discountRate: Val05DiscountRateDistribution;
  readonly operatingEconomics: Val05OperatingEconomics;
  readonly terminalGrowthGridBps?: readonly number[];
  readonly fcfMarginGridBps?: readonly number[];
  readonly roicGridBps?: readonly number[];
}): MarketImpliedExpectationSurface {
  const targetEquityMinor = equityValueMinor({
    pricePerShareMinor: input.price.pricePerShareMinor,
    sharesOutstanding: input.capitalStructure.sharesOutstanding,
    netDebtMinor: input.capitalStructure.netDebtMinor,
    cashMinor: input.capitalStructure.cashMinor,
    minorityInterestMinor: input.capitalStructure.minorityInterestMinor,
  });

  const terminalGrid = input.terminalGrowthGridBps ?? [0, 100, 150, 200, 250];
  const fcfGrid =
    input.fcfMarginGridBps ?? [
      input.operatingEconomics.fcfMarginBps - 300,
      input.operatingEconomics.fcfMarginBps,
      input.operatingEconomics.fcfMarginBps + 300,
    ].map((v) => Math.max(0, v));
  const roicGrid = input.roicGridBps ?? [
    input.operatingEconomics.roicBps - 500,
    input.operatingEconomics.roicBps,
    input.operatingEconomics.roicBps + 500,
  ].map((v) => Math.max(100, v));

  const waccSamples =
    input.discountRate.samplesBps.length > 0
      ? input.discountRate.samplesBps
      : [input.discountRate.p10, input.discountRate.p50, input.discountRate.p90];

  const combos: Val05ImpliedCombo[] = [];

  for (const discountRateBps of waccSamples) {
    for (const terminalGrowthBps of terminalGrid) {
      for (const fcfMarginBps of fcfGrid) {
        for (const roicBps of roicGrid) {
          const solved = solveRevenueCagrBps({
            baseRevenueMinor: input.operatingEconomics.baseRevenueMinor,
            fcfMarginBps,
            terminalGrowthBps,
            discountRateBps,
            targetEnterpriseMinor: targetEquityMinor,
          });
          if (!solved) {
            continue;
          }
          const reinvestmentBps = impliedReinvestmentFromGrowthRoic(solved.cagrBps, roicBps);
          const operatingMarginBps = impliedOperatingMarginBps({
            fcfMarginBps,
            effectiveTaxRateBps: input.operatingEconomics.effectiveTaxRateBps,
            reinvestmentBps,
          });
          const absResidual = Number(solved.residualMinor < 0n ? -solved.residualMinor : solved.residualMinor);
          const fitQuality = 1 / (1 + absResidual / Math.max(1, Number(targetEquityMinor)));
          const implied = Object.freeze({
            revenueCagrBps: solved.cagrBps,
            operatingMarginBps,
            fcfMarginBps,
            roicBps,
            reinvestmentBps,
            terminalGrowthBps,
            discountRateBps,
          });
          combos.push(
            Object.freeze({
              comboId: comboId([
                String(discountRateBps),
                String(terminalGrowthBps),
                String(fcfMarginBps),
                String(roicBps),
                String(solved.cagrBps),
              ]),
              implied,
              impliedEquityMinor: targetEquityMinor + solved.residualMinor,
              targetEquityMinor,
              equityResidualMinor: solved.residualMinor,
              fitQuality,
              narrative:
                'One consistent path: given WACC, terminal growth, FCF margin, and ROIC, revenue CAGR is implied.',
            }),
          );
        }
      }
    }
  }

  combos.sort((a, b) => b.fitQuality - a.fitQuality);

  return Object.freeze({
    schema: HELIOS_VALUATION_INTELLIGENCE_SCHEMA,
    module: VAL05_REVERSE_DCF_MODULE,
    authority: HELIOS_VALUATION_INTELLIGENCE_AUTHORITY,
    entityId: input.entityId,
    asOf: input.asOf,
    targetEquityMinor,
    combos: Object.freeze(combos),
    combinationCount: combos.length,
    nonUniqueAcknowledged: true as const,
    researchEvidenceOnly: true as const,
  });
}
