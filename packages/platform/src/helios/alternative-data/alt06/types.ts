import type { UtcInstant } from '@solstice/domain';
import type {
  AssortmentObservation,
  AvailabilityObservation,
  PriceObservation,
  PromotionObservation,
  SkuEntity,
} from '@solstice/external-data';

import type {
  ALT06_FORMULA_VERSION,
  Alt06FeatureId,
  DemandSupplyImbalanceKind,
  HELIOS_ALT06_PRODUCT_DEMAND_PLANE_SCHEMA,
  PricingPowerSignalKind,
} from './taxonomy.ts';

export type Alt06FeatureQuality = 'VALID' | 'DEGRADED_STALE' | 'DEGRADED_MISSING_INPUT' | 'UNAVAILABLE';

export type Alt06ComputedFeature = {
  readonly featureId: Alt06FeatureId;
  readonly formulaVersion: typeof ALT06_FORMULA_VERSION;
  readonly skuEntityId: string;
  readonly valueMinor: bigint | null;
  readonly valueText: string | null;
  readonly knowableAt: UtcInstant;
  readonly quality: Alt06FeatureQuality;
  readonly observationRefs: readonly string[];
  readonly grantsExecutionAuthority: false;
};

export type EmpiricalCalibrationSnapshot = {
  readonly calibrationId: string;
  readonly trainedFromFixture: string;
  readonly minObservations: number;
  readonly priceIncreaseBpsThreshold: number;
  readonly availabilityDeclineThreshold: number;
  readonly promotionClearanceBpsThreshold: number;
  readonly sealedAt: UtcInstant;
};

export type PricingPowerSignal = {
  readonly signalKind: PricingPowerSignalKind;
  readonly skuEntityId: string;
  readonly evaluationTime: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly priceIncreaseBps: number | null;
  readonly relativeDemandProxyMinor: bigint | null;
  readonly availabilityScoreMinor: bigint | null;
  readonly competitorPriceDeltaBps: number | null;
  readonly calibrated: boolean;
  readonly observationRefs: readonly string[];
  readonly grantsExecutionAuthority: false;
};

export type DemandSupplyImbalanceState = {
  readonly imbalanceKind: DemandSupplyImbalanceKind;
  readonly skuEntityId: string;
  readonly evaluationTime: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly hypothesis: string;
  readonly empiricallyCalibrated: boolean;
  readonly supportingFeatureIds: readonly Alt06FeatureId[];
  readonly grantsExecutionAuthority: false;
};

export type Alt06ProductDemandFeaturePlane = {
  readonly schema: typeof HELIOS_ALT06_PRODUCT_DEMAND_PLANE_SCHEMA;
  readonly evaluationTime: UtcInstant;
  readonly skuEntityId: string;
  readonly features: readonly Alt06ComputedFeature[];
  readonly pricingPower: PricingPowerSignal | null;
  readonly demandSupplyImbalance: DemandSupplyImbalanceState | null;
  readonly calibration: EmpiricalCalibrationSnapshot;
  readonly grantsExecutionAuthority: false;
};

export type Alt06ObservationStoreSnapshot = {
  readonly skus: readonly SkuEntity[];
  readonly prices: readonly PriceObservation[];
  readonly availability: readonly AvailabilityObservation[];
  readonly promotions: readonly PromotionObservation[];
  readonly assortments: readonly AssortmentObservation[];
};
