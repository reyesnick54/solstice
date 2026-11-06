import type { ValuationIssuerProfile } from '../applicability.ts';
import { evaluateValuationMethodApplicability } from '../applicability.ts';
import type { ValuationMethod } from '../taxonomy.ts';

import type {
  CompanyCharacteristicTag,
  IntrinsicEnsembleMethod,
  MarketReferencedEnsembleMethod,
} from './taxonomy.ts';
import type { ModelApplicabilityState } from './types.ts';

export type EnsembleCompanyCharacteristics = ValuationIssuerProfile & {
  readonly characteristicTags: readonly CompanyCharacteristicTag[];
  readonly isLossMaking: boolean;
  readonly isHighGrowth: boolean;
  readonly assetIntensityScore: number;
  readonly forecastEvidenceQuality: number;
};

function mapIntrinsicToVal01(method: IntrinsicEnsembleMethod): ValuationMethod | null {
  switch (method) {
    case 'DCF_FCFF':
      return 'DCF_FCFF';
    case 'DCF_FCFE':
      return 'DCF_FCFE';
    case 'RESIDUAL_INCOME':
      return 'RESIDUAL_INCOME';
    case 'SUM_OF_PARTS':
      return 'SUM_OF_PARTS';
    default:
      return null;
  }
}

function intrinsicCharacteristicAdjustments(
  method: IntrinsicEnsembleMethod,
  tags: readonly CompanyCharacteristicTag[],
  profile: EnsembleCompanyCharacteristics,
): { scoreDelta: number; reasons: readonly string[]; drivers: readonly CompanyCharacteristicTag[] } {
  const reasons: string[] = [];
  const drivers: CompanyCharacteristicTag[] = [];
  let scoreDelta = 0;

  const tagSet = new Set(tags);

  if (tagSet.has('BANK')) {
    drivers.push('BANK');
    if (method === 'DCF_FCFF') {
      scoreDelta -= 0.45;
      reasons.push('bank_generic_fcff_often_inappropriate');
    }
    if (method === 'RESIDUAL_INCOME' || method === 'ECONOMIC_PROFIT') {
      scoreDelta += 0.35;
      reasons.push('bank_excess_return_preferred');
    }
  }

  if (tagSet.has('MATURE_DIVIDEND_PAYER') && method === 'RESIDUAL_OPERATING_CASH_FLOW') {
    drivers.push('MATURE_DIVIDEND_PAYER');
    scoreDelta += 0.15;
    reasons.push('stable_cash_generation_supports_roc_flow');
  }

  if (tagSet.has('CONGLOMERATE') && method === 'SUM_OF_PARTS') {
    drivers.push('CONGLOMERATE');
    scoreDelta += 0.4;
    reasons.push('conglomerate_sotp_strongly_applicable');
  }

  if (tagSet.has('LOSS_MAKING_HIGH_GROWTH')) {
    drivers.push('LOSS_MAKING_HIGH_GROWTH');
    if (method === 'DCF_FCFF' || method === 'DCF_FCFE') {
      scoreDelta += profile.forecastEvidenceQuality >= 0.5 ? 0.2 : -0.1;
      reasons.push('loss_making_dcf_usable_with_uncertainty');
    }
    if (method === 'RESIDUAL_INCOME') {
      scoreDelta -= 0.25;
      reasons.push('loss_making_residual_income_weak');
    }
  }

  if (tagSet.has('RESOURCE_ASSET_HEAVY') && method === 'ASSET_NAV') {
    drivers.push('RESOURCE_ASSET_HEAVY');
    scoreDelta += 0.35;
    reasons.push('asset_nav_matters_for_resource_heavy');
  }

  if (profile.isPreRevenue && (method === 'DCF_FCFF' || method === 'DCF_FCFE')) {
    scoreDelta -= 0.5;
    reasons.push('pre_revenue_dcf_constrained');
  }

  if (profile.assetIntensityScore >= 0.7 && method === 'ASSET_NAV') {
    scoreDelta += 0.2;
    reasons.push('high_asset_intensity');
  }

  return Object.freeze({
    scoreDelta,
    reasons: Object.freeze(reasons),
    drivers: Object.freeze(drivers),
  });
}

