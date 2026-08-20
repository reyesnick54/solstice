/**
 * Production-candidate valuation policy constructor.
 *
 * A candidate may be STRUCTURALLY_COMPLETE or VALUES_UNCONFIGURED.
 * Numeric bases, factors, floors, and ceilings are never invented here.
 */

import { createHash } from 'node:crypto';

import {
  CONTRIBUTION_CLASSES,
  MEASUREMENT_UNITS,
  type ContributionClass,
  type MeasurementUnit,
} from '../../taxonomy.ts';
import {
  HUMAN_CONTRIBUTION_VALUATION_CONSTITUTION,
  PRODUCTION_VALUATION_POLICY_CONFIGURED,
} from '../constitution.ts';

import { validateFactorRule, type ProductionCandidateFactorRule } from './factors.ts';
import { scanForbiddenScheduleDimensions, validateScheduleEntry, type BaseValueScheduleEntry } from './schedule.ts';
import {
  MEASUREMENT_BASES,
  NO_PRODUCTION_ECONOMIC_MEANING,
  PRODUCTION_CANDIDATE_VALUATION_ID,
  PRODUCTION_CANDIDATE_VALUATION_POLICY_VERSION,
  PRODUCTION_CANDIDATE_VALUATION_SCHEMA_VERSION,
  PURPOSE_CLASSES,
  REHEARSAL_FIXTURE,
  type FloorCeilingPolicy,
  type HumanContributionProductionValuationPolicyCandidate,
  type MeasurementBasis,
  type PolicySourceClass,
  type PolicyVersionBinding,
  type PurposeClass,
} from './types.ts';

export const HARDCODED_FIAT_DENOMINATIONS = ['USD', 'EUR', 'SAR', 'GBP'] as const;
export const SUNREY_DENOMINATIONS = ['SUNREY', 'SUNREY_COIN', 'MOONREY', 'MOONREY_COIN'] as const;

export type PolicyCandidateDraft = {
  readonly policyId?: string;
  readonly policyVersion?: string;
  readonly eligibleContributionClasses?: readonly ContributionClass[];
  readonly eligibleMeasurementBases?: readonly MeasurementBasis[];
  readonly eligibleMeasurementUnits?: readonly MeasurementUnit[];
  readonly referenceDenomination: string;
  readonly baseValueSchedule?: readonly BaseValueScheduleEntry[];
  readonly factorPolicy?: readonly ProductionCandidateFactorRule[];
  readonly floorPolicy?: FloorCeilingPolicy;
  readonly ceilingPolicy?: FloorCeilingPolicy;
  readonly rightsPolicyReference: PolicyVersionBinding;
  readonly verificationPolicyReference: PolicyVersionBinding;
  readonly economicAssetVerificationReference: PolicyVersionBinding;
  readonly HINPolicyReference: PolicyVersionBinding;
  readonly chainAnchorPolicyReference: PolicyVersionBinding;
  readonly jurisdictionPolicyReference: PolicyVersionBinding;
  readonly governanceReference: string;
  readonly effectiveHeightCandidate?: bigint | null;
  readonly sourceClass?: PolicySourceClass;
  readonly fixture?: boolean;
};

export function unconfiguredNumeric(): { readonly status: 'UNCONFIGURED'; readonly value: null } {
  return Object.freeze({ status: 'UNCONFIGURED', value: null });
}

export function configuredNumeric(value: bigint): { readonly status: 'CONFIGURED'; readonly value: bigint } {
  if (typeof value !== 'bigint') {
    throw new TypeError('configured numeric policy values must be bigint');
  }
  return Object.freeze({ status: 'CONFIGURED', value });
}

export function emptyUnconfiguredSchedule(
  contributionClass: ContributionClass,
  measurementBasis: MeasurementBasis,
  measurementUnit: MeasurementUnit,
  purposeClass: PurposeClass,
): BaseValueScheduleEntry {
  return Object.freeze({
    contributionClass,
    measurementBasis,
    measurementUnit,
    purposeClass,
    verifiedEventType: 'VERIFIED_CONTRIBUTION_EVENT',
    jurisdictionPolicyClass: null,
    baseValue: unconfiguredNumeric(),
  });
}

