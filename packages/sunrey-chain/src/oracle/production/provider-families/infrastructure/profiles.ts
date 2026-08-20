import type { ClaimType } from '../../../../productive/types.ts';
import type {
  InfrastructureFactType,
  InfrastructureIndependenceClass,
  InfrastructureSourceClass,
} from './types.ts';
import { INFRASTRUCTURE_FABRIC_SCHEMA_VERSION } from './types.ts';

export type InfrastructureSourceProfile = {
  readonly schemaVersion: typeof INFRASTRUCTURE_FABRIC_SCHEMA_VERSION;
  readonly sourceClass: InfrastructureSourceClass;
  readonly allowedFactTypes: readonly InfrastructureFactType[];
  readonly defaultClaimType: ClaimType | null;
  readonly createsUsageEvent: boolean;
  readonly createsCapacityReference: boolean;
  readonly mayBeIndependentOrganization: boolean;
  readonly namedProviderIntegration: false;
};

function profile(
  sourceClass: InfrastructureSourceClass,
  allowedFactTypes: readonly InfrastructureFactType[],
  flags: {
    readonly defaultClaimType: ClaimType | null;
    readonly createsUsageEvent: boolean;
    readonly createsCapacityReference: boolean;
    readonly mayBeIndependentOrganization: boolean;
  },
): InfrastructureSourceProfile {
  return Object.freeze({
    schemaVersion: INFRASTRUCTURE_FABRIC_SCHEMA_VERSION,
    sourceClass,
    allowedFactTypes,
    defaultClaimType: flags.defaultClaimType,
    createsUsageEvent: flags.createsUsageEvent,
    createsCapacityReference: flags.createsCapacityReference,
    mayBeIndependentOrganization: flags.mayBeIndependentOrganization,
    namedProviderIntegration: false,
  });
}

export const INFRASTRUCTURE_SOURCE_PROFILES: Readonly<Record<InfrastructureSourceClass, InfrastructureSourceProfile>> =
  Object.freeze({
    FACILITY_MANAGEMENT_SYSTEM: profile('FACILITY_MANAGEMENT_SYSTEM', ['INFRASTRUCTURE_USAGE', 'INFRASTRUCTURE_CAPACITY'], {
      defaultClaimType: 'USAGE',
      createsUsageEvent: true,
      createsCapacityReference: true,
      mayBeIndependentOrganization: false,
    }),
    TERMINAL_USAGE_SYSTEM: profile('TERMINAL_USAGE_SYSTEM', ['INFRASTRUCTURE_USAGE'], {
      defaultClaimType: 'USAGE',
      createsUsageEvent: true,
      createsCapacityReference: false,
      mayBeIndependentOrganization: false,
    }),
    PORT_INFRASTRUCTURE_SYSTEM: profile('PORT_INFRASTRUCTURE_SYSTEM', ['INFRASTRUCTURE_USAGE', 'INFRASTRUCTURE_CAPACITY'], {
      defaultClaimType: 'USAGE',
      createsUsageEvent: true,
      createsCapacityReference: true,
      mayBeIndependentOrganization: false,
    }),
    AIRPORT_INFRASTRUCTURE_SYSTEM: profile('AIRPORT_INFRASTRUCTURE_SYSTEM', ['INFRASTRUCTURE_USAGE', 'INFRASTRUCTURE_CAPACITY'], {
      defaultClaimType: 'USAGE',
      createsUsageEvent: true,
      createsCapacityReference: true,
      mayBeIndependentOrganization: false,
    }),
    RAIL_TERMINAL_SYSTEM: profile('RAIL_TERMINAL_SYSTEM', ['INFRASTRUCTURE_USAGE', 'INFRASTRUCTURE_CAPACITY'], {
      defaultClaimType: 'USAGE',
      createsUsageEvent: true,
      createsCapacityReference: true,
      mayBeIndependentOrganization: false,
    }),
    DATA_CENTER_FACILITY_SYSTEM: profile('DATA_CENTER_FACILITY_SYSTEM', ['INFRASTRUCTURE_USAGE', 'INFRASTRUCTURE_CAPACITY'], {
      defaultClaimType: 'USAGE',
      createsUsageEvent: true,
      createsCapacityReference: true,
      mayBeIndependentOrganization: false,
    }),
    PUBLIC_ASSET_UTILIZATION_REFERENCE: profile('PUBLIC_ASSET_UTILIZATION_REFERENCE', ['INFRASTRUCTURE_CAPACITY'], {
      defaultClaimType: 'CAPACITY',
      createsUsageEvent: false,
      createsCapacityReference: true,
      mayBeIndependentOrganization: false,
    }),
    INDUSTRIAL_INFRASTRUCTURE_METER: profile('INDUSTRIAL_INFRASTRUCTURE_METER', ['INFRASTRUCTURE_USAGE'], {
      defaultClaimType: 'USAGE',
      createsUsageEvent: true,
      createsCapacityReference: false,
      mayBeIndependentOrganization: false,
    }),
    INDEPENDENT_INFRASTRUCTURE_ATTESTATION: profile('INDEPENDENT_INFRASTRUCTURE_ATTESTATION', ['INFRASTRUCTURE_USAGE'], {
      defaultClaimType: 'USAGE',
      createsUsageEvent: true,
      createsCapacityReference: false,
      mayBeIndependentOrganization: true,
    }),
  });

export function profileFor(sourceClass: InfrastructureSourceClass): InfrastructureSourceProfile {
  return INFRASTRUCTURE_SOURCE_PROFILES[sourceClass];
}

export function classifyInfrastructureIndependence(input: {
  readonly sourceClass: InfrastructureSourceClass;
  readonly controllerId: string;
  readonly upstreamOrganizationId: string;
  readonly related: readonly { readonly controllerId: string; readonly upstreamOrganizationId: string }[];
}): InfrastructureIndependenceClass {
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
