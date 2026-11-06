/**
 * Compile VAL07 residual-income outputs into the valuation feature plane.
 */

import type { UtcInstant } from '@solstice/domain';

import type { ResidualIncomeValuation } from '../../valuation-intelligence/residual-income/types.ts';
import type { ValuationFeatureValue } from './types.ts';
import { HELIOS_VALUATION_FEATURE_PLANE_SCHEMA } from './taxonomy.ts';

export function val07FeaturesFromResidualIncome(input: {
  readonly valuation: ResidualIncomeValuation;
  readonly evaluationTime: UtcInstant;
  readonly canonicalEntityId: string;
  readonly manifestId: string;
}): readonly ValuationFeatureValue[] {
  const v = input.valuation;
  return Object.freeze([
    Object.freeze({
      featureId: 'val07.intrinsic_equity_value',
      valueMinor: null,
      ratioDecimal: String(v.intrinsicEquityValue),
      knowableAt: input.evaluationTime,
      evidenceRef: v.valuationId,
    }),
    Object.freeze({
      featureId: 'val07.pv_residual_income',
      valueMinor: null,
      ratioDecimal: String(v.distribution.pvExplicitResidualIncome + v.distribution.pvContinuingResidualIncome),
      knowableAt: input.evaluationTime,
      evidenceRef: v.valuationId,
    }),
    Object.freeze({
      featureId: 'val07.current_book_equity',
      valueMinor: null,
      ratioDecimal: String(v.currentBookEquity),
      knowableAt: input.evaluationTime,
      evidenceRef: v.valuationId,
    }),
    Object.freeze({
      featureId: 'val07.cost_of_equity_bps',
      valueMinor: BigInt(v.costOfEquityBps),
      ratioDecimal: null,
      knowableAt: input.evaluationTime,
      evidenceRef: v.valuationId,
    }),
  ]);
}

export function val07FeaturePlaneStub(input: {
  readonly evaluationTime: UtcInstant;
  readonly canonicalEntityId: string;
  readonly manifestId: string;
  readonly features: readonly ValuationFeatureValue[];
}) {
  return Object.freeze({
    schema: HELIOS_VALUATION_FEATURE_PLANE_SCHEMA,
    evaluationTime: input.evaluationTime,
    canonicalEntityId: input.canonicalEntityId,
    manifestId: input.manifestId,
    features: input.features,
  });
}
