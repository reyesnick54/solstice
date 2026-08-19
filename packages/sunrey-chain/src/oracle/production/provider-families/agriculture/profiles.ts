import type { ClaimType, ProductiveCategory } from '../../../../productive/types.ts';
import type { QualityInputs } from '../../quality.ts';
import { scoreQuality } from '../../quality.ts';
import type { OracleSourceQualityProfile } from '../../types.ts';
import {
  AGRICULTURE_FABRIC_SCHEMA_VERSION,
  type AgricultureFactType,
  type AgricultureIndependenceClass,
  type AgricultureMeasurementSemantics,
  type AgricultureQualityInputs,
  type AgricultureSourceClass,
} from './types.ts';

export type AgricultureSourceProfile = {
  readonly schemaVersion: typeof AGRICULTURE_FABRIC_SCHEMA_VERSION;
  readonly sourceClass: AgricultureSourceClass;
  readonly allowedFactTypes: readonly AgricultureFactType[];
  readonly defaultSemantics: AgricultureMeasurementSemantics;
  readonly defaultClaimType: ClaimType | null;
  readonly productiveCategory: ProductiveCategory;
  readonly createsHarvestEvent: boolean;
  readonly createsInventoryEvidence: boolean;
  readonly isQualityOnly: boolean;
  readonly mayBeIndependentOrganization: boolean;
  readonly namedProviderIntegration: false;
};

const PROFILE = AGRICULTURE_FABRIC_SCHEMA_VERSION;

function profile(
  sourceClass: AgricultureSourceClass,
  allowedFactTypes: readonly AgricultureFactType[],
  defaultSemantics: AgricultureMeasurementSemantics,
  flags: {
    readonly defaultClaimType: ClaimType | null;
    readonly createsHarvestEvent: boolean;
    readonly createsInventoryEvidence: boolean;
    readonly isQualityOnly: boolean;
    readonly mayBeIndependentOrganization: boolean;
  },
): AgricultureSourceProfile {
  return Object.freeze({
    schemaVersion: PROFILE,
    sourceClass,
    allowedFactTypes,
    defaultSemantics,
    defaultClaimType: flags.defaultClaimType,
    productiveCategory: 'FOOD_AGRICULTURE',
    createsHarvestEvent: flags.createsHarvestEvent,
    createsInventoryEvidence: flags.createsInventoryEvidence,
    isQualityOnly: flags.isQualityOnly,
    mayBeIndependentOrganization: flags.mayBeIndependentOrganization,
    namedProviderIntegration: false,
  });
}

