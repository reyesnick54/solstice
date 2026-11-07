/**
 * HELIOS ALT10 — point-in-time government demand state and feature types.
 */

import type { UtcInstant } from '@solstice/domain';
import type { ProcurementExternalObservation } from '@solstice/external-data';

import type {
  CONTRACT_REVENUE_CONVERSION_SCHEMA,
  HELIOS_PROCUREMENT_DEMAND_SCHEMA,
  ProcurementDemandFeatureId,
  ProcurementNormalizationDenominator,
} from './taxonomy.ts';

export type GovernmentDemandState = {
  readonly schema: typeof HELIOS_PROCUREMENT_DEMAND_SCHEMA;
  readonly decisionTimeUtc: UtcInstant;
  readonly attributionEntityId: string;
  readonly activeAwardCount: number;
  readonly totalAwardCeilingMinor: bigint;
  readonly totalObligatedMinor: bigint;
  readonly totalPaidMinor: bigint;
  readonly agencyExposure: Readonly<Record<string, bigint>>;
  readonly programExposure: Readonly<Record<string, bigint>>;
  readonly modificationCount: number;
  readonly cancellationCount: number;
  readonly backlogRemainingCeilingMinor: bigint | null;
  readonly backlogRemainingObligationMinor: bigint | null;
  readonly currency: string;
  readonly observations: readonly ProcurementExternalObservation[];
  readonly grantsExecutionAuthority: false;
};

export type NormalizedProcurementFeature = {
  readonly featureId: ProcurementDemandFeatureId;
  readonly rawValue: number;
  readonly normalizedBy: readonly ProcurementNormalizationDenominator[];
  readonly companyRevenueRatio: number | null;
  readonly marketCapRatio: number | null;
  readonly existingGovernmentBusinessRatio: number | null;
};

export type GovernmentDemandFeatureSnapshot = {
  readonly schema: typeof HELIOS_PROCUREMENT_DEMAND_SCHEMA;
  readonly decisionTimeUtc: UtcInstant;
  readonly attributionEntityId: string;
  readonly features: readonly NormalizedProcurementFeature[];
  readonly grantsExecutionAuthority: false;
};

/** Revenue estimate derived only from calibrated obligation→revenue history — not ceiling/obligations. */
export type ContractRevenueConversionEstimate = {
  readonly schema: typeof CONTRACT_REVENUE_CONVERSION_SCHEMA;
  readonly attributionEntityId: string;
  readonly calibrationWindowStart: string;
  readonly calibrationWindowEnd: string;
  readonly obligationToRevenueFactor: number;
  readonly estimatedRecognizedRevenueMinor: bigint;
  readonly sourceObligationMinor: bigint;
  readonly currency: string;
  readonly notSourcedFromAwardCeiling: true;
  readonly notSourcedFromObligationAsRevenue: true;
  readonly grantsExecutionAuthority: false;
};

export type ProcurementNormalizationContext = {
  readonly companyRevenueMinor: bigint | null;
  readonly marketCapMinor: bigint | null;
  readonly existingGovernmentBusinessMinor: bigint | null;
  readonly currency: string;
};

export type CompileGovernmentDemandSnapshotInput = {
  readonly attributionEntityId: string;
  readonly decisionTimeUtc: UtcInstant;
  readonly lookbackDays?: number;
  readonly includeParentRollup?: false;
};

export type HistoricalRevenueCalibrationRow = {
  readonly fiscalPeriod: string;
  readonly recognizedRevenueMinor: bigint;
  readonly obligatedMinor: bigint;
};
