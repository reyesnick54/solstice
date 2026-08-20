import { asUtcInstant } from '../../../domain/src/time.ts';
import { fixtureContribution, FIXTURE_NOW } from '../fixtures.ts';
import { evidenceRefFor, usageReceiptRefFor } from '../ids.ts';
import { HumanContributionRegistry } from '../registry.ts';
import type { ContributionClass, MeasurementUnit } from '../taxonomy.ts';
import type { HumanContributionRegistryRecord } from '../types.ts';
import { policyRuleRefFor } from './ids.ts';
import { createSimulationValuationPolicy } from './policy.ts';
import { createReferenceDatum, InMemoryValuationReferenceDataPort } from './reference-data.ts';
import type {
  FactorRequest,
  HumanContributionValuationPolicy,
  ValuationMethod,
  ValuationReferenceDatum,
  ValuationReferenceSourceClass,
} from './types.ts';
import { HumanContributionValuationEngine } from './engine.ts';

export const VALUATION_NOW = FIXTURE_NOW;
export const VALUATION_OBSERVED_AT = asUtcInstant('2026-06-01T00:00:00.000Z');

export const METHOD_CLASS: Readonly<Record<ValuationMethod, ContributionClass>> = Object.freeze({
  CONTRACTUAL_COMPENSATION: 'ENTREPRENEURIAL_ACTIVITY',
  GOVERNED_FIXED_SCHEDULE: 'CREATIVE_PRODUCTION',
  INFORMATION_USAGE_RIGHT_SCHEDULE: 'INFORMATION_RIGHT_CONTRIBUTION',
  PROFESSIONAL_SERVICE_SCHEDULE: 'PROFESSIONAL_EXPERTISE',
  CREATOR_ROYALTY_SCHEDULE: 'CREATOR_ROYALTY_EVENT',
  RESEARCH_PARTICIPATION_SCHEDULE: 'RESEARCH_PARTICIPATION',
  COMMUNITY_CONTRIBUTION_SCHEDULE: 'COMMUNITY_CONTRIBUTION',
  MARKET_REFERENCE: 'ECONOMIC_PARTICIPATION',
  VERIFIED_OUTCOME_ATTRIBUTION: 'RESEARCH_PARTICIPATION',
});

export const METHOD_SOURCE: Readonly<Record<ValuationMethod, ValuationReferenceSourceClass>> = Object.freeze({
  CONTRACTUAL_COMPENSATION: 'CONTRACTUAL_TERM',
  GOVERNED_FIXED_SCHEDULE: 'GOVERNED_FIXED_SCHEDULE',
  INFORMATION_USAGE_RIGHT_SCHEDULE: 'INFORMATION_RIGHT_USAGE_SCHEDULE',
  PROFESSIONAL_SERVICE_SCHEDULE: 'APPROVED_PROFESSIONAL_RATE_SCHEDULE',
  CREATOR_ROYALTY_SCHEDULE: 'ROYALTY_SCHEDULE',
  RESEARCH_PARTICIPATION_SCHEDULE: 'APPROVED_RESEARCH_COMPENSATION_SCHEDULE',
  COMMUNITY_CONTRIBUTION_SCHEDULE: 'COMMUNITY_CONTRIBUTION_SCHEDULE',
  MARKET_REFERENCE: 'APPROVED_MARKET_REFERENCE',
  VERIFIED_OUTCOME_ATTRIBUTION: 'OUTCOME_ATTRIBUTION_SCHEDULE',
});

