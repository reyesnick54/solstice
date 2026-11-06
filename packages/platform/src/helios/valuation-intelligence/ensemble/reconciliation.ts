import type {
  IndependentIntrinsicValueDistribution,
  MarketReferencedValueDistribution,
  ValuationReconciliation,
} from './types.ts';

export function buildValuationReconciliation(input: {
  readonly reconciliationId: string;
  readonly intrinsic: IndependentIntrinsicValueDistribution;
  readonly marketReferenced: MarketReferencedValueDistribution;
  readonly applicabilityNotes: readonly string[];
}): ValuationReconciliation {
  const intrinsicMedian = input.intrinsic.medianEquityPerShareMinor;
  const marketMedian = input.marketReferenced.medianEquityPerShareMinor;

  let gapMinor: bigint | null = null;
  let gapDirection: ValuationReconciliation['gapDirection'] = 'UNKNOWN';

  if (intrinsicMedian !== null && marketMedian !== null) {
    gapMinor = intrinsicMedian - marketMedian;
    if (gapMinor === 0n) {
      gapDirection = 'ALIGNED';
    } else if (gapMinor > 0n) {
      gapDirection = 'INTRINSIC_ABOVE_MARKET';
    } else {
      gapDirection = 'MARKET_ABOVE_INTRINSIC';
    }
  }

  const explanatoryFactors = Object.freeze([
    ...input.applicabilityNotes,
    'lanes_kept_separate_by_design',
    'reconciliation_is_diagnostic_not_a_single_price_target',
    gapDirection === 'INTRINSIC_ABOVE_MARKET'
      ? 'intrinsic_methods_imply_higher_fundamental_anchor_than_market_referenced'
      : gapDirection === 'MARKET_ABOVE_INTRINSIC'
        ? 'market_referenced_methods_imply_higher_level_than_price_free_intrinsic'
        : 'insufficient_separation_or_missing_medians',
  ]);

  return Object.freeze({
    reconciliationId: input.reconciliationId,
    intrinsicMedianMinor: intrinsicMedian,
    marketReferencedMedianMinor: marketMedian,
    gapMinor,
    gapDirection,
    explanatoryFactors,
    lanesAveraged: false,
    notAFact: true,
    researchOnly: true,
    grantsExecutionAuthority: false,
  });
}
