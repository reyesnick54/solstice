import type { ClaimType, ProductiveCategory } from '../../../../productive/types.ts';
import type { QualityInputs } from '../../quality.ts';
import { scoreQuality } from '../../quality.ts';
import type { OracleSourceQualityProfile } from '../../types.ts';
import {
  WATER_FABRIC_SCHEMA_VERSION,
  type WaterFactType,
  type WaterIndependenceClass,
  type WaterMeasurementSemantics,
  type WaterQualityInputs,
  type WaterSourceClass,
} from './types.ts';

export type WaterSourceProfile = {
  readonly schemaVersion: typeof WATER_FABRIC_SCHEMA_VERSION;
  readonly sourceClass: WaterSourceClass;
  readonly allowedFactTypes: readonly WaterFactType[];
  readonly defaultSemantics: WaterMeasurementSemantics;
  readonly defaultClaimType: ClaimType | null;
  readonly productiveCategory: ProductiveCategory;
  readonly createsWaterProductionEvent: boolean;
  readonly createsAvailabilityEvidence: boolean;
  readonly isIrrigationInput: boolean;
  readonly isQualityOnly: boolean;
  readonly mayBeIndependentOrganization: boolean;
  readonly namedProviderIntegration: false;
};

function profile(
  sourceClass: WaterSourceClass,
  allowedFactTypes: readonly WaterFactType[],
  defaultSemantics: WaterMeasurementSemantics,
  flags: {
    readonly defaultClaimType: ClaimType | null;
    readonly createsWaterProductionEvent: boolean;
    readonly createsAvailabilityEvidence: boolean;
    readonly isIrrigationInput: boolean;
    readonly isQualityOnly: boolean;
    readonly mayBeIndependentOrganization: boolean;
  },
): WaterSourceProfile {
  return Object.freeze({
    schemaVersion: WATER_FABRIC_SCHEMA_VERSION,
    sourceClass,
    allowedFactTypes,
    defaultSemantics,
    defaultClaimType: flags.defaultClaimType,
    productiveCategory: 'WATER',
    createsWaterProductionEvent: flags.createsWaterProductionEvent,
    createsAvailabilityEvidence: flags.createsAvailabilityEvidence,
    isIrrigationInput: flags.isIrrigationInput,
    isQualityOnly: flags.isQualityOnly,
    mayBeIndependentOrganization: flags.mayBeIndependentOrganization,
    namedProviderIntegration: false,
  });
}

