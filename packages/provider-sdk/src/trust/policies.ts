/**
 * Versioned trust policy profiles — each data class uses distinct rules.
 */

import type { AuthorityClass } from '../types.ts';
import type { SelectionMethod, TrustPolicyProfile } from './types.ts';

export type TrustPolicyConfig = {
  readonly profile: TrustPolicyProfile;
  readonly version: string;
  readonly minCorroboration: number;
  readonly minConfidenceBand: 'HIGH' | 'MEDIUM' | 'LOW';
  readonly maxTimeSkewMs: number;
  readonly outlierTolerancePercent: number;
  readonly selectionMethod: SelectionMethod;
  readonly authorityPrecedence: readonly AuthorityClass[];
  readonly allowStaleCanonical: boolean;
  readonly consolidateForecasts: false;
  readonly numericConsensus: boolean;
};

const AUTHORITY_PRECEDENCE_OFFICIAL: readonly AuthorityClass[] = Object.freeze([
  'authoritative_official',
  'regulated_provider',
  'reference_data',
  'derived_data',
  'research_data',
  'community_data',
]);

export const TRUST_POLICY_VERSIONS: Readonly<Record<TrustPolicyProfile, string>> = Object.freeze({
  FX_REFERENCE: 'fx_reference_v1',
  MARKET_REFERENCE: 'market_reference_v1',
  MACROECONOMIC: 'macroeconomic_v1',
  WEATHER: 'weather_v1',
  ENERGY: 'energy_v1',
  RESOURCE: 'resource_v1',
  GEOSPATIAL: 'geospatial_v1',
  COMPLIANCE_EVIDENCE: 'compliance_evidence_v1',
  CHAIN_STATE: 'chain_state_v1',
  HEALTH_REFERENCE: 'health_reference_v1',
  RESEARCH: 'research_v1',
  JOB_OPPORTUNITY: 'job_opportunity_v1',
  GENERIC: 'generic_v1',
});

