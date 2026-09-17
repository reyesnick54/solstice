import type { QualificationTermsSnapshot } from '../executable-opportunity/types.ts';
import type { EnvelopeReasonCode } from './taxonomy.ts';

export type EconomicDriftPolicy = {
  readonly version: string;
  readonly materialSpreadIncreaseBps: number;
  readonly materialPriceChangeBps: number;
};

export const DEFAULT_ECONOMIC_DRIFT_POLICY: EconomicDriftPolicy = Object.freeze({
  version: 'helios-economic-drift-v1',
  materialSpreadIncreaseBps: 10,
  materialPriceChangeBps: 25,
});

export type EconomicEdgeAssessment = {
  readonly expectedEdgeBps: number;
  readonly spreadBps: number;
  readonly feeBps: number;
  readonly slippageBps: number;
  readonly totalCostBps: number;
  readonly netEdgeBps: number;
  readonly economicallyValid: boolean;
  readonly reasonCodes: readonly EnvelopeReasonCode[];
};

export function assessEconomicEdge(input: {
  readonly expectedEdgeBps: number;
  readonly terms: QualificationTermsSnapshot | null;
  readonly baselineSpreadBps?: number;
  readonly slippageBps?: number;
}): EconomicEdgeAssessment {
  const spreadBps = input.terms?.spreadBps ?? 0;
  const feeBps = sumFeeBps(input.terms);
  const slippageBps = input.slippageBps ?? 5;
  const totalCostBps = spreadBps + feeBps + slippageBps;
  const netEdgeBps = input.expectedEdgeBps - totalCostBps;
  const reasonCodes: EnvelopeReasonCode[] = [];

  if (netEdgeBps <= 0) {
    reasonCodes.push('TRANSACTION_COST_DESTROYS_EDGE');
  }
  if (
    input.baselineSpreadBps !== undefined &&
    spreadBps - input.baselineSpreadBps >= DEFAULT_ECONOMIC_DRIFT_POLICY.materialSpreadIncreaseBps
  ) {
    reasonCodes.push('MARKET_SPREAD_WIDENED');
  }

  return Object.freeze({
    expectedEdgeBps: input.expectedEdgeBps,
    spreadBps,
    feeBps,
    slippageBps,
    totalCostBps,
    netEdgeBps,
    economicallyValid: netEdgeBps > 0 && !reasonCodes.includes('MARKET_SPREAD_WIDENED'),
    reasonCodes: Object.freeze(reasonCodes.length > 0 ? reasonCodes : (['OK'] as const)),
  });
}

export function detectMaterialTermsChange(
  baseline: QualificationTermsSnapshot | null,
  current: QualificationTermsSnapshot | null,
  policy: EconomicDriftPolicy = DEFAULT_ECONOMIC_DRIFT_POLICY,
): EnvelopeReasonCode | null {
  if (!baseline || !current) {
    return null;
  }
  if (baseline.priceReference?.minorUnits !== current.priceReference?.minorUnits) {
    return 'MARKET_TERMS_MATERIAL_CHANGE';
  }
  const baselineSpread = baseline.spreadBps ?? 0;
  const currentSpread = current.spreadBps ?? 0;
  if (currentSpread - baselineSpread >= policy.materialSpreadIncreaseBps) {
    return 'MARKET_SPREAD_WIDENED';
  }
  if (baseline.providerAvailability !== current.providerAvailability) {
    return 'MARKET_TERMS_MATERIAL_CHANGE';
  }
  return null;
}

function sumFeeBps(terms: QualificationTermsSnapshot | null): number {
  if (!terms?.feeMetadata) {
    return 0;
  }
  return terms.feeMetadata.reduce((sum, fee) => sum + fee.basisPoints, 0);
}
