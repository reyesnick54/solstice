import type { UtcInstant } from '../../../../../../domain/src/time.ts';
import { HELIOS_EARN06_EARNINGS_QUALITY_SCHEMA } from './taxonomy.ts';
import type {
  Earn06ComputedFeature,
  Earn06ScorecardInterpretation,
  EarningsQualityScorecard,
  EarningsQualityScorecardDimension,
} from './types.ts';
import { EARN06_SCORECARD_DIMENSION_LABELS } from './types.ts';

function interpretFeature(feature: Earn06ComputedFeature): Earn06ScorecardInterpretation {
  if (feature.quality !== 'VALID' || feature.valueMinor == null) {
    return 'UNAVAILABLE';
  }
  const v = feature.valueMinor;
  switch (feature.featureId) {
    case 'earn06.accrual_quality':
      return absInterpret(v, 500n, true);
    case 'earn06.cash_conversion':
    case 'earn06.free_cash_flow_conversion':
      return v >= 8_000n ? 'FAVORABLE' : v >= 5_000n ? 'NEUTRAL' : 'UNFAVORABLE';
    case 'earn06.revenue_cash_divergence':
      return absInterpret(v, 1_000n, true);
    case 'earn06.receivables_growth':
    case 'earn06.inventory_growth':
      return v > 1_500n ? 'UNFAVORABLE' : v > 500n ? 'NEUTRAL' : 'FAVORABLE';
    case 'earn06.sbc_intensity':
    case 'earn06.non_gaap_adjustment_intensity':
    case 'earn06.one_time_item_intensity':
    case 'earn06.capitalized_cost_signal':
      return v > 800n ? 'UNFAVORABLE' : v > 300n ? 'NEUTRAL' : 'FAVORABLE';
    case 'earn06.buyback_eps_contribution':
      return v > 6_000n ? 'UNFAVORABLE' : v > 3_000n ? 'NEUTRAL' : 'FAVORABLE';
    case 'earn06.share_count_change':
      return v < -500n ? 'NEUTRAL' : v > 500n ? 'UNFAVORABLE' : 'FAVORABLE';
    case 'earn06.gross_margin_quality':
    case 'earn06.operating_margin_quality':
      return v >= 3_000n ? 'FAVORABLE' : v >= 1_500n ? 'NEUTRAL' : 'UNFAVORABLE';
    case 'earn06.capex_intensity':
      return v > 1_500n ? 'NEUTRAL' : 'FAVORABLE';
    case 'earn06.working_capital_intensity':
      return v > 2_500n ? 'UNFAVORABLE' : 'NEUTRAL';
    case 'earn06.operating_cash_flow_vs_net_income':
      return v >= 0n ? 'FAVORABLE' : 'UNFAVORABLE';
    case 'earn06.deferred_revenue_change':
    case 'earn06.tax_rate_contribution':
      return 'NEUTRAL';
    default:
      return 'NEUTRAL';
  }
}

function absInterpret(value: bigint, threshold: bigint, highIsBad: boolean): Earn06ScorecardInterpretation {
  const magnitude = value < 0n ? -value : value;
  if (magnitude <= threshold / 2n) {
    return 'FAVORABLE';
  }
  if (magnitude <= threshold) {
    return 'NEUTRAL';
  }
  return highIsBad ? 'UNFAVORABLE' : 'FAVORABLE';
}

export function buildEarningsQualityScorecard(input: {
  readonly canonicalEntityId: string;
  readonly evaluationTime: UtcInstant;
  readonly fiscalPeriod: string;
  readonly features: readonly Earn06ComputedFeature[];
}): EarningsQualityScorecard {
  const dimensions: EarningsQualityScorecardDimension[] = input.features.map((row) =>
    Object.freeze({
      dimensionId: row.featureId.replace('earn06.', 'dim_'),
      label: EARN06_SCORECARD_DIMENSION_LABELS[row.featureId],
      featureId: row.featureId,
      valueMinor: row.valueMinor,
      valueText: row.valueText,
      interpretation: interpretFeature(row),
      quality: row.quality,
    }),
  );

  return Object.freeze({
    schema: HELIOS_EARN06_EARNINGS_QUALITY_SCHEMA,
    canonicalEntityId: input.canonicalEntityId,
    evaluationTime: input.evaluationTime,
    fiscalPeriod: input.fiscalPeriod,
    dimensions: Object.freeze(dimensions),
    grantsExecutionAuthority: false,
  });
}
