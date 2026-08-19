/**
 * Provider-neutral bandwidth source-class profiles.
 *
 * Named commercial vendors are not required. Five APIs operated by
 * one telecom/controller remain one controller under Chunk 128.
 */

import type { DataSourceCategory } from '../../types.ts';
import type { BandwidthFactType, BandwidthSourceClass, NetworkServiceStage } from './types.ts';

export type BandwidthSourceProfile = {
  readonly sourceClass: BandwidthSourceClass;
  readonly dataSourceCategory: DataSourceCategory;
  readonly defaultFactType: BandwidthFactType;
  readonly allowedFactTypes: readonly BandwidthFactType[];
  readonly defaultStage: NetworkServiceStage;
  readonly mayDescribeCapacity: boolean;
  readonly corroboratingOnly: boolean;
  readonly namedVendorRequired: false;
};

function profile(
  sourceClass: BandwidthSourceClass,
  defaultFactType: BandwidthFactType,
  allowedFactTypes: readonly BandwidthFactType[],
  defaultStage: NetworkServiceStage,
  mayDescribeCapacity: boolean,
): BandwidthSourceProfile {
  return Object.freeze({
    sourceClass,
    dataSourceCategory: 'bandwidth',
    defaultFactType,
    allowedFactTypes,
    defaultStage,
    mayDescribeCapacity,
    corroboratingOnly: true,
    namedVendorRequired: false,
  });
}

const USAGE: readonly BandwidthFactType[] = Object.freeze(['BANDWIDTH_USAGE']);
const BOTH: readonly BandwidthFactType[] = Object.freeze(['BANDWIDTH_CAPACITY', 'BANDWIDTH_USAGE']);
const CAPACITY: readonly BandwidthFactType[] = Object.freeze(['BANDWIDTH_CAPACITY']);

export const BANDWIDTH_SOURCE_PROFILES: Readonly<Record<BandwidthSourceClass, BandwidthSourceProfile>> = Object.freeze({
  ISP_USAGE_METER: profile('ISP_USAGE_METER', 'BANDWIDTH_USAGE', USAGE, 'LAST_MILE_ACCESS', false),
  TELECOM_NETWORK_METER: profile('TELECOM_NETWORK_METER', 'BANDWIDTH_USAGE', BOTH, 'LAST_MILE_ACCESS', true),
  CDN_METERING: profile('CDN_METERING', 'BANDWIDTH_USAGE', USAGE, 'CDN', false),
  NETWORK_EDGE_METER: profile('NETWORK_EDGE_METER', 'BANDWIDTH_USAGE', USAGE, 'LAST_MILE_ACCESS', false),
  CLOUD_EGRESS_METER: profile('CLOUD_EGRESS_METER', 'BANDWIDTH_USAGE', USAGE, 'ORIGIN_HOSTING_NETWORK', false),
  PEERING_METER: profile('PEERING_METER', 'BANDWIDTH_USAGE', USAGE, 'TRANSIT_NETWORK', false),
  TRANSIT_PROVIDER_METER: profile('TRANSIT_PROVIDER_METER', 'BANDWIDTH_USAGE', BOTH, 'TRANSIT_NETWORK', true),
  DATA_CENTER_NETWORK_METER: profile('DATA_CENTER_NETWORK_METER', 'BANDWIDTH_USAGE', BOTH, 'ORIGIN_HOSTING_NETWORK', true),
  ENTERPRISE_NETWORK_METER: profile('ENTERPRISE_NETWORK_METER', 'BANDWIDTH_USAGE', BOTH, 'LAST_MILE_ACCESS', true),
  SATELLITE_NETWORK_METER: profile('SATELLITE_NETWORK_METER', 'BANDWIDTH_USAGE', BOTH, 'TRANSIT_NETWORK', true),
  SUBSEA_CAPACITY_REFERENCE: profile('SUBSEA_CAPACITY_REFERENCE', 'BANDWIDTH_CAPACITY', CAPACITY, 'TRANSIT_NETWORK', true),
  INDEPENDENT_NETWORK_ATTESTATION: profile(
    'INDEPENDENT_NETWORK_ATTESTATION',
    'BANDWIDTH_USAGE',
    BOTH,
    'TRANSIT_NETWORK',
    true,
  ),
});

export function profileFor(sourceClass: BandwidthSourceClass): BandwidthSourceProfile {
  return BANDWIDTH_SOURCE_PROFILES[sourceClass];
}

export function namedVendorIsNotRequired(): false {
  return false;
}

export function classifyBandwidthIndependence(input: {
  readonly controllerId: string;
  readonly upstreamOrganizationId: string;
  readonly otherControllerId: string;
  readonly otherUpstreamOrganizationId: string;
}): 'SAME_CONTROLLER' | 'SAME_UPSTREAM_ORGANIZATION' | 'INDEPENDENT_ORGANIZATION' {
  if (input.controllerId === input.otherControllerId) {
    return 'SAME_CONTROLLER';
  }
  if (input.upstreamOrganizationId === input.otherUpstreamOrganizationId) {
    return 'SAME_UPSTREAM_ORGANIZATION';
  }
  return 'INDEPENDENT_ORGANIZATION';
}
