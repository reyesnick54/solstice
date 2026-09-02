/**
 * Versioned methodology and corroboration policy references.
 */

import type { EconomyDomain } from '../types.ts';
import type { MethodologyReference } from './types.ts';
import type { SourceClassKind } from '../types.ts';

export const METHODOLOGY_REGISTRY_VERSION = 'sunrey.information-consensus.methodology.v1' as const;

export type CorroborationRule = {
  readonly ruleId: string;
  readonly description: string;
  readonly requiredSourceClasses: readonly SourceClassKind[];
  readonly minimumIndependentClasses: number;
  readonly minimumObservations: number;
};

export type FreshnessPolicy = {
  readonly policyId: string;
  readonly domain: EconomyDomain;
  readonly factTypePattern: string;
  readonly maxAgeMs: number;
};

export type ConflictTolerancePolicy = {
  readonly policyId: string;
  readonly domain: EconomyDomain;
  readonly relativeTolerance: number;
  readonly absoluteTolerance: number;
  readonly outlierZScoreThreshold: number;
};

export type MethodologyPolicy = {
  readonly methodology: MethodologyReference;
  readonly corroborationRules: readonly CorroborationRule[];
  readonly freshnessPolicy: FreshnessPolicy;
  readonly conflictTolerance: ConflictTolerancePolicy;
  readonly requireEntityResolution: boolean;
  readonly manualReviewOnConflict: boolean;
  readonly allowUnverifiedProviders: boolean;
};

export const PRODUCTIVE_ENERGY_METHODOLOGY: MethodologyPolicy = Object.freeze({
  methodology: Object.freeze({
    methodologyId: 'productive-energy-information-consensus',
    version: '1.0.0',
    domain: 'PRODUCTIVE',
  }),
  corroborationRules: Object.freeze([
    Object.freeze({
      ruleId: 'energy-direct-or-operator-plus-reference',
      description: 'Direct sensor or operator corroborated by government/reference source',
      requiredSourceClasses: Object.freeze([
        'DIRECT_SENSOR',
        'PRIMARY_OPERATOR',
        'GOVERNMENT_REFERENCE',
      ] as const),
      minimumIndependentClasses: 2,
      minimumObservations: 2,
    }),
    Object.freeze({
      ruleId: 'energy-sensor-operator-government',
      description: 'Sensor + operator + government reference quorum',
      requiredSourceClasses: Object.freeze([
        'DIRECT_SENSOR',
        'PRIMARY_OPERATOR',
        'GOVERNMENT_REFERENCE',
      ] as const),
      minimumIndependentClasses: 3,
      minimumObservations: 3,
    }),
  ]),
  freshnessPolicy: Object.freeze({
    policyId: 'productive-grid-output-freshness',
    domain: 'PRODUCTIVE',
    factTypePattern: 'ENERGY_*',
    maxAgeMs: 3_600_000,
  }),
  conflictTolerance: Object.freeze({
    policyId: 'productive-energy-numeric-tolerance',
    domain: 'PRODUCTIVE',
    relativeTolerance: 0.02,
    absoluteTolerance: 5,
    outlierZScoreThreshold: 2.5,
  }),
  requireEntityResolution: true,
  manualReviewOnConflict: true,
  allowUnverifiedProviders: false,
});

export const HUMAN_CONTRIBUTION_METHODOLOGY: MethodologyPolicy = Object.freeze({
  methodology: Object.freeze({
    methodologyId: 'human-contribution-information-consensus',
    version: '1.0.0',
    domain: 'HUMAN',
  }),
  corroborationRules: Object.freeze([
    Object.freeze({
      ruleId: 'human-attestation-or-credential',
      description: 'Attestation, credential, or authorized data proof',
      requiredSourceClasses: Object.freeze([
        'ATTESTATION',
        'CREDENTIAL',
        'RECEIPT',
        'RESEARCH_REFERENCE',
        'EMPLOYMENT_VERIFICATION',
        'COMPUTATION_RECEIPT',
        'AUTHORIZED_DATA_PROOF',
      ] as const),
      minimumIndependentClasses: 1,
      minimumObservations: 1,
    }),
    Object.freeze({
      ruleId: 'human-independent-attestation-pair',
      description: 'Two independent attestation classes',
      requiredSourceClasses: Object.freeze([
        'ATTESTATION',
        'CREDENTIAL',
        'EMPLOYMENT_VERIFICATION',
      ] as const),
      minimumIndependentClasses: 2,
      minimumObservations: 2,
    }),
  ]),
  freshnessPolicy: Object.freeze({
    policyId: 'human-contribution-freshness',
    domain: 'HUMAN',
    factTypePattern: '*',
    maxAgeMs: 31_536_000_000,
  }),
  conflictTolerance: Object.freeze({
    policyId: 'human-categorical-tolerance',
    domain: 'HUMAN',
    relativeTolerance: 0,
    absoluteTolerance: 0,
    outlierZScoreThreshold: 0,
  }),
  requireEntityResolution: true,
  manualReviewOnConflict: true,
  allowUnverifiedProviders: false,
});

export const ANNUAL_REFERENCE_METHODOLOGY: MethodologyPolicy = Object.freeze({
  methodology: Object.freeze({
    methodologyId: 'annual-government-reference',
    version: '1.0.0',
    domain: 'REFERENCE',
  }),
  corroborationRules: Object.freeze([
    Object.freeze({
      ruleId: 'government-reference-single',
      description: 'Authoritative government/reference source',
      requiredSourceClasses: Object.freeze(['GOVERNMENT_REFERENCE'] as const),
      minimumIndependentClasses: 1,
      minimumObservations: 1,
    }),
  ]),
  freshnessPolicy: Object.freeze({
    policyId: 'annual-government-statistic-freshness',
    domain: 'REFERENCE',
    factTypePattern: '*',
    maxAgeMs: 366 * 86_400_000,
  }),
  conflictTolerance: Object.freeze({
    policyId: 'reference-low-tolerance',
    domain: 'REFERENCE',
    relativeTolerance: 0.001,
    absoluteTolerance: 0,
    outlierZScoreThreshold: 3,
  }),
  requireEntityResolution: false,
  manualReviewOnConflict: false,
  allowUnverifiedProviders: false,
});

const REGISTRY = new Map<string, MethodologyPolicy>([
  [PRODUCTIVE_ENERGY_METHODOLOGY.methodology.methodologyId, PRODUCTIVE_ENERGY_METHODOLOGY],
  [HUMAN_CONTRIBUTION_METHODOLOGY.methodology.methodologyId, HUMAN_CONTRIBUTION_METHODOLOGY],
  [ANNUAL_REFERENCE_METHODOLOGY.methodology.methodologyId, ANNUAL_REFERENCE_METHODOLOGY],
]);

export function resolveMethodologyPolicy(ref: MethodologyReference): MethodologyPolicy {
  const policy = REGISTRY.get(ref.methodologyId);
  if (!policy || policy.methodology.version !== ref.version) {
    throw new Error(`UNKNOWN_METHODOLOGY:${ref.methodologyId}@${ref.version}`);
  }
  return policy;
}

export function selectApplicableCorroborationRules(
  policy: MethodologyPolicy,
  independentClassCount: number,
): readonly CorroborationRule[] {
  return policy.corroborationRules
    .filter((rule) => independentClassCount >= rule.minimumIndependentClasses)
    .sort((left, right) => right.minimumIndependentClasses - left.minimumIndependentClasses);
}