export const WATER_SOURCE_PROFILES: Readonly<Record<WaterSourceClass, WaterSourceProfile>> = Object.freeze({
  WATER_UTILITY_PRODUCTION_METER: profile(
    'WATER_UTILITY_PRODUCTION_METER',
    ['WATER_PRODUCTION'],
    'TREATED_WATER_PRODUCTION',
    {
      defaultClaimType: 'OUTPUT',
      createsWaterProductionEvent: true,
      createsAvailabilityEvidence: false,
      isIrrigationInput: false,
      isQualityOnly: false,
      mayBeIndependentOrganization: false,
    },
  ),
  TREATMENT_PLANT_METER: profile('TREATMENT_PLANT_METER', ['WATER_PRODUCTION'], 'TREATED_WATER_PRODUCTION', {
    defaultClaimType: 'OUTPUT',
    createsWaterProductionEvent: true,
    createsAvailabilityEvidence: false,
    isIrrigationInput: false,
    isQualityOnly: false,
    mayBeIndependentOrganization: false,
  }),
  DESALINATION_PLANT_METER: profile('DESALINATION_PLANT_METER', ['WATER_PRODUCTION'], 'DESALINATED_WATER_PRODUCTION', {
    defaultClaimType: 'OUTPUT',
    createsWaterProductionEvent: true,
    createsAvailabilityEvidence: false,
    isIrrigationInput: false,
    isQualityOnly: false,
    mayBeIndependentOrganization: false,
  }),
  WELL_PRODUCTION_METER: profile('WELL_PRODUCTION_METER', ['WATER_PRODUCTION'], 'RAW_WATER_WITHDRAWAL', {
    defaultClaimType: 'OUTPUT',
    createsWaterProductionEvent: true,
    createsAvailabilityEvidence: false,
    isIrrigationInput: false,
    isQualityOnly: false,
    mayBeIndependentOrganization: false,
  }),
  RESERVOIR_REFERENCE: profile('RESERVOIR_REFERENCE', ['WATER_AVAILABILITY'], 'AVAILABLE_RESERVE', {
    defaultClaimType: 'CAPACITY',
    createsWaterProductionEvent: false,
    createsAvailabilityEvidence: true,
    isIrrigationInput: false,
    isQualityOnly: false,
    mayBeIndependentOrganization: true,
  }),
  AQUIFER_REFERENCE: profile('AQUIFER_REFERENCE', ['WATER_AVAILABILITY'], 'AVAILABLE_RESERVE', {
    defaultClaimType: 'CAPACITY',
    createsWaterProductionEvent: false,
    createsAvailabilityEvidence: true,
    isIrrigationInput: false,
    isQualityOnly: false,
    mayBeIndependentOrganization: true,
  }),
  PUMPING_METER: profile('PUMPING_METER', ['WATER_PRODUCTION'], 'RAW_WATER_WITHDRAWAL', {
    defaultClaimType: 'OUTPUT',
    createsWaterProductionEvent: true,
    createsAvailabilityEvidence: false,
    isIrrigationInput: false,
    isQualityOnly: false,
    mayBeIndependentOrganization: false,
  }),
  INDUSTRIAL_WATER_PLANT: profile('INDUSTRIAL_WATER_PLANT', ['WATER_PRODUCTION'], 'RECYCLED_WATER_PRODUCTION', {
    defaultClaimType: 'OUTPUT',
    createsWaterProductionEvent: true,
    createsAvailabilityEvidence: false,
    isIrrigationInput: false,
    isQualityOnly: false,
    mayBeIndependentOrganization: false,
  }),
  IRRIGATION_METER: profile('IRRIGATION_METER', ['WATER_PRODUCTION'], 'IRRIGATION_CONSUMPTION', {
    defaultClaimType: 'USAGE',
    createsWaterProductionEvent: false,
    createsAvailabilityEvidence: false,
    isIrrigationInput: true,
    isQualityOnly: false,
    mayBeIndependentOrganization: false,
  }),
  WATER_QUALITY_ATTESTATION: profile(
    'WATER_QUALITY_ATTESTATION',
    ['WATER_PRODUCTION', 'WATER_AVAILABILITY'],
    'WATER_QUALITY',
    {
      defaultClaimType: null,
      createsWaterProductionEvent: false,
      createsAvailabilityEvidence: false,
      isIrrigationInput: false,
      isQualityOnly: true,
      mayBeIndependentOrganization: true,
    },
  ),
  INDEPENDENT_WATER_AUDITOR: profile(
    'INDEPENDENT_WATER_AUDITOR',
    ['WATER_PRODUCTION', 'WATER_AVAILABILITY'],
    'TREATED_WATER_PRODUCTION',
    {
      defaultClaimType: 'OUTPUT',
      createsWaterProductionEvent: true,
      createsAvailabilityEvidence: false,
      isIrrigationInput: false,
      isQualityOnly: false,
      mayBeIndependentOrganization: true,
    },
  ),
});

export function profileFor(sourceClass: WaterSourceClass): WaterSourceProfile {
  return WATER_SOURCE_PROFILES[sourceClass];
}

export function classifyWaterIndependence(input: {
  readonly sourceClass: WaterSourceClass;
  readonly controllerId: string;
  readonly upstreamOrganizationId: string;
  readonly sharedControlGroup: string | null;
  readonly related: readonly {
    readonly controllerId: string;
    readonly upstreamOrganizationId: string;
    readonly sharedControlGroup: string | null;
  }[];
}): WaterIndependenceClass {
  const sourceProfile = profileFor(input.sourceClass);
  if (!sourceProfile.mayBeIndependentOrganization) {
    return 'SAME_CONTROLLER';
  }
  for (const other of input.related) {
    if (other.controllerId === input.controllerId) {
      return 'SAME_CONTROLLER';
    }
    if (
      input.sharedControlGroup !== null &&
      other.sharedControlGroup !== null &&
      other.sharedControlGroup === input.sharedControlGroup
    ) {
      return 'SAME_CONTROL_GROUP';
    }
    if (other.upstreamOrganizationId === input.upstreamOrganizationId) {
      return 'SAME_UPSTREAM_ORGANIZATION';
    }
  }
  return 'INDEPENDENT_ORGANIZATION';
}

export function waterQualityToOracleInputs(sourceId: string, inputs: WaterQualityInputs): QualityInputs {
  const schema = Math.min(10_000, Math.floor((inputs.qualityAttestationBps + (inputs.batchIdentityPresent ? 10_000 : 0)) / 2));
  return Object.freeze({
    sourceId,
    freshnessBps: inputs.measurementFreshnessBps,
    availabilityBps: inputs.meterCalibrationBps,
    historicalConflictRateBps: 0,
    schemaValidityBps: schema,
    sourceIndependenceBps: inputs.sourceIndependenceBps,
    attestationLevelBps: inputs.qualityAttestationBps,
    qualityClass: 'ENGINEERING',
  });
}

export function scoreWaterQuality(sourceId: string, inputs: WaterQualityInputs): OracleSourceQualityProfile {
  return scoreQuality(waterQualityToOracleInputs(sourceId, inputs));
}
