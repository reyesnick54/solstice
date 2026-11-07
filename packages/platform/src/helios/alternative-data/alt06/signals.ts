import type { UtcInstant } from '@solstice/domain';
import type { AvailabilityObservation, PriceObservation, PromotionObservation } from '@solstice/external-data';

import type { EmpiricalCalibrationSnapshot } from './types.ts';
import type { Alt06ComputedFeature, DemandSupplyImbalanceState, PricingPowerSignal } from './types.ts';

function relativeDemandProxyMinor(input: {
  readonly availability: readonly AvailabilityObservation[];
  readonly promotions: readonly PromotionObservation[];
  readonly evaluationTime: UtcInstant;
}): bigint | null {
  const knowableAvail = input.availability.filter(
    (row) => Date.parse(row.provenance.knowableAt) <= Date.parse(input.evaluationTime),
  );
  if (knowableAvail.length < 2) {
    return null;
  }
  const sorted = [...knowableAvail].sort(
    (a, b) => Date.parse(a.provenance.knowableAt) - Date.parse(b.provenance.knowableAt),
  );
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  const firstUnits = first.unitsAvailable ?? 0;
  const lastUnits = last.unitsAvailable ?? 0;
  const unitDelta = lastUnits - firstUnits;
  const promoPressure = input.promotions.filter(
    (row) => Date.parse(row.provenance.knowableAt) <= Date.parse(input.evaluationTime),
  ).length;
  return BigInt(unitDelta * 100 + promoPressure * -25);
}

export function derivePricingPowerSignal(input: {
  readonly skuEntityId: string;
  readonly evaluationTime: UtcInstant;
  readonly features: readonly Alt06ComputedFeature[];
  readonly prices: readonly PriceObservation[];
  readonly availability: readonly AvailabilityObservation[];
  readonly promotions: readonly PromotionObservation[];
  readonly calibration: EmpiricalCalibrationSnapshot;
}): PricingPowerSignal {
  const priceChange = input.features.find((row) => row.featureId === 'alt06.price_change');
  const availabilityFeature = input.features.find((row) => row.featureId === 'alt06.stock_availability');
  const relCompetitor = input.features.find((row) => row.featureId === 'alt06.relative_price_vs_competitor');

  const knowablePrices = input.prices
    .filter(
      (row) =>
        row.skuEntityId === input.skuEntityId &&
        Date.parse(row.provenance.knowableAt) <= Date.parse(input.evaluationTime),
    )
    .sort((a, b) => Date.parse(a.provenance.knowableAt) - Date.parse(b.provenance.knowableAt));

  const priceIncreaseBps = priceChange?.valueMinor != null ? Number(priceChange.valueMinor) : null;
  const availabilityScoreMinor = availabilityFeature?.valueMinor ?? null;
  const competitorPriceDeltaBps = relCompetitor?.valueMinor != null ? Number(relCompetitor.valueMinor) : null;
  const demandProxy = relativeDemandProxyMinor({
    availability: input.availability.filter((row) => row.skuEntityId === input.skuEntityId),
    promotions: input.promotions.filter((row) => row.skuEntityId === input.skuEntityId),
    evaluationTime: input.evaluationTime,
  });

  const knowableAt =
    knowablePrices[knowablePrices.length - 1]?.provenance.knowableAt ?? input.evaluationTime;

  const observationRefs = Object.freeze([
    ...knowablePrices.map((row) => row.priceObservationId),
    ...input.availability.map((row) => row.availabilityObservationId),
    ...input.promotions.map((row) => row.promotionObservationId),
  ]);

  const calibrated =
    knowablePrices.length >= input.calibration.minObservations &&
    priceIncreaseBps !== null &&
    availabilityScoreMinor !== null &&
    demandProxy !== null &&
    competitorPriceDeltaBps !== null;

  if (!calibrated) {
    return Object.freeze({
      signalKind: 'insufficient_evidence',
      skuEntityId: input.skuEntityId,
      evaluationTime: input.evaluationTime,
      knowableAt,
      priceIncreaseBps,
      relativeDemandProxyMinor: demandProxy,
      availabilityScoreMinor,
      competitorPriceDeltaBps,
      calibrated: false,
      observationRefs,
      grantsExecutionAuthority: false,
    });
  }

  if (
    (priceIncreaseBps ?? 0) >= input.calibration.priceIncreaseBpsThreshold &&
    (availabilityScoreMinor ?? 0n) >= 40n &&
    demandProxy !== null &&
    competitorPriceDeltaBps !== null
  ) {
    return Object.freeze({
      signalKind: 'empirical_pricing_power',
      skuEntityId: input.skuEntityId,
      evaluationTime: input.evaluationTime,
      knowableAt,
      priceIncreaseBps,
      relativeDemandProxyMinor: demandProxy,
      availabilityScoreMinor,
      competitorPriceDeltaBps,
      calibrated: true,
      observationRefs,
      grantsExecutionAuthority: false,
    });
  }

  if ((priceIncreaseBps ?? 0) >= input.calibration.priceIncreaseBpsThreshold && demandProxy === null) {
    return Object.freeze({
      signalKind: 'price_increase_only_rejected',
      skuEntityId: input.skuEntityId,
      evaluationTime: input.evaluationTime,
      knowableAt,
      priceIncreaseBps,
      relativeDemandProxyMinor: demandProxy,
      availabilityScoreMinor,
      competitorPriceDeltaBps,
      calibrated: false,
      observationRefs,
      grantsExecutionAuthority: false,
    });
  }

  return Object.freeze({
    signalKind: 'insufficient_evidence',
    skuEntityId: input.skuEntityId,
    evaluationTime: input.evaluationTime,
    knowableAt,
    priceIncreaseBps,
    relativeDemandProxyMinor: demandProxy,
    availabilityScoreMinor,
    competitorPriceDeltaBps,
    calibrated: false,
    observationRefs,
    grantsExecutionAuthority: false,
  });
}

