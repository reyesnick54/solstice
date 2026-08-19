import type { ClaimType, ProductiveCategory } from '../../../../productive/types.ts';
import type { QualityInputs } from '../../quality.ts';
import { scoreQuality } from '../../quality.ts';
import type { OracleSourceQualityProfile } from '../../types.ts';
import {
  RESOURCE_FABRIC_SCHEMA_VERSION,
  type ResourceFactType,
  type ResourceIndependenceClass,
  type ResourceMeasurementSemantics,
  type ResourceQualityInputs,
  type ResourceSourceClass,
} from './types.ts';

export type ResourceSourceProfile = {
  readonly schemaVersion: typeof RESOURCE_FABRIC_SCHEMA_VERSION;
  readonly sourceClass: ResourceSourceClass;
  readonly allowedFactTypes: readonly ResourceFactType[];
  readonly defaultSemantics: ResourceMeasurementSemantics;
  readonly defaultClaimType: ClaimType | null;
  readonly productiveCategory: ProductiveCategory;
  readonly createsExtractionEvent: boolean;
  readonly createsReserveEstimate: boolean;
  readonly createsInventoryEvidence: boolean;
  readonly isAssayQualityOnly: boolean;
  readonly mayBeIndependentOrganization: boolean;
  readonly namedProviderIntegration: false;
};

const PROFILE = RESOURCE_FABRIC_SCHEMA_VERSION;

function profile(
  sourceClass: ResourceSourceClass,
  allowedFactTypes: readonly ResourceFactType[],
  defaultSemantics: ResourceMeasurementSemantics,
  flags: {
    readonly defaultClaimType: ClaimType | null;
    readonly createsExtractionEvent: boolean;
    readonly createsReserveEstimate: boolean;
    readonly createsInventoryEvidence: boolean;
    readonly isAssayQualityOnly: boolean;
    readonly mayBeIndependentOrganization: boolean;
  },
): ResourceSourceProfile {
  return Object.freeze({
    schemaVersion: PROFILE,
    sourceClass,
    allowedFactTypes,
    defaultSemantics,
    defaultClaimType: flags.defaultClaimType,
    productiveCategory: 'MINERALS_RAW_MATERIALS',
    createsExtractionEvent: flags.createsExtractionEvent,
    createsReserveEstimate: flags.createsReserveEstimate,
    createsInventoryEvidence: flags.createsInventoryEvidence,
    isAssayQualityOnly: flags.isAssayQualityOnly,
    mayBeIndependentOrganization: flags.mayBeIndependentOrganization,
    namedProviderIntegration: false,
  });
}