function marketReferencedCharacteristicAdjustments(
  method: MarketReferencedEnsembleMethod,
  tags: readonly CompanyCharacteristicTag[],
  profile: EnsembleCompanyCharacteristics,
): { scoreDelta: number; reasons: readonly string[]; drivers: readonly CompanyCharacteristicTag[] } {
  const reasons: string[] = [];
  const drivers: CompanyCharacteristicTag[] = [];
  let scoreDelta = 0;
  const tagSet = new Set(tags);

  if (tagSet.has('LOSS_MAKING_HIGH_GROWTH') && method === 'RELATIVE_VALUATION') {
    drivers.push('LOSS_MAKING_HIGH_GROWTH');
    scoreDelta -= 0.4;
    reasons.push('pe_inappropriate_for_loss_making');
  }

  if (!profile.hasMarketPrice && (method === 'REVERSE_DCF' || method === 'MARKET_IMPLIED_EXPECTATIONS')) {
    scoreDelta -= 1;
    reasons.push('missing_market_price');
  }

  if (!profile.hasPeerUniverse && (method === 'COMPARABLE_MULTIPLES' || method === 'RELATIVE_VALUATION')) {
    scoreDelta -= 0.6;
    reasons.push('missing_peer_universe');
  }

  if (method === 'COMPARABLE_MULTIPLES' && profile.hasPeerUniverse) {
    scoreDelta += 0.15;
    reasons.push('peer_set_available');
  }

  return Object.freeze({ scoreDelta, reasons: Object.freeze(reasons), drivers: Object.freeze(drivers) });
}

function baseApplicabilityScore(applicable: boolean, scoreDelta: number): number {
  const raw = (applicable ? 0.55 : 0.1) + scoreDelta;
  return Math.min(1, Math.max(0, raw));
}

export function evaluateIntrinsicModelApplicability(
  profile: EnsembleCompanyCharacteristics,
  method: IntrinsicEnsembleMethod,
): ModelApplicabilityState {
  const val01 = mapIntrinsicToVal01(method);
  const val01Verdict =
    val01 !== null
      ? evaluateValuationMethodApplicability(profile, val01)
      : Object.freeze({ method: 'DCF_FCFF' as ValuationMethod, applicable: true, reasons: Object.freeze(['extended_intrinsic_method']) });

  const char = intrinsicCharacteristicAdjustments(method, profile.characteristicTags, profile);
  const economicallyValid =
    val01Verdict.applicable && char.scoreDelta > -0.5 && baseApplicabilityScore(val01Verdict.applicable, char.scoreDelta) >= 0.15;

  const reasons = Object.freeze([...val01Verdict.reasons, ...char.reasons]);
  return Object.freeze({
    method,
    lane: 'INTRINSIC',
    economicallyValid,
    applicabilityScore: baseApplicabilityScore(val01Verdict.applicable, char.scoreDelta),
    reasons,
    characteristicDrivers: char.drivers,
  });
}

export function evaluateMarketReferencedModelApplicability(
  profile: EnsembleCompanyCharacteristics,
  method: MarketReferencedEnsembleMethod,
): ModelApplicabilityState {
  let val01Applicable = true;
  const val01Reasons: string[] = [];

  if (method === 'REVERSE_DCF') {
    const v = evaluateValuationMethodApplicability(profile, 'REVERSE_DCF');
    val01Applicable = v.applicable;
    val01Reasons.push(...v.reasons);
  } else if (method === 'COMPARABLE_MULTIPLES' || method === 'RELATIVE_VALUATION') {
    const v = evaluateValuationMethodApplicability(profile, 'COMPARABLE_MULTIPLES');
    val01Applicable = v.applicable;
    val01Reasons.push(...v.reasons);
  } else {
    val01Reasons.push('market_implied_expectations_lane');
  }

  const char = marketReferencedCharacteristicAdjustments(method, profile.characteristicTags, profile);
  const economicallyValid =
    val01Applicable && char.scoreDelta > -0.8 && baseApplicabilityScore(val01Applicable, char.scoreDelta) >= 0.12;

  return Object.freeze({
    method,
    lane: 'MARKET_REFERENCED',
    economicallyValid,
    applicabilityScore: baseApplicabilityScore(val01Applicable, char.scoreDelta),
    reasons: Object.freeze([...val01Reasons, ...char.reasons]),
    characteristicDrivers: char.drivers,
  });
}

export function inferCharacteristicTags(profile: EnsembleCompanyCharacteristics): readonly CompanyCharacteristicTag[] {
  if (profile.characteristicTags.length > 0) {
    return profile.characteristicTags;
  }
  const inferred: CompanyCharacteristicTag[] = ['STANDARD_OPERATING'];
  if (profile.paysRegularDividend) inferred.push('MATURE_DIVIDEND_PAYER');
  if (profile.reportingSegments >= 2) inferred.push('CONGLOMERATE');
  if (profile.isLossMaking && profile.isHighGrowth) inferred.push('LOSS_MAKING_HIGH_GROWTH');
  if (profile.assetIntensityScore >= 0.65) inferred.push('RESOURCE_ASSET_HEAVY');
  return Object.freeze(inferred);
}
