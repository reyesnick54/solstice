import type { ClaimType } from '../../../../productive/types.ts';
import type { RealEstateFactType, RealEstateIndependenceClass, RealEstateSourceClass } from './types.ts';
import { REAL_ESTATE_FABRIC_SCHEMA_VERSION } from './types.ts';

export type RealEstateSourceProfile = {
  readonly schemaVersion: typeof REAL_ESTATE_FABRIC_SCHEMA_VERSION;
  readonly sourceClass: RealEstateSourceClass;
  readonly allowedFactTypes: readonly RealEstateFactType[];
  readonly defaultClaimType: ClaimType | null;
  readonly createsUsageEvent: boolean;
  readonly createsCapacityReference: boolean;
  readonly mayBeIndependentOrganization: boolean;
  readonly namedProviderIntegration: false;
};

function profile(
  sourceClass: RealEstateSourceClass,
  allowedFactTypes: readonly RealEstateFactType[],
  flags: {
    readonly defaultClaimType: ClaimType | null;
    readonly createsUsageEvent: boolean;
    readonly createsCapacityReference: boolean;
    readonly mayBeIndependentOrganization: boolean;
  },
): RealEstateSourceProfile {
  return Object.freeze({
    schemaVersion: REAL_ESTATE_FABRIC_SCHEMA_VERSION,
    sourceClass,
    allowedFactTypes,
    defaultClaimType: flags.defaultClaimType,
    createsUsageEvent: flags.createsUsageEvent,
    createsCapacityReference: flags.createsCapacityReference,
    mayBeIndependentOrganization: flags.mayBeIndependentOrganization,
    namedProviderIntegration: false,
  });
}

export const REAL_ESTATE_SOURCE_PROFILES: Readonly<Record<RealEstateSourceClass, RealEstateSourceProfile>> =
  Object.freeze({
    PROPERTY_MANAGEMENT_SYSTEM: profile('PROPERTY_MANAGEMENT_SYSTEM', ['REAL_ESTATE_USAGE', 'REAL_ESTATE_USE_CAPACITY'], {
      defaultClaimType: 'USAGE',
      createsUsageEvent: true,
      createsCapacityReference: true,
      mayBeIndependentOrganization: false,
    }),
    SPACE_BOOKING_SYSTEM: profile('SPACE_BOOKING_SYSTEM', ['REAL_ESTATE_USAGE'], {
      defaultClaimType: 'USAGE',
      createsUsageEvent: true,
      createsCapacityReference: false,
      mayBeIndependentOrganization: false,
    }),
    BUILDING_MANAGEMENT_SYSTEM: profile('BUILDING_MANAGEMENT_SYSTEM', ['REAL_ESTATE_USAGE', 'REAL_ESTATE_USE_CAPACITY'], {
      defaultClaimType: 'USAGE',
      createsUsageEvent: true,
      createsCapacityReference: true,
      mayBeIndependentOrganization: false,
    }),
    LEASE_ADMINISTRATION_REFERENCE: profile('LEASE_ADMINISTRATION_REFERENCE', ['REAL_ESTATE_USE_CAPACITY'], {
      defaultClaimType: 'CAPACITY',
      createsUsageEvent: false,
      createsCapacityReference: true,
      mayBeIndependentOrganization: false,
    }),
    AGGREGATE_ACCESS_CONTROL: profile('AGGREGATE_ACCESS_CONTROL', ['REAL_ESTATE_USAGE'], {
      defaultClaimType: 'USAGE',
      createsUsageEvent: true,
      createsCapacityReference: false,
      mayBeIndependentOrganization: false,
    }),
    COWORKING_USAGE_SYSTEM: profile('COWORKING_USAGE_SYSTEM', ['REAL_ESTATE_USAGE'], {
      defaultClaimType: 'USAGE',
      createsUsageEvent: true,
      createsCapacityReference: false,
      mayBeIndependentOrganization: false,
    }),
    INDUSTRIAL_FACILITY_UTILIZATION: profile('INDUSTRIAL_FACILITY_UTILIZATION', ['REAL_ESTATE_USAGE', 'REAL_ESTATE_USE_CAPACITY'], {
      defaultClaimType: 'USAGE',
      createsUsageEvent: true,
      createsCapacityReference: true,
      mayBeIndependentOrganization: false,
    }),
    COMMERCIAL_SPACE_METER: profile('COMMERCIAL_SPACE_METER', ['REAL_ESTATE_USAGE', 'REAL_ESTATE_USE_CAPACITY'], {
      defaultClaimType: 'USAGE',
      createsUsageEvent: true,
      createsCapacityReference: true,
      mayBeIndependentOrganization: false,
    }),
    WAREHOUSE_SPACE_REFERENCE: profile('WAREHOUSE_SPACE_REFERENCE', ['REAL_ESTATE_USE_CAPACITY'], {
      defaultClaimType: 'CAPACITY',
      createsUsageEvent: false,
      createsCapacityReference: true,
      mayBeIndependentOrganization: false,
    }),
    INDEPENDENT_OCCUPANCY_ATTESTATION: profile('INDEPENDENT_OCCUPANCY_ATTESTATION', ['REAL_ESTATE_USAGE'], {
      defaultClaimType: 'USAGE',
      createsUsageEvent: true,
      createsCapacityReference: false,
      mayBeIndependentOrganization: true,
    }),
  });

export function profileFor(sourceClass: RealEstateSourceClass): RealEstateSourceProfile {
  return REAL_ESTATE_SOURCE_PROFILES[sourceClass];
}

export function classifyRealEstateIndependence(input: {
  readonly sourceClass: RealEstateSourceClass;
  readonly controllerId: string;
  readonly upstreamOrganizationId: string;
  readonly related: readonly { readonly controllerId: string; readonly upstreamOrganizationId: string }[];
}): RealEstateIndependenceClass {
  if (input.related.some((row) => row.controllerId === input.controllerId)) {
    return 'SAME_CONTROLLER';
  }
  if (input.related.some((row) => row.upstreamOrganizationId === input.upstreamOrganizationId)) {
    return 'SAME_UPSTREAM_ORGANIZATION';
  }
  return profileFor(input.sourceClass).mayBeIndependentOrganization
    ? 'INDEPENDENT_ORGANIZATION'
    : 'SAME_UPSTREAM_ORGANIZATION';
}
