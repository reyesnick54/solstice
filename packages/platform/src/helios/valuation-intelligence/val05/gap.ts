import { medianBps } from './numeric.ts';
import type {
  ExpectationGap,
  HeliosProbabilisticExpectations,
  MarketImpliedExpectationSurface,
  Val05ImpliedFundamentals,
} from './types.ts';

function surfaceMedians(surface: MarketImpliedExpectationSurface): Val05ImpliedFundamentals {
  const combos = surface.combos;
  if (combos.length === 0) {
    return Object.freeze({
      revenueCagrBps: 0,
      operatingMarginBps: 0,
      fcfMarginBps: 0,
      roicBps: 0,
      reinvestmentBps: 0,
      terminalGrowthBps: 0,
      discountRateBps: 0,
    });
  }
  return Object.freeze({
    revenueCagrBps: medianBps(combos.map((c) => c.implied.revenueCagrBps)),
    operatingMarginBps: medianBps(combos.map((c) => c.implied.operatingMarginBps)),
    fcfMarginBps: medianBps(combos.map((c) => c.implied.fcfMarginBps)),
    roicBps: medianBps(combos.map((c) => c.implied.roicBps)),
    reinvestmentBps: medianBps(combos.map((c) => c.implied.reinvestmentBps)),
    terminalGrowthBps: medianBps(combos.map((c) => c.implied.terminalGrowthBps)),
    discountRateBps: medianBps(combos.map((c) => c.implied.discountRateBps)),
  });
}

export function computeExpectationGap(input: {
  readonly marketImplied: MarketImpliedExpectationSurface;
  readonly heliosExpectations: HeliosProbabilisticExpectations;
}): ExpectationGap {
  const market = surfaceMedians(input.marketImplied);
  const helios = input.heliosExpectations;

  return Object.freeze({
    growthGapBps: market.revenueCagrBps - helios.revenueCagr.p50,
    marginGapBps: market.operatingMarginBps - helios.operatingMargin.p50,
    fcfGapBps: market.fcfMarginBps - helios.fcfMargin.p50,
    roicGapBps: market.roicBps - helios.roic.p50,
    reinvestmentGapBps: market.reinvestmentBps - helios.reinvestment.p50,
    terminalGrowthGapBps: market.terminalGrowthBps - helios.terminalGrowth.p50,
    marketImpliedMedianSource: 'SURFACE_MEDIAN',
    heliosReference: 'HELIOS_P50',
    investmentRecommendation: null,
    researchEvidenceOnly: true as const,
  });
}
