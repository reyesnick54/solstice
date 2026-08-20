/**
 * REHEARSAL_ONLY fixtures. They never become production GPUV values
 * and never authorize production.
 */

import { CERTIFICATION_POLICY_VERSION } from '../../../../oracle/production/certification/types.ts';
import { SOURCE_TAXONOMY_ID } from '../../../source-taxonomy/types.ts';
import { DEVELOPMENT_ATTRIBUTION_POLICY_ID } from '../../attribution/policy.ts';
import { NORMALIZATION_CONSTITUTION_VERSION } from '../../../../units/constitution.ts';
import { encodeString, sha256Hex } from '../../../../validators/canonical.ts';
import { reportCategoryCoverage } from './coverage.ts';
import { productionFactorPolicyCandidate } from './factors.ts';
import { createBaseValueScheduleCandidate } from './schedule.ts';
import {
  GOVERNED_VALUE_V2,
  PRODUCTION_CANDIDATE_DOMAIN,
  PRODUCTION_CANDIDATE_POLICY_ID,
  REHEARSAL_ONLY,
  type MoonReyProductiveValuePolicyCandidate,
  type ProductiveBaseValueScheduleCandidate,
  type ProductionCandidateValueInput,
} from './types.ts';

export const REHEARSAL_ENERGY_SCHEDULE_ID = 'moonrey.productive-base-value.rehearsal.energy.v1' as const;

export function rehearsalEnergySchedule(): ProductiveBaseValueScheduleCandidate {
  const created = createBaseValueScheduleCandidate({
    scheduleId: REHEARSAL_ENERGY_SCHEDULE_ID,
    version: 1,
    productiveCategory: 'ENERGY',
    canonicalUnit: 'Wh',
    semanticQualifier: 'energy_output',
    claimType: 'OUTPUT',
    realizationState: 'ACTUAL_OUTPUT',
    baseGpuvNumerator: 3n,
    baseGpuvDenominator: 7n,
    referenceMethodologyRef: 'rehearsal.methodology.not-production',
    governanceReference: 'chunk-146.rehearsal.energy-schedule',
    sourceClass: REHEARSAL_ONLY,
    fixture: true,
  });
  if (!created.ok) {
    throw new Error(created.detail);
  }
  return created.value;
}

export function rehearsalValueInput(overrides: Partial<ProductionCandidateValueInput> = {}): ProductionCandidateValueInput {
  return Object.freeze({
    contributionId: 'c.rehearsal.energy.1',
    contributionFingerprint: 'fp.rehearsal.energy.1',
    eventId: 'event.rehearsal.energy.1',
    eventFingerprint: 'efp.rehearsal.energy.1',
    category: 'ENERGY',
    canonicalUnit: 'Wh',
    semanticQualifier: 'energy_output',
    claimType: 'OUTPUT',
    realizationState: 'ACTUAL_OUTPUT',
    canonicalQuantity: 14n,
    attributionDecisionId: 'attr.rehearsal.energy.1',
    availableAttributionShare: Object.freeze({ numerator: 400_000n, denominator: 1_000_000n }),
    creditedCategories: Object.freeze(['ENERGY'] as const),
    valuePath: GOVERNED_VALUE_V2,
    fixturePolicy: true,
    authorizedBy: 'HUMAN',
    ...overrides,
  }) as ProductionCandidateValueInput;
}

export function unconfiguredProductiveValuePolicyCandidate(): MoonReyProductiveValuePolicyCandidate {
  const factorPolicy = productionFactorPolicyCandidate();
  const draft = {
    policyId: PRODUCTION_CANDIDATE_POLICY_ID,
    policyVersion: 1,
    valueSemantics: GOVERNED_VALUE_V2,
    baseSchedules: Object.freeze([]),
    factorPolicy,
    missingInputBehavior: factorPolicy.missingInputBehavior,
    aggregateFactorFloor: factorPolicy.aggregateFactorFloor,
    aggregateFactorCeiling: factorPolicy.aggregateFactorCeiling,
    categoryCoverage: reportCategoryCoverage(),
    unitConstitutionRef: NORMALIZATION_CONSTITUTION_VERSION,
    sourceTaxonomyRef: SOURCE_TAXONOMY_ID,
    oraclePolicyRef: CERTIFICATION_POLICY_VERSION,
    attributionPolicyRef: DEVELOPMENT_ATTRIBUTION_POLICY_ID,
    referenceFactMethodologyRef: 'moonrey.reference-fact.methodology.unconfigured',
    providerReadinessPolicyRef: 'moonrey.provider-readiness.external-evidence.unconfigured',
    governanceReference: 'chunk-146.productive-value.production-candidate',
    candidateEffectiveHeight: 1,
    sourceClass: 'UNCONFIGURED' as const,
    fixture: false,
    productionActivated: false as const,
    gpuvEqualsMoonReyByDefinition: false as const,
    canMint: false as const,
  };
  return Object.freeze({
    ...draft,
    policyHash: sha256Hex(encodeString(`${PRODUCTION_CANDIDATE_DOMAIN}|policy|${stable(draft)}`)),
  });
}

export function rehearsalProductiveValuePolicyCandidate(
  schedules: readonly ProductiveBaseValueScheduleCandidate[] = [rehearsalEnergySchedule()],
): MoonReyProductiveValuePolicyCandidate {
  const factorPolicy = productionFactorPolicyCandidate({ referencePricePermittedAsEvidence: false });
  const draft = {
    policyId: `${PRODUCTION_CANDIDATE_POLICY_ID}.rehearsal`,
    policyVersion: 1,
    valueSemantics: GOVERNED_VALUE_V2,
    baseSchedules: Object.freeze([...schedules]),
    factorPolicy,
    missingInputBehavior: factorPolicy.missingInputBehavior,
    aggregateFactorFloor: factorPolicy.aggregateFactorFloor,
    aggregateFactorCeiling: factorPolicy.aggregateFactorCeiling,
    categoryCoverage: reportCategoryCoverage(schedules),
    unitConstitutionRef: NORMALIZATION_CONSTITUTION_VERSION,
    sourceTaxonomyRef: SOURCE_TAXONOMY_ID,
    oraclePolicyRef: CERTIFICATION_POLICY_VERSION,
    attributionPolicyRef: DEVELOPMENT_ATTRIBUTION_POLICY_ID,
    referenceFactMethodologyRef: 'moonrey.reference-fact.methodology.rehearsal',
    providerReadinessPolicyRef: 'moonrey.provider-readiness.external-evidence.unconfigured',
    governanceReference: 'chunk-146.productive-value.rehearsal',
    candidateEffectiveHeight: 1,
    sourceClass: REHEARSAL_ONLY,
    fixture: true,
    productionActivated: false as const,
    gpuvEqualsMoonReyByDefinition: false as const,
    canMint: false as const,
  };
  return Object.freeze({
    ...draft,
    policyHash: sha256Hex(encodeString(`${PRODUCTION_CANDIDATE_DOMAIN}|policy|${stable(draft)}`)),
  });
}

function stable(value: unknown): string {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stable(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${key}:${stable(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}