export const AGRICULTURE_SOURCE_PROFILES: Readonly<Record<AgricultureSourceClass, AgricultureSourceProfile>> =
  Object.freeze({
    FARM_MANAGEMENT_SYSTEM: profile('FARM_MANAGEMENT_SYSTEM', ['FOOD_PRODUCTION', 'AGRICULTURAL_OUTPUT'], 'HARVESTED', {
      defaultClaimType: 'OUTPUT',
      createsHarvestEvent: true,
      createsInventoryEvidence: false,
      isQualityOnly: false,
      mayBeIndependentOrganization: false,
    }),
    HARVEST_METER: profile('HARVEST_METER', ['FOOD_PRODUCTION', 'AGRICULTURAL_OUTPUT'], 'HARVESTED', {
      defaultClaimType: 'OUTPUT',
      createsHarvestEvent: true,
      createsInventoryEvidence: false,
      isQualityOnly: false,
      mayBeIndependentOrganization: false,
    }),
    GRAIN_SCALE: profile('GRAIN_SCALE', ['FOOD_PRODUCTION', 'AGRICULTURAL_OUTPUT'], 'HARVESTED', {
      defaultClaimType: 'OUTPUT',
      createsHarvestEvent: true,
      createsInventoryEvidence: false,
      isQualityOnly: false,
      mayBeIndependentOrganization: false,
    }),
    PACKHOUSE_SYSTEM: profile('PACKHOUSE_SYSTEM', ['FOOD_PRODUCTION', 'AGRICULTURAL_OUTPUT'], 'ACCEPTED_OUTPUT', {
      defaultClaimType: 'OUTPUT',
      createsHarvestEvent: true,
      createsInventoryEvidence: false,
      isQualityOnly: false,
      mayBeIndependentOrganization: false,
    }),
    AGRICULTURAL_EQUIPMENT_TELEMETRY: profile(
      'AGRICULTURAL_EQUIPMENT_TELEMETRY',
      ['FOOD_PRODUCTION', 'AGRICULTURAL_OUTPUT'],
      'HARVESTED',
      {
        defaultClaimType: 'OUTPUT',
        createsHarvestEvent: true,
        createsInventoryEvidence: false,
        isQualityOnly: false,
        mayBeIndependentOrganization: false,
      },
    ),
    SILO_INVENTORY_SYSTEM: profile('SILO_INVENTORY_SYSTEM', ['FOOD_PRODUCTION', 'AGRICULTURAL_OUTPUT'], 'INVENTORY', {
      defaultClaimType: null,
      createsHarvestEvent: false,
      createsInventoryEvidence: true,
      isQualityOnly: false,
      mayBeIndependentOrganization: false,
    }),
    COOPERATIVE_PRODUCTION_LEDGER: profile(
      'COOPERATIVE_PRODUCTION_LEDGER',
      ['FOOD_PRODUCTION', 'AGRICULTURAL_OUTPUT'],
      'ACCEPTED_OUTPUT',
      {
        defaultClaimType: 'OUTPUT',
        createsHarvestEvent: true,
        createsInventoryEvidence: false,
        isQualityOnly: false,
        mayBeIndependentOrganization: true,
      },
    ),
    DAIRY_PRODUCTION_METER: profile('DAIRY_PRODUCTION_METER', ['FOOD_PRODUCTION', 'AGRICULTURAL_OUTPUT'], 'HARVESTED', {
      defaultClaimType: 'OUTPUT',
      createsHarvestEvent: true,
      createsInventoryEvidence: false,
      isQualityOnly: false,
      mayBeIndependentOrganization: false,
    }),
    GREENHOUSE_PRODUCTION_SYSTEM: profile(
      'GREENHOUSE_PRODUCTION_SYSTEM',
      ['FOOD_PRODUCTION', 'AGRICULTURAL_OUTPUT'],
      'HARVESTED',
      {
        defaultClaimType: 'OUTPUT',
        createsHarvestEvent: true,
        createsInventoryEvidence: false,
        isQualityOnly: false,
        mayBeIndependentOrganization: false,
      },
    ),
    AQUACULTURE_PRODUCTION_SYSTEM: profile(
      'AQUACULTURE_PRODUCTION_SYSTEM',
      ['FOOD_PRODUCTION', 'AGRICULTURAL_OUTPUT'],
      'HARVESTED',
      {
        defaultClaimType: 'OUTPUT',
        createsHarvestEvent: true,
        createsInventoryEvidence: false,
        isQualityOnly: false,
        mayBeIndependentOrganization: false,
      },
    ),
    INDEPENDENT_AGRICULTURAL_ATTESTATION: profile(
      'INDEPENDENT_AGRICULTURAL_ATTESTATION',
      ['FOOD_PRODUCTION', 'AGRICULTURAL_OUTPUT'],
      'HARVESTED',
      {
        defaultClaimType: 'OUTPUT',
        createsHarvestEvent: true,
        createsInventoryEvidence: false,
        isQualityOnly: false,
        mayBeIndependentOrganization: true,
      },
    ),
    REGULATORY_AGRICULTURAL_REFERENCE: profile(
      'REGULATORY_AGRICULTURAL_REFERENCE',
      ['FOOD_PRODUCTION', 'AGRICULTURAL_OUTPUT'],
      'HARVESTED',
      {
        defaultClaimType: 'OUTPUT',
        createsHarvestEvent: true,
        createsInventoryEvidence: false,
        isQualityOnly: false,
        mayBeIndependentOrganization: true,
      },
    ),
  });

export function profileFor(sourceClass: AgricultureSourceClass): AgricultureSourceProfile {
  return AGRICULTURE_SOURCE_PROFILES[sourceClass];
}

/**
 * Farm management + farm-owned scale + farm-owned equipment telemetry
 * are not independent organizations. Cooperative / regulatory / audit
 * sources may be independent only when controller, upstream organization,
 * and shared control group actually differ.
 */
export function classifyAgricultureIndependence(input: {
  readonly sourceClass: AgricultureSourceClass;
  readonly controllerId: string;
  readonly upstreamOrganizationId: string;
  readonly sharedControlGroup: string | null;
  readonly related: readonly {
    readonly controllerId: string;
    readonly upstreamOrganizationId: string;
    readonly sharedControlGroup: string | null;
  }[];
}): AgricultureIndependenceClass {
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

export function agricultureQualityToOracleInputs(
  sourceId: string,
  inputs: AgricultureQualityInputs,
): QualityInputs {
  const schema = Math.min(10_000, Math.floor((inputs.qualityAttestationBps + (inputs.batchIdentityPresent ? 10_000 : 0)) / 2));
  return Object.freeze({
    sourceId,
    freshnessBps: inputs.measurementFreshnessBps,
    availabilityBps: inputs.scaleCalibrationBps,
    historicalConflictRateBps: 0,
    schemaValidityBps: schema,
    sourceIndependenceBps: inputs.sourceIndependenceBps,
    attestationLevelBps: inputs.qualityAttestationBps,
    qualityClass: 'ENGINEERING',
  });
}

export function scoreAgricultureQuality(sourceId: string, inputs: AgricultureQualityInputs): OracleSourceQualityProfile {
  return scoreQuality(agricultureQualityToOracleInputs(sourceId, inputs));
}
