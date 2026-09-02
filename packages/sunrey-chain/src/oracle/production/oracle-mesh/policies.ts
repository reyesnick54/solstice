/**
 * Versioned ProductiveVerificationPolicy configurations.
 *
 * Policies govern information sufficiency — not monetary supply policy.
 */

import type { ProductiveMeshDomain, ProductiveOracleSourceClass, ProductiveVerificationPolicy } from './types.ts';
import { DOMAIN_TOPOLOGIES } from './topologies.ts';

export const PRODUCTIVE_VERIFICATION_POLICY_VERSION = 'productive-verification.v1' as const;

function policy(
  input: Omit<ProductiveVerificationPolicy, 'version'> & { readonly version?: string },
): ProductiveVerificationPolicy {
  return Object.freeze({
    version: input.version ?? PRODUCTIVE_VERIFICATION_POLICY_VERSION,
    ...input,
  });
}

export const ENERGY_VERIFICATION_POLICY: ProductiveVerificationPolicy = policy({
  policyId: 'productive-verification.energy.v1',
  domain: 'ENERGY',
  requiredSourceClasses: Object.freeze(['DIRECT_SENSOR', 'UTILITY_OR_GRID', 'PRIMARY_OPERATOR']),
  minimumIndependentSources: 2,
  optionalSourceClasses: Object.freeze(['SATELLITE', 'GOVERNMENT', 'MARKET_REFERENCE', 'AGGREGATOR']),
  freshnessMaxAgeSeconds: 86_400,
  toleranceRangeBps: 500,
  requiredDirectEvidence: true,
  manualReviewTriggers: Object.freeze(['MATERIAL_CONFLICT', 'OUTLIER']),
  confidenceThresholdBps: 6_000,
  prohibitSingleSource: true,
});

export const COMPUTE_VERIFICATION_POLICY: ProductiveVerificationPolicy = policy({
  policyId: 'productive-verification.compute.v1',
  domain: 'COMPUTE',
  requiredSourceClasses: Object.freeze(['DIRECT_SENSOR', 'PRIMARY_OPERATOR', 'ENTERPRISE_SYSTEM']),
  minimumIndependentSources: 2,
  optionalSourceClasses: Object.freeze(['NETWORK_OPERATOR', 'UTILITY_OR_GRID', 'AGGREGATOR']),
  freshnessMaxAgeSeconds: 3_600,
  toleranceRangeBps: 750,
  requiredDirectEvidence: true,
  manualReviewTriggers: Object.freeze(['MATERIAL_CONFLICT']),
  confidenceThresholdBps: 6_500,
  prohibitSingleSource: true,
});

export const MANUFACTURING_VERIFICATION_POLICY: ProductiveVerificationPolicy = policy({
  policyId: 'productive-verification.manufacturing.v1',
  domain: 'MANUFACTURING',
  requiredSourceClasses: Object.freeze(['ENTERPRISE_SYSTEM', 'PRIMARY_OPERATOR']),
  minimumIndependentSources: 2,
  optionalSourceClasses: Object.freeze(['LOGISTICS_OPERATOR', 'UTILITY_OR_GRID', 'DIRECT_SENSOR', 'AGGREGATOR']),
  freshnessMaxAgeSeconds: 172_800,
  toleranceRangeBps: 1_000,
  requiredDirectEvidence: true,
  manualReviewTriggers: Object.freeze(['MATERIAL_CONFLICT', 'OUTLIER']),
  confidenceThresholdBps: 6_000,
  prohibitSingleSource: true,
});

export const AGRICULTURE_VERIFICATION_POLICY: ProductiveVerificationPolicy = policy({
  policyId: 'productive-verification.agriculture.v1',
  domain: 'AGRICULTURE',
  requiredSourceClasses: Object.freeze(['DIRECT_SENSOR', 'SATELLITE', 'GOVERNMENT']),
  minimumIndependentSources: 2,
  optionalSourceClasses: Object.freeze(['GEOSPATIAL', 'ACADEMIC', 'AGGREGATOR']),
  freshnessMaxAgeSeconds: 604_800,
  toleranceRangeBps: 1_500,
  requiredDirectEvidence: true,
  manualReviewTriggers: Object.freeze(['MATERIAL_CONFLICT', 'OUTLIER']),
  confidenceThresholdBps: 5_500,
  prohibitSingleSource: true,
});

