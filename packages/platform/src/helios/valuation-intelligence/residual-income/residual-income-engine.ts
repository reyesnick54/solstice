import { reconcileCleanSurplus } from './clean-surplus.ts';
import { bpsToDecimal, perpetuityPresentValue, presentValue, residualIncomeForPeriod, roeDecimalFrom } from './numeric.ts';
import {
  HELIOS_VALUATION_INTELLIGENCE_AUTHORITY,
  HELIOS_VALUATION_INTELLIGENCE_SCHEMA,
} from '../taxonomy.ts';
import { VAL07_RESIDUAL_INCOME_MODULE, VAL07_RESIDUAL_INCOME_SCHEMA } from './taxonomy.ts';
import type {
  ResidualIncomeEngineInput,
  ResidualIncomeState,
  ResidualIncomeValuation,
} from './types.ts';

function assertPriceFree(input: ResidualIncomeEngineInput): void {
  if ('marketPriceMinor' in input && (input as { marketPriceMinor?: unknown }).marketPriceMinor !== undefined) {
    throw new Error('residual-income intrinsic valuation is price-free; market price is not an input');
  }
}

export function runResidualIncomeValuation(input: ResidualIncomeEngineInput): ResidualIncomeValuation {
  assertPriceFree(input);

  const path: ResidualIncomeState[] = [];
  const cleanSurplusAdjustments = [];
  let book = input.currentBookEquity;
  let pvExplicit = 0;

  for (const period of input.forecast.explicitPeriods) {
    const beginningBookEquity = period.beginningBookEquity ?? book;
    const netIncome = period.netIncome ?? 0;
    const costOfEquityBps = period.costOfEquityBps ?? input.costOfEquityBps;
    const ri = residualIncomeForPeriod({
      netIncome,
      beginningBookEquity,
      costOfEquityBps,
    });
    path.push(
      Object.freeze({
        periodIndex: period.periodIndex,
        beginningBookEquity,
        netIncome,
        costOfEquityBps,
        equityCharge: ri.equityCharge,
        residualIncome: ri.residualIncome,
        roeDecimal: roeDecimalFrom(netIncome, beginningBookEquity),
      }),
    );
    pvExplicit += presentValue(ri.residualIncome, costOfEquityBps, period.periodIndex);

    const reconciled = reconcileCleanSurplus({
      period,
      beginningBookEquity,
      netIncome,
      assumeCleanSurplus: input.forecast.assumeCleanSurplus,
    });
    cleanSurplusAdjustments.push(reconciled.adjustment);
    book = reconciled.endingBookEquity;
  }

  let pvContinuing = 0;
  const lastPeriod = input.forecast.explicitPeriods[input.forecast.explicitPeriods.length - 1];
  const terminalKe = lastPeriod?.costOfEquityBps ?? input.costOfEquityBps;
  const continuing = input.forecast.continuing;
  if (continuing && lastPeriod) {
    const lastState = path[path.length - 1];
    if (continuing.kind === 'PERPETUAL_RESIDUAL_INCOME') {
      pvContinuing = perpetuityPresentValue(
        continuing.terminalResidualIncome,
        terminalKe,
        continuing.terminalGrowthBps ?? 0,
        lastPeriod.periodIndex,
      );
    } else if (continuing.kind === 'FADE_TO_COST_OF_EQUITY' && lastState) {
      let fadeBook = book;
      for (let i = 1; i <= continuing.fadeYears; i += 1) {
        const periodIndex = lastPeriod.periodIndex + i;
        const roe = continuing.terminalRoeBps / 10_000;
        const netIncome = fadeBook * roe;
        const ri = residualIncomeForPeriod({
          netIncome,
          beginningBookEquity: fadeBook,
          costOfEquityBps: terminalKe,
        });
        pvExplicit += presentValue(ri.residualIncome, terminalKe, periodIndex);
        fadeBook = fadeBook + netIncome;
      }
    }
  }

  const intrinsicEquityValue = input.currentBookEquity + pvExplicit + pvContinuing;

  const lowKe = input.costOfEquityLowBps ?? input.costOfEquityBps;
  const highKe = input.costOfEquityHighBps ?? input.costOfEquityBps;
  const lowIntrinsic =
    lowKe !== input.costOfEquityBps
      ? runResidualIncomeValuation({ ...input, costOfEquityBps: lowKe, costOfEquityLowBps: undefined, costOfEquityHighBps: undefined })
          .intrinsicEquityValue
      : null;
  const highIntrinsic =
    highKe !== input.costOfEquityBps
      ? runResidualIncomeValuation({ ...input, costOfEquityBps: highKe, costOfEquityLowBps: undefined, costOfEquityHighBps: undefined })
          .intrinsicEquityValue
      : null;

  return Object.freeze({
    schema: VAL07_RESIDUAL_INCOME_SCHEMA,
    module: VAL07_RESIDUAL_INCOME_MODULE,
    parentSchema: HELIOS_VALUATION_INTELLIGENCE_SCHEMA,
    authority: HELIOS_VALUATION_INTELLIGENCE_AUTHORITY,
    valuationId: input.valuationId,
    entityLabel: input.entityLabel,
    evaluationTime: input.evaluationTime,
    currentBookEquity: input.currentBookEquity,
    costOfEquityBps: input.costOfEquityBps,
    forecast: input.forecast,
    path: Object.freeze(path),
    cleanSurplusAdjustments: Object.freeze(cleanSurplusAdjustments),
    distribution: Object.freeze({
      pointIntrinsicEquity: intrinsicEquityValue,
      pvExplicitResidualIncome: pvExplicit,
      pvContinuingResidualIncome: pvContinuing,
      lowIntrinsicEquity: lowIntrinsic,
      highIntrinsicEquity: highIntrinsic,
    }),
    intrinsicEquityValue,
    priceFree: true,
    researchOnly: true,
    grantsExecutionAuthority: false,
  });
}

export function compareIntrinsicToMarketPrice(input: {
  readonly intrinsicEquityValue: number;
  readonly marketPriceMinor: bigint;
  readonly sharesOutstanding: number;
}): import('./types.ts').PostHocPriceComparison {
  const marketEquity = Number(input.marketPriceMinor) * input.sharesOutstanding;
  const premium = marketEquity / input.intrinsicEquityValue - 1;
  return Object.freeze({
    intrinsicEquityValue: input.intrinsicEquityValue,
    marketPriceMinor: input.marketPriceMinor,
    premiumToIntrinsicRatio: premium,
    computedAfterIntrinsic: true,
    notUsedInIntrinsicCalculation: true,
  });
}

/** @internal exported for tests — Gordon on constant residual income. */
export function singleStageIntrinsicFromConstantRi(input: {
  readonly bookEquity: number;
  readonly residualIncome: number;
  readonly costOfEquityBps: number;
}): number {
  const rate = bpsToDecimal(input.costOfEquityBps);
  if (rate <= 0) {
    throw new Error('cost of equity must be positive');
  }
  return input.bookEquity + input.residualIncome / rate;
}