export const TRUST_POLICIES: Readonly<Record<TrustPolicyProfile, TrustPolicyConfig>> = Object.freeze({
  FX_REFERENCE: Object.freeze({
    profile: 'FX_REFERENCE',
    version: TRUST_POLICY_VERSIONS.FX_REFERENCE,
    minCorroboration: 1,
    minConfidenceBand: 'MEDIUM',
    maxTimeSkewMs: 15 * 60_000,
    outlierTolerancePercent: 0.5,
    selectionMethod: 'WEIGHTED_MEDIAN',
    authorityPrecedence: AUTHORITY_PRECEDENCE_OFFICIAL,
    allowStaleCanonical: true,
    consolidateForecasts: false,
    numericConsensus: true,
  }),
  MARKET_REFERENCE: Object.freeze({
    profile: 'MARKET_REFERENCE',
    version: TRUST_POLICY_VERSIONS.MARKET_REFERENCE,
    minCorroboration: 1,
    minConfidenceBand: 'MEDIUM',
    maxTimeSkewMs: 5 * 60_000,
    outlierTolerancePercent: 1.0,
    selectionMethod: 'WEIGHTED_MEDIAN',
    authorityPrecedence: AUTHORITY_PRECEDENCE_OFFICIAL,
    allowStaleCanonical: true,
    consolidateForecasts: false,
    numericConsensus: true,
  }),
  MACROECONOMIC: Object.freeze({
    profile: 'MACROECONOMIC',
    version: TRUST_POLICY_VERSIONS.MACROECONOMIC,
    minCorroboration: 1,
    minConfidenceBand: 'MEDIUM',
    maxTimeSkewMs: 90 * 24 * 60 * 60_000,
    outlierTolerancePercent: 2.0,
    selectionMethod: 'AUTHORITY_PRECEDENCE',
    authorityPrecedence: AUTHORITY_PRECEDENCE_OFFICIAL,
    allowStaleCanonical: true,
    consolidateForecasts: false,
    numericConsensus: true,
  }),
  WEATHER: Object.freeze({
    profile: 'WEATHER',
    version: TRUST_POLICY_VERSIONS.WEATHER,
    minCorroboration: 1,
    minConfidenceBand: 'LOW',
    maxTimeSkewMs: 30 * 60_000,
    outlierTolerancePercent: 15.0,
    selectionMethod: 'RETAIN_ALL',
    authorityPrecedence: AUTHORITY_PRECEDENCE_OFFICIAL,
    allowStaleCanonical: false,
    consolidateForecasts: false,
    numericConsensus: false,
  }),
  ENERGY: Object.freeze({
    profile: 'ENERGY',
    version: TRUST_POLICY_VERSIONS.ENERGY,
    minCorroboration: 1,
    minConfidenceBand: 'MEDIUM',
    maxTimeSkewMs: 24 * 60 * 60_000,
    outlierTolerancePercent: 5.0,
    selectionMethod: 'AUTHORITY_PRECEDENCE',
    authorityPrecedence: AUTHORITY_PRECEDENCE_OFFICIAL,
    allowStaleCanonical: true,
    consolidateForecasts: false,
    numericConsensus: true,
  }),
  RESOURCE: Object.freeze({
    profile: 'RESOURCE',
    version: TRUST_POLICY_VERSIONS.RESOURCE,
    minCorroboration: 1,
    minConfidenceBand: 'MEDIUM',
    maxTimeSkewMs: 24 * 60 * 60_000,
    outlierTolerancePercent: 5.0,
    selectionMethod: 'AUTHORITY_PRECEDENCE',
    authorityPrecedence: AUTHORITY_PRECEDENCE_OFFICIAL,
    allowStaleCanonical: true,
    consolidateForecasts: false,
    numericConsensus: true,
  }),
  GEOSPATIAL: Object.freeze({
    profile: 'GEOSPATIAL',
    version: TRUST_POLICY_VERSIONS.GEOSPATIAL,
    minCorroboration: 1,
    minConfidenceBand: 'MEDIUM',
    maxTimeSkewMs: 60 * 60_000,
    outlierTolerancePercent: 1.0,
    selectionMethod: 'AUTHORITY_PRECEDENCE',
    authorityPrecedence: AUTHORITY_PRECEDENCE_OFFICIAL,
    allowStaleCanonical: true,
    consolidateForecasts: false,
    numericConsensus: false,
  }),
  COMPLIANCE_EVIDENCE: Object.freeze({
    profile: 'COMPLIANCE_EVIDENCE',
    version: TRUST_POLICY_VERSIONS.COMPLIANCE_EVIDENCE,
    minCorroboration: 0,
    minConfidenceBand: 'LOW',
    maxTimeSkewMs: 365 * 24 * 60 * 60_000,
    outlierTolerancePercent: 0,
    selectionMethod: 'RETAIN_ALL',
    authorityPrecedence: AUTHORITY_PRECEDENCE_OFFICIAL,
    allowStaleCanonical: true,
    consolidateForecasts: false,
    numericConsensus: false,
  }),
  CHAIN_STATE: Object.freeze({
    profile: 'CHAIN_STATE',
    version: TRUST_POLICY_VERSIONS.CHAIN_STATE,
    minCorroboration: 1,
    minConfidenceBand: 'HIGH',
    maxTimeSkewMs: 60_000,
    outlierTolerancePercent: 0,
    selectionMethod: 'NO_SELECTION',
    authorityPrecedence: AUTHORITY_PRECEDENCE_OFFICIAL,
    allowStaleCanonical: false,
    consolidateForecasts: false,
    numericConsensus: false,
  }),
  HEALTH_REFERENCE: Object.freeze({
    profile: 'HEALTH_REFERENCE',
    version: TRUST_POLICY_VERSIONS.HEALTH_REFERENCE,
    minCorroboration: 1,
    minConfidenceBand: 'MEDIUM',
    maxTimeSkewMs: 7 * 24 * 60 * 60_000,
    outlierTolerancePercent: 2.0,
    selectionMethod: 'AUTHORITY_PRECEDENCE',
    authorityPrecedence: AUTHORITY_PRECEDENCE_OFFICIAL,
    allowStaleCanonical: true,
    consolidateForecasts: false,
    numericConsensus: true,
  }),
  RESEARCH: Object.freeze({
    profile: 'RESEARCH',
    version: TRUST_POLICY_VERSIONS.RESEARCH,
    minCorroboration: 0,
    minConfidenceBand: 'LOW',
    maxTimeSkewMs: 365 * 24 * 60 * 60_000,
    outlierTolerancePercent: 0,
    selectionMethod: 'RETAIN_ALL',
    authorityPrecedence: AUTHORITY_PRECEDENCE_OFFICIAL,
    allowStaleCanonical: true,
    consolidateForecasts: false,
    numericConsensus: false,
  }),
  JOB_OPPORTUNITY: Object.freeze({
    profile: 'JOB_OPPORTUNITY',
    version: TRUST_POLICY_VERSIONS.JOB_OPPORTUNITY,
    minCorroboration: 1,
    minConfidenceBand: 'LOW',
    maxTimeSkewMs: 24 * 60 * 60_000,
    outlierTolerancePercent: 0,
    selectionMethod: 'RETAIN_ALL',
    authorityPrecedence: AUTHORITY_PRECEDENCE_OFFICIAL,
    allowStaleCanonical: true,
    consolidateForecasts: false,
    numericConsensus: false,
  }),
  GENERIC: Object.freeze({
    profile: 'GENERIC',
    version: TRUST_POLICY_VERSIONS.GENERIC,
    minCorroboration: 1,
    minConfidenceBand: 'LOW',
    maxTimeSkewMs: 24 * 60 * 60_000,
    outlierTolerancePercent: 5.0,
    selectionMethod: 'MEDIAN',
    authorityPrecedence: AUTHORITY_PRECEDENCE_OFFICIAL,
    allowStaleCanonical: true,
    consolidateForecasts: false,
    numericConsensus: true,
  }),
});

export function getTrustPolicy(profile: TrustPolicyProfile): TrustPolicyConfig {
  return TRUST_POLICIES[profile];
}

export function authorityRank(class_: AuthorityClass, precedence: readonly AuthorityClass[]): number {
  const index = precedence.indexOf(class_);
  return index === -1 ? precedence.length : index;
}