export function deriveDemandSupplyImbalanceState(input: {
  readonly skuEntityId: string;
  readonly evaluationTime: UtcInstant;
  readonly features: readonly Alt06ComputedFeature[];
  readonly promotions: readonly PromotionObservation[];
  readonly calibration: EmpiricalCalibrationSnapshot;
}): DemandSupplyImbalanceState {
  const priceChange = input.features.find((row) => row.featureId === 'alt06.price_change');
  const availability = input.features.find((row) => row.featureId === 'alt06.stock_availability');
  const discountDepth = input.features.find((row) => row.featureId === 'alt06.discount_depth');
  const promoFreq = input.features.find((row) => row.featureId === 'alt06.promotion_frequency');

  const knowablePromos = input.promotions.filter(
    (row) =>
      row.skuEntityId === input.skuEntityId &&
      Date.parse(row.provenance.knowableAt) <= Date.parse(input.evaluationTime),
  );
  const clearance = knowablePromos.some((row) => row.promotionKind === 'clearance');

  const demandProxyFeature = input.features.find((row) => row.featureId === 'alt06.stockout_frequency');
  const empiricallyCalibrated =
    priceChange?.quality === 'VALID' &&
    availability?.quality === 'VALID' &&
    knowablePromos.length >= input.calibration.minObservations;

  const knowableAt = availability?.knowableAt ?? input.evaluationTime;

  if (!empiricallyCalibrated) {
    return Object.freeze({
      imbalanceKind: 'insufficient_calibration',
      skuEntityId: input.skuEntityId,
      evaluationTime: input.evaluationTime,
      knowableAt,
      hypothesis: 'Awaiting minimum calibrated observation window.',
      empiricallyCalibrated: false,
      supportingFeatureIds: Object.freeze(['alt06.price_change', 'alt06.stock_availability']),
      grantsExecutionAuthority: false,
    });
  }

  const priceUp = (priceChange?.valueMinor ?? 0n) > 0n;
  const availabilityFalling = (availability?.valueMinor ?? 100n) < 60n;
  const promoHeavy =
    clearance ||
    (discountDepth?.valueMinor ?? 0n) >= BigInt(input.calibration.promotionClearanceBpsThreshold) ||
    (promoFreq?.valueMinor ?? 0n) >= 20_000n;

  if (priceUp && availabilityFalling && (demandProxyFeature?.valueMinor ?? 0n) <= 2_000n) {
    return Object.freeze({
      imbalanceKind: 'rising_demand_declining_availability',
      skuEntityId: input.skuEntityId,
      evaluationTime: input.evaluationTime,
      knowableAt,
      hypothesis: 'Shelf tightness with sequential price lift — demand pressure hypothesis (calibrated fixture).',
      empiricallyCalibrated: true,
      supportingFeatureIds: Object.freeze([
        'alt06.price_change',
        'alt06.stock_availability',
        'alt06.stockout_frequency',
      ]),
      grantsExecutionAuthority: false,
    });
  }

  if (promoHeavy && (availability?.valueMinor ?? 0n) >= 40n) {
    return Object.freeze({
      imbalanceKind: 'promotion_heavy_inventory_clearing',
      skuEntityId: input.skuEntityId,
      evaluationTime: input.evaluationTime,
      knowableAt,
      hypothesis: 'Promotion-heavy clearing with ample on-hand units (calibrated fixture).',
      empiricallyCalibrated: true,
      supportingFeatureIds: Object.freeze(['alt06.discount_depth', 'alt06.promotion_frequency']),
      grantsExecutionAuthority: false,
    });
  }

  if (priceUp && (availability?.valueMinor ?? 0n) >= 40n) {
    return Object.freeze({
      imbalanceKind: 'price_increase_stable_availability',
      skuEntityId: input.skuEntityId,
      evaluationTime: input.evaluationTime,
      knowableAt,
      hypothesis: 'Price increase with stable shelf availability (calibrated fixture).',
      empiricallyCalibrated: true,
      supportingFeatureIds: Object.freeze(['alt06.price_change', 'alt06.stock_availability']),
      grantsExecutionAuthority: false,
    });
  }

  return Object.freeze({
    imbalanceKind: 'insufficient_calibration',
    skuEntityId: input.skuEntityId,
    evaluationTime: input.evaluationTime,
    knowableAt,
    hypothesis: 'Observations do not meet calibrated imbalance templates.',
    empiricallyCalibrated: false,
    supportingFeatureIds: Object.freeze([]),
    grantsExecutionAuthority: false,
  });
}