export const RESOURCE_SOURCE_PROFILES: Readonly<Record<ResourceSourceClass, ResourceSourceProfile>> = Object.freeze({
  MINE_PRODUCTION_SYSTEM: profile('MINE_PRODUCTION_SYSTEM', ['RESOURCE_EXTRACTION'], 'GROSS_EXTRACTED_MASS', {
    defaultClaimType: 'OUTPUT',
    createsExtractionEvent: true,
    createsReserveEstimate: false,
    createsInventoryEvidence: false,
    isAssayQualityOnly: false,
    mayBeIndependentOrganization: false,
  }),
  WEIGHBRIDGE: profile('WEIGHBRIDGE', ['RESOURCE_EXTRACTION'], 'GROSS_EXTRACTED_MASS', {
    defaultClaimType: 'OUTPUT',
    createsExtractionEvent: true,
    createsReserveEstimate: false,
    createsInventoryEvidence: false,
    isAssayQualityOnly: false,
    mayBeIndependentOrganization: false,
  }),
  HAULAGE_TELEMETRY: profile('HAULAGE_TELEMETRY', ['RESOURCE_EXTRACTION'], 'GROSS_EXTRACTED_MASS', {
    defaultClaimType: 'OUTPUT',
    createsExtractionEvent: true,
    createsReserveEstimate: false,
    createsInventoryEvidence: false,
    isAssayQualityOnly: false,
    mayBeIndependentOrganization: false,
  }),
  PROCESS_PLANT_METER: profile('PROCESS_PLANT_METER', ['RESOURCE_EXTRACTION'], 'PROCESSED_CONCENTRATE', {
    defaultClaimType: null,
    createsExtractionEvent: false,
    createsReserveEstimate: false,
    createsInventoryEvidence: false,
    isAssayQualityOnly: false,
    mayBeIndependentOrganization: false,
  }),
  INVENTORY_STOCKPILE_SYSTEM: profile('INVENTORY_STOCKPILE_SYSTEM', ['RESOURCE_EXTRACTION'], 'STOCKPILE_INVENTORY_MASS', {
    defaultClaimType: null,
    createsExtractionEvent: false,
    createsReserveEstimate: false,
    createsInventoryEvidence: true,
    isAssayQualityOnly: false,
    mayBeIndependentOrganization: false,
  }),
  ASSAY_LAB_ATTESTATION: profile('ASSAY_LAB_ATTESTATION', ['RESOURCE_EXTRACTION', 'RESOURCE_RESERVE'], 'ASSAY_GRADE_QUALITY', {
    defaultClaimType: null,
    createsExtractionEvent: false,
    createsReserveEstimate: false,
    createsInventoryEvidence: false,
    isAssayQualityOnly: true,
    mayBeIndependentOrganization: true,
  }),
  RESOURCE_SURVEY: profile('RESOURCE_SURVEY', ['RESOURCE_RESERVE'], 'RESERVE_ESTIMATE_MASS', {
    defaultClaimType: 'RESERVE',
    createsExtractionEvent: false,
    createsReserveEstimate: true,
    createsInventoryEvidence: false,
    isAssayQualityOnly: false,
    mayBeIndependentOrganization: true,
  }),
  RESERVE_REPORT_REFERENCE: profile('RESERVE_REPORT_REFERENCE', ['RESOURCE_RESERVE'], 'RESERVE_ESTIMATE_MASS', {
    defaultClaimType: 'RESERVE',
    createsExtractionEvent: false,
    createsReserveEstimate: true,
    createsInventoryEvidence: false,
    isAssayQualityOnly: false,
    mayBeIndependentOrganization: true,
  }),
  REGULATORY_PRODUCTION_REFERENCE: profile(
    'REGULATORY_PRODUCTION_REFERENCE',
    ['RESOURCE_EXTRACTION', 'RESOURCE_RESERVE'],
    'GROSS_EXTRACTED_MASS',
    {
      defaultClaimType: 'OUTPUT',
      createsExtractionEvent: true,
      createsReserveEstimate: false,
      createsInventoryEvidence: false,
      isAssayQualityOnly: false,
      mayBeIndependentOrganization: true,
    },
  ),
  INDEPENDENT_AUDITOR_ATTESTATION: profile(
    'INDEPENDENT_AUDITOR_ATTESTATION',
    ['RESOURCE_EXTRACTION', 'RESOURCE_RESERVE'],
    'GROSS_EXTRACTED_MASS',
    {
      defaultClaimType: 'OUTPUT',
      createsExtractionEvent: true,
      createsReserveEstimate: false,
      createsInventoryEvidence: false,
      isAssayQualityOnly: false,
      mayBeIndependentOrganization: true,
    },
  ),
});

export function profileFor(sourceClass: ResourceSourceClass): ResourceSourceProfile {
  return RESOURCE_SOURCE_PROFILES[sourceClass];
}

/**
 * Mine telemetry + mine ERP + mine weighbridge under one controller are
 * not independent organizations. Independent assay/audit/regulatory data
 * may be independent only when the controller and upstream organization
 * actually differ.
 */
export function classifyResourceIndependence(input: {
  readonly sourceClass: ResourceSourceClass;
  readonly controllerId: string;
  readonly upstreamOrganizationId: string;
  readonly related: readonly { readonly controllerId: string; readonly upstreamOrganizationId: string }[];
}): ResourceIndependenceClass {
  const profile = profileFor(input.sourceClass);
  if (!profile.mayBeIndependentOrganization) {
    return 'SAME_CONTROLLER';
  }
  for (const other of input.related) {
    if (other.controllerId === input.controllerId) {
      return 'SAME_CONTROLLER';
    }
    if (other.upstreamOrganizationId === input.upstreamOrganizationId) {
      return 'SAME_UPSTREAM_ORGANIZATION';
    }
  }
  return 'INDEPENDENT_ORGANIZATION';
}

/**
 * Resource-specific quality considerations feed the existing oracle
 * quality formula. This is not a second opaque quality score.
 */
export function resourceQualityToOracleInputs(
  sourceId: string,
  inputs: ResourceQualityInputs,
): QualityInputs {
  const independence = inputs.sourceIndependenceBps;
  const attestation = Math.min(
    10_000,
    Math.floor((inputs.scaleCalibrationBps + inputs.assayProvenanceBps) / 2),
  );
  const schema = Math.min(
    10_000,
    Math.floor(
      (inputs.samplingMethodologyBps + (inputs.batchIdentityPresent ? 10_000 : 0) + inputs.stockpileReconciliationBps) /
        3,
    ),
  );
  return Object.freeze({
    sourceId,
    freshnessBps: inputs.measurementFreshnessBps,
    availabilityBps: inputs.stockpileReconciliationBps,
    historicalConflictRateBps: 0,
    schemaValidityBps: schema,
    sourceIndependenceBps: independence,
    attestationLevelBps: attestation,
    qualityClass: 'ENGINEERING',
  });
}

export function scoreResourceQuality(sourceId: string, inputs: ResourceQualityInputs): OracleSourceQualityProfile {
  return scoreQuality(resourceQualityToOracleInputs(sourceId, inputs));
}