export const LOGISTICS_VERIFICATION_POLICY: ProductiveVerificationPolicy = policy({
  policyId: 'productive-verification.logistics.v1',
  domain: 'LOGISTICS',
  requiredSourceClasses: Object.freeze(['LOGISTICS_OPERATOR', 'GEOSPATIAL']),
  minimumIndependentSources: 2,
  optionalSourceClasses: Object.freeze(['PRIMARY_OPERATOR', 'GOVERNMENT', 'DIRECT_SENSOR', 'AGGREGATOR']),
  freshnessMaxAgeSeconds: 43_200,
  toleranceRangeBps: 800,
  requiredDirectEvidence: true,
  manualReviewTriggers: Object.freeze(['MATERIAL_CONFLICT']),
  confidenceThresholdBps: 6_000,
  prohibitSingleSource: true,
});

export const WATER_VERIFICATION_POLICY: ProductiveVerificationPolicy = policy({
  policyId: 'productive-verification.water.v1',
  domain: 'WATER',
  requiredSourceClasses: Object.freeze(['UTILITY_OR_GRID', 'DIRECT_SENSOR']),
  minimumIndependentSources: 2,
  optionalSourceClasses: Object.freeze(['GOVERNMENT', 'GEOSPATIAL', 'SATELLITE', 'AGGREGATOR']),
  freshnessMaxAgeSeconds: 86_400,
  toleranceRangeBps: 600,
  requiredDirectEvidence: true,
  manualReviewTriggers: Object.freeze(['MATERIAL_CONFLICT', 'OUTLIER']),
  confidenceThresholdBps: 6_000,
  prohibitSingleSource: true,
});

export const RESOURCES_VERIFICATION_POLICY: ProductiveVerificationPolicy = policy({
  policyId: 'productive-verification.resources.v1',
  domain: 'RESOURCES',
  requiredSourceClasses: Object.freeze(['PRIMARY_OPERATOR', 'GOVERNMENT']),
  minimumIndependentSources: 2,
  optionalSourceClasses: Object.freeze(['GEOSPATIAL', 'LOGISTICS_OPERATOR', 'SATELLITE', 'AGGREGATOR']),
  freshnessMaxAgeSeconds: 604_800,
  toleranceRangeBps: 1_200,
  requiredDirectEvidence: true,
  manualReviewTriggers: Object.freeze(['MATERIAL_CONFLICT']),
  confidenceThresholdBps: 6_500,
  prohibitSingleSource: true,
});

export const DOMAIN_VERIFICATION_POLICIES: Readonly<Record<ProductiveMeshDomain, ProductiveVerificationPolicy>> =
  Object.freeze({
    ENERGY: ENERGY_VERIFICATION_POLICY,
    COMPUTE: COMPUTE_VERIFICATION_POLICY,
    MANUFACTURING: MANUFACTURING_VERIFICATION_POLICY,
    AGRICULTURE: AGRICULTURE_VERIFICATION_POLICY,
    LOGISTICS: LOGISTICS_VERIFICATION_POLICY,
    WATER: WATER_VERIFICATION_POLICY,
    RESOURCES: RESOURCES_VERIFICATION_POLICY,
  });

export function policyForDomain(domain: ProductiveMeshDomain): ProductiveVerificationPolicy {
  return DOMAIN_VERIFICATION_POLICIES[domain];
}

export function sourceClassSatisfiesPolicy(
  sourceClass: ProductiveOracleSourceClass,
  policy: ProductiveVerificationPolicy,
): boolean {
  const permitted = [
    ...policy.requiredSourceClasses,
    ...policy.optionalSourceClasses,
  ] as readonly string[];
  return permitted.includes(sourceClass);
}

export function hasRequiredDirectEvidence(
  sourceClasses: readonly ProductiveOracleSourceClass[],
  policy: ProductiveVerificationPolicy,
): boolean {
  if (!policy.requiredDirectEvidence) {
    return true;
  }
  return sourceClasses.some(
    (row) => row !== 'MARKET_REFERENCE' && row !== 'DERIVED_MODEL' && row !== 'AGGREGATOR',
  );
}

export function topologyAlignsWithPolicy(domain: ProductiveMeshDomain): boolean {
  const topology = DOMAIN_TOPOLOGIES[domain];
  const verification = DOMAIN_VERIFICATION_POLICIES[domain];
  return topology.minimumIndependentSources <= verification.minimumIndependentSources + 1;
}
