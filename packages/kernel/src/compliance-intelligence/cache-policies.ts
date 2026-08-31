/**
 * Capability-specific cache rules for compliance intelligence.
 */

export const COMPLIANCE_CACHE_CAPABILITIES = Object.freeze({
  searchQuery: 'compliance.search_query',
  recordMetadata: 'compliance.record_metadata',
  negativeObservation: 'compliance.negative_observation',
});

export type ComplianceCacheCapability =
  (typeof COMPLIANCE_CACHE_CAPABILITIES)[keyof typeof COMPLIANCE_CACHE_CAPABILITIES];

export type ComplianceCachePolicy = {
  readonly capability: ComplianceCacheCapability;
  readonly freshTtlMs: number;
  readonly staleWindowMs: number;
  readonly maxTtlMs: number;
  readonly allowIndefiniteNoMatch: false;
};

export function complianceCachePolicy(capability: ComplianceCacheCapability): ComplianceCachePolicy {
  switch (capability) {
    case COMPLIANCE_CACHE_CAPABILITIES.searchQuery:
      return Object.freeze({
        capability,
        freshTtlMs: 15 * 60 * 1000,
        staleWindowMs: 60 * 60 * 1000,
        maxTtlMs: 4 * 60 * 60 * 1000,
        allowIndefiniteNoMatch: false,
      });
    case COMPLIANCE_CACHE_CAPABILITIES.recordMetadata:
      return Object.freeze({
        capability,
        freshTtlMs: 6 * 60 * 60 * 1000,
        staleWindowMs: 24 * 60 * 60 * 1000,
        maxTtlMs: 7 * 24 * 60 * 60 * 1000,
        allowIndefiniteNoMatch: false,
      });
    case COMPLIANCE_CACHE_CAPABILITIES.negativeObservation:
      return Object.freeze({
        capability,
        freshTtlMs: 30 * 60 * 1000,
        staleWindowMs: 2 * 60 * 60 * 1000,
        maxTtlMs: 6 * 60 * 60 * 1000,
        allowIndefiniteNoMatch: false,
      });
  }
}