export function hashValuationPolicyCandidate(
  policy: Omit<HumanContributionProductionValuationPolicyCandidate, 'policyHash'>,
): string {
  const material = [
    'SUNREY_PRODUCTION_CANDIDATE_VALUATION_POLICY_V1',
    policy.policyId,
    policy.policyVersion,
    String(policy.schemaVersion),
    [...policy.eligibleContributionClasses].join(','),
    [...policy.eligibleMeasurementBases].join(','),
    [...policy.eligibleMeasurementUnits].join(','),
    policy.referenceDenomination,
    JSON.stringify(
      policy.baseValueSchedule.map((row) => ({
        ...row,
        baseValue: { status: row.baseValue.status, value: row.baseValue.value?.toString() ?? null },
      })),
    ),
    JSON.stringify(
      policy.factorPolicy.map((row) => ({
        factor: row.factor,
        roundingRule: row.roundingRule,
        multiplier:
          row.multiplier.kind === 'BASIS_POINTS'
            ? { kind: 'BASIS_POINTS', points: row.multiplier.points.value?.toString() ?? null }
            : {
                kind: 'RATIONAL',
                numerator: row.multiplier.numerator.value?.toString() ?? null,
                denominator: row.multiplier.denominator.value?.toString() ?? null,
              },
      })),
    ),
    `${policy.floorPolicy.amount.status}:${policy.floorPolicy.amount.value?.toString() ?? ''}:${policy.floorPolicy.denomination ?? ''}`,
    `${policy.ceilingPolicy.amount.status}:${policy.ceilingPolicy.amount.value?.toString() ?? ''}:${policy.ceilingPolicy.denomination ?? ''}`,
    bindingMaterial(policy.rightsPolicyReference),
    bindingMaterial(policy.verificationPolicyReference),
    bindingMaterial(policy.economicAssetVerificationReference),
    bindingMaterial(policy.HINPolicyReference),
    bindingMaterial(policy.chainAnchorPolicyReference),
    bindingMaterial(policy.jurisdictionPolicyReference),
    policy.governanceReference,
    policy.effectiveHeightCandidate?.toString() ?? '',
    policy.sourceClass,
    policy.fixture ? '1' : '0',
    'productionActivated=false',
  ].join('|');
  return createHash('sha256').update(material).digest('hex');
}

function bindingMaterial(binding: PolicyVersionBinding): string {
  return `${binding.key}:${binding.versionId}:${binding.contentHash}`;
}

function defaultEligibleClasses(): readonly ContributionClass[] {
  return CONTRIBUTION_CLASSES;
}

function defaultUnits(): readonly MeasurementUnit[] {
  return MEASUREMENT_UNITS;
}

export function createValuationPolicyCandidate(
  draft: PolicyCandidateDraft,
): HumanContributionProductionValuationPolicyCandidate {
  const schedule = Object.freeze([...(draft.baseValueSchedule ?? [])]);
  const factors = Object.freeze([...(draft.factorPolicy ?? [])]);
  const floor = draft.floorPolicy ?? { amount: unconfiguredNumeric(), denomination: null };
  const ceiling = draft.ceilingPolicy ?? { amount: unconfiguredNumeric(), denomination: null };
  const valuesConfigured =
    schedule.length > 0 &&
    schedule.every((row) => row.baseValue.status === 'CONFIGURED') &&
    (factors.length === 0 || factors.every((rule) => factorConfigured(rule))) &&
    floor.amount.status === 'CONFIGURED' &&
    ceiling.amount.status === 'CONFIGURED';
  const fixture = draft.fixture === true;
  const sourceClass = draft.sourceClass ?? (fixture ? 'FIXTURE' : 'UNCONFIGURED');
  const candidate: Omit<HumanContributionProductionValuationPolicyCandidate, 'policyHash'> = {
    policyId: draft.policyId ?? PRODUCTION_CANDIDATE_VALUATION_ID,
    policyVersion: draft.policyVersion ?? PRODUCTION_CANDIDATE_VALUATION_POLICY_VERSION,
    schemaVersion: PRODUCTION_CANDIDATE_VALUATION_SCHEMA_VERSION,
    eligibleContributionClasses: Object.freeze([...(draft.eligibleContributionClasses ?? defaultEligibleClasses())]),
    eligibleMeasurementBases: Object.freeze([...(draft.eligibleMeasurementBases ?? MEASUREMENT_BASES)]),
    eligibleMeasurementUnits: Object.freeze([...(draft.eligibleMeasurementUnits ?? defaultUnits())]),
    referenceDenomination: draft.referenceDenomination,
    baseValueSchedule: schedule,
    factorPolicy: factors,
    floorPolicy: Object.freeze(floor),
    ceilingPolicy: Object.freeze(ceiling),
    rightsPolicyReference: Object.freeze(draft.rightsPolicyReference),
    verificationPolicyReference: Object.freeze(draft.verificationPolicyReference),
    economicAssetVerificationReference: Object.freeze(draft.economicAssetVerificationReference),
    HINPolicyReference: Object.freeze(draft.HINPolicyReference),
    chainAnchorPolicyReference: Object.freeze(draft.chainAnchorPolicyReference),
    jurisdictionPolicyReference: Object.freeze(draft.jurisdictionPolicyReference),
    governanceReference: draft.governanceReference,
    effectiveHeightCandidate: draft.effectiveHeightCandidate ?? null,
    sourceClass,
    fixture,
    rehearsalOnly: true,
    productionActivated: false,
    completeness: valuesConfigured ? 'STRUCTURALLY_COMPLETE' : 'VALUES_UNCONFIGURED',
    referenceValueEqualsSunReyByDefinition: false,
    valuationIsHumanWorth: false,
    peveUsedAsTokenFormula: false,
    productionValuesGoverned: false,
    fixtureAuthorizesProduction: false,
    rehearsalFixtureLabel: fixture ? REHEARSAL_FIXTURE : null,
    economicMeaning: fixture || !valuesConfigured ? NO_PRODUCTION_ECONOMIC_MEANING : 'UNCONFIGURED',
  };
  return Object.freeze({
    ...candidate,
    policyHash: hashValuationPolicyCandidate(candidate),
  });
}

