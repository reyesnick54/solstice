import { asUtcInstant } from '../../../domain/src/time.ts';
import { fixtureContribution, FIXTURE_NOW } from '../fixtures.ts';
import { evidenceRefFor } from '../ids.ts';
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
  const submitted = registry.submit({
    ...fixtureContribution(contributionClass, seed),
    measurementQuantity: quantity,
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
