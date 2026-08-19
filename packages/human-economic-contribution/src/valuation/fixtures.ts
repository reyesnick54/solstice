import { asUtcInstant } from '../../../domain/src/time.ts';
import { asValuationPolicyVersion, valuationPolicyIdFor } from './ids.ts';
import type { PermittedValuationMethod } from './methods.ts';
import type { AllowedValuationInputType } from './inputs.ts';
import type { RegisterableValuationPolicy } from './policy.ts';
import type { ContributionClass } from '../taxonomy.ts';

const EFFECTIVE_FROM = asUtcInstant('2026-08-19T00:00:00.000Z');

function scheduleInputs(extra: readonly AllowedValuationInputType[]): readonly AllowedValuationInputType[] {
  return ['VERIFIED_MEASUREMENT', 'MEASUREMENT_UNIT', 'MEASUREMENT_PERIOD', 'JURISDICTION_POLICY', ...extra];
}

export function simulationPolicyFixture(
  contributionClass: ContributionClass,
  method: PermittedValuationMethod,
  seed: string,
  extras: readonly AllowedValuationInputType[],
  priority: readonly PermittedValuationMethod[] = [method],
): RegisterableValuationPolicy {
  return {
    policyId: valuationPolicyIdFor(seed),
    version: asValuationPolicyVersion('1'),
    status: 'SIMULATION',
    contributionClass,
    method,
    allowedInputTypes: scheduleInputs(extras),
    requiredEvidence: ['verified-measurement', 'policy-governance-ref'],
    referenceDenomination: 'USD',
    factorRules: [
      {
        factor: 'VERIFICATION_QUALITY',
        multiplier: { kind: 'BASIS_POINTS', points: 10_000n },
      },
    ],
    caps: { amount: 1_000_000n, denomination: 'USD' },
    floors: { amount: 0n, denomination: 'USD' },
    roundingRule: 'FLOOR',
    jurisdictionRules: [{ jurisdiction: 'US', allowed: true }],
    effectiveFrom: EFFECTIVE_FROM,
    effectiveUntil: null,
    governanceReference: `gov:${seed}`,
    methodologyReference: `method:${seed}`,
    methodPriority: priority,
    conflictToleranceBasisPoints: 250n,
    productionActivated: false,
  };
}

export const INFORMATION_USAGE_POLICY = simulationPolicyFixture(
  'INFORMATION_RIGHT_CONTRIBUTION',
  'INFORMATION_USAGE_RIGHT_SCHEDULE',
  'information-usage',
  ['INFORMATION_USAGE_SCOPE', 'VERIFIED_USE_COUNT', 'RIGHTS_SCOPE', 'CONTRACTUAL_COMPENSATION_REFERENCE'],
  ['CONTRACTUAL_COMPENSATION', 'INFORMATION_USAGE_RIGHT_SCHEDULE'],
);

export const PROFESSIONAL_SERVICE_POLICY = simulationPolicyFixture(
  'PROFESSIONAL_EXPERTISE',
  'PROFESSIONAL_SERVICE_SCHEDULE',
  'professional-service',
  ['SERVICE_DELIVERY_UNITS', 'CONTRACTUAL_COMPENSATION_REFERENCE', 'PROFESSIONAL_CREDENTIAL_FACT'],
  ['CONTRACTUAL_COMPENSATION', 'PROFESSIONAL_SERVICE_SCHEDULE'],
);

export const CREATIVE_ROYALTY_POLICY = simulationPolicyFixture(
  'CREATOR_ROYALTY_EVENT',
  'CREATOR_ROYALTY_SCHEDULE',
  'creative-royalty',
  ['LICENSE_ROYALTY_REFERENCE', 'CONTRACTUAL_COMPENSATION_REFERENCE', 'RIGHTS_SCOPE'],
  ['CONTRACTUAL_COMPENSATION', 'CREATOR_ROYALTY_SCHEDULE'],
);

export const RESEARCH_PARTICIPATION_POLICY = simulationPolicyFixture(
  'RESEARCH_PARTICIPATION',
  'RESEARCH_PARTICIPATION_SCHEDULE',
  'research-participation',
  ['RESEARCH_PARTICIPATION_UNITS', 'CONTRACTUAL_COMPENSATION_REFERENCE'],
);

export const COMMUNITY_CONTRIBUTION_POLICY = simulationPolicyFixture(
  'COMMUNITY_CONTRIBUTION',
  'COMMUNITY_CONTRIBUTION_SCHEDULE',
  'community-contribution',
  ['ECONOMIC_EVENT_CONTEXT'],
  ['GOVERNED_FIXED_SCHEDULE', 'COMMUNITY_CONTRIBUTION_SCHEDULE'],
);

export const SIMULATION_POLICY_FIXTURES = Object.freeze([
  INFORMATION_USAGE_POLICY,
  PROFESSIONAL_SERVICE_POLICY,
  CREATIVE_ROYALTY_POLICY,
  RESEARCH_PARTICIPATION_POLICY,
  COMMUNITY_CONTRIBUTION_POLICY,
]);