function factorConfigured(rule: ProductionCandidateFactorRule): boolean {
  if (rule.multiplier.kind === 'BASIS_POINTS') {
    return rule.multiplier.points.status === 'CONFIGURED';
  }
  return rule.multiplier.numerator.status === 'CONFIGURED' && rule.multiplier.denominator.status === 'CONFIGURED';
}

export function structurallyCompleteWithoutValues(
  draft: Omit<PolicyCandidateDraft, 'baseValueSchedule' | 'factorPolicy' | 'floorPolicy' | 'ceilingPolicy'> & {
    readonly contributionClass: ContributionClass;
    readonly measurementBasis: MeasurementBasis;
    readonly measurementUnit: MeasurementUnit;
    readonly purposeClass?: PurposeClass;
  },
): HumanContributionProductionValuationPolicyCandidate {
  return createValuationPolicyCandidate({
    ...draft,
    baseValueSchedule: [
      emptyUnconfiguredSchedule(
        draft.contributionClass,
        draft.measurementBasis,
        draft.measurementUnit,
        draft.purposeClass ?? 'VERIFIED_HUMAN_ECONOMIC_CONTRIBUTION',
      ),
    ],
    factorPolicy: Object.freeze([
      {
        factor: 'VERIFICATION_QUALITY',
        multiplier: { kind: 'RATIONAL', numerator: unconfiguredNumeric(), denominator: unconfiguredNumeric() },
        roundingRule: 'FLOOR',
      },
    ]),
    floorPolicy: { amount: unconfiguredNumeric(), denomination: draft.referenceDenomination },
    ceilingPolicy: { amount: unconfiguredNumeric(), denomination: draft.referenceDenomination },
  });
}

export function constitutionRemainsUnweakened(): boolean {
  return (
    HUMAN_CONTRIBUTION_VALUATION_CONSTITUTION.VALUATION_IS_EVENT_SPECIFIC === true &&
    HUMAN_CONTRIBUTION_VALUATION_CONSTITUTION.VALUATION_IS_NOT_HUMAN_WORTH === true &&
    HUMAN_CONTRIBUTION_VALUATION_CONSTITUTION.VALUATION_IS_NOT_PEVE === true &&
    HUMAN_CONTRIBUTION_VALUATION_CONSTITUTION.VALUATION_IS_NOT_CREDIT_SCORE === true &&
    HUMAN_CONTRIBUTION_VALUATION_CONSTITUTION.VALUATION_IS_NOT_SOCIAL_CREDIT === true &&
    HUMAN_CONTRIBUTION_VALUATION_CONSTITUTION.VALUATION_DOES_NOT_MINT === true &&
    HUMAN_CONTRIBUTION_VALUATION_CONSTITUTION.PROTECTED_TRAIT_VALUATION_FORBIDDEN === true &&
    HUMAN_CONTRIBUTION_VALUATION_CONSTITUTION.PERSON_LEVEL_DESIRABILITY_MULTIPLIER_FORBIDDEN === true &&
    PRODUCTION_VALUATION_POLICY_CONFIGURED === false &&
    HUMAN_CONTRIBUTION_VALUATION_CONSTITUTION.productionValuationActive === false
  );
}

export { validateFactorRule, validateScheduleEntry, scanForbiddenScheduleDimensions, PURPOSE_CLASSES };