export function verifyFixture(
  contributionClass: ContributionClass,
  seed: string,
  quantity = 2n,
): HumanContributionRegistryRecord {
  const registry = new HumanContributionRegistry();
  const base = fixtureContribution(contributionClass, seed);
  const existingReceipts = base.usageReceiptReferences ?? [];
  const usageReceiptReferences =
    contributionClass === 'ECONOMIC_PARTICIPATION' && existingReceipts.length === 0
      ? [usageReceiptRefFor(seed)]
      : existingReceipts;
  const submitted = registry.submit({
    ...base,
    measurementQuantity: quantity,
    usageReceiptReferences,
    ...(base.canonicalReferences
      ? {
          canonicalReferences: {
            ...base.canonicalReferences,
            usageReceiptRefs: usageReceiptReferences,
          },
        }
      : {}),
  });
  if (!submitted.ok) {
    throw new Error(submitted.error.message);
  }
  const verified = registry.verify({
    contributionId: submitted.value.contributionId,
    verificationTimestamp: asUtcInstant('2026-08-19T12:05:00.000Z'),
  });
  if (!verified.ok) {
    throw new Error(verified.error.message);
  }
  return verified.value;
}

export function referenceFor(
  method: ValuationMethod,
  seed: string,
  value: bigint,
  extras: Partial<ValuationReferenceDatum> & { readonly measurementUnit?: MeasurementUnit } = {},
): ValuationReferenceDatum {
  const contributionClass = METHOD_CLASS[method];
  return createReferenceDatum({
    seed,
    sourceClass: METHOD_SOURCE[method],
    observedAt: extras.observedAt ?? VALUATION_OBSERVED_AT,
    effectiveAt: extras.effectiveAt ?? VALUATION_OBSERVED_AT,
    ...(extras.expiresAt !== undefined ? { expiresAt: extras.expiresAt } : {}),
    jurisdiction: extras.jurisdiction ?? 'GB',
    unit: extras.unit ?? (method === 'CREATOR_ROYALTY_SCHEDULE'
      ? 'ROYALTY_BASIS_MINOR_UNIT'
      : method === 'CONTRACTUAL_COMPENSATION'
        ? 'CONTRACT_MINOR_UNIT'
        : (extras.measurementUnit ?? fixtureContribution(contributionClass).measurementUnit)),
    value,
    ...(extras.royaltyBasisPoints !== undefined ? { royaltyBasisPoints: extras.royaltyBasisPoints } : {}),
    ...(extras.quality ? { quality: extras.quality } : {}),
    ...(extras.confidenceBps !== undefined ? { confidenceBps: extras.confidenceBps } : {}),
    contributionClass,
    valuationMethod: method,
    measurementUnit: extras.measurementUnit ?? fixtureContribution(contributionClass).measurementUnit,
    ...(extras.relatedContributionId ? { relatedContributionId: extras.relatedContributionId } : {}),
    ...(extras.policyCompatibility !== undefined ? { policyCompatibility: extras.policyCompatibility } : {}),
  });
}

export function factorRequest(
  seed: string,
  basisPoints: bigint,
  factorType: FactorRequest['factorType'] = 'QUALITY',
): FactorRequest {
  return Object.freeze({
    factorType,
    inputRef: `factor:${seed}`,
    numerator: basisPoints,
    denominator: 10_000n,
    basisPoints,
    reasonCode: 'METHOD_SELECTED',
    policyRuleRef: policyRuleRefFor(seed),
  });
}

export function outcomePolicy(): HumanContributionValuationPolicy {
  const base = createSimulationValuationPolicy();
  return createSimulationValuationPolicy({
    eligibility: Object.freeze(
      base.eligibility.map((rule) =>
        rule.contributionClass === 'RESEARCH_PARTICIPATION'
          ? Object.freeze({
              ...rule,
              methods: Object.freeze(['VERIFIED_OUTCOME_ATTRIBUTION' as const]),
              requiredReferenceSource: 'OUTCOME_ATTRIBUTION_SCHEDULE' as const,
            })
          : rule,
      ),
    ),
  });
}

export function engineWith(references: readonly ValuationReferenceDatum[]): HumanContributionValuationEngine {
  return new HumanContributionValuationEngine(new InMemoryValuationReferenceDataPort(references));
}

export { evidenceRefFor };
import { asValuationPolicyVersion, valuationPolicyIdFor } from './ids.ts';
import type { PermittedValuationMethod } from './methods.ts';
import type { AllowedValuationInputType } from './inputs.ts';
import type { RegisterableValuationPolicy } from './policy.ts';

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
