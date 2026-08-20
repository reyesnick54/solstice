/**
 * Fixture / rehearsal valuation receipt.
 *
 * Computes a reference value from a candidate policy when numeric values
 * are configured. Does not activate the production valuation engine and
 * never produces a SunRey quantity.
 */

import { INFORMATION_RIGHT_REQUIRED_CLASSES } from '../../taxonomy.ts';

import { applyConfiguredFactor, factorValuesConfigured } from './factors.ts';
import { matchScheduleEntry } from './schedule.ts';
import { reportUnconfiguredValues, validateValuationPolicyCandidate } from './validation.ts';
import {
  NO_PRODUCTION_ECONOMIC_MEANING,
  REHEARSAL_FIXTURE,
  valuationCandidateFailure,
  type HumanContributionProductionValuationPolicyCandidate,
  type ProductionCandidateValuationInput,
  type ProductionCandidateValuationResult,
} from './types.ts';

const FORBIDDEN_ACTORS = ['AI', 'S3M', 'GROK', 'MODEL', 'MODEL_OUTPUT', 'AGENT', 'FINANCIAL_AGENT'] as const;

export function valueContributionUnderCandidatePolicy(input: {
  readonly contribution: ProductionCandidateValuationInput;
  readonly policy: HumanContributionProductionValuationPolicyCandidate;
  readonly actor: string;
  readonly extra?: Readonly<Record<string, unknown>>;
}): ProductionCandidateValuationResult {
  if (input.actor === 'AI') {
    return valuationCandidateFailure('AI_CANNOT_AUTHORIZE_VALUATION', 'AI cannot authorize valuation');
  }
  if (input.actor === 'S3M') {
    return valuationCandidateFailure('S3M_CANNOT_AUTHORIZE_VALUATION', 'S3M cannot authorize valuation');
  }
  if (input.actor === 'GROK') {
    return valuationCandidateFailure('GROK_CANNOT_AUTHORIZE_VALUATION', 'Grok cannot authorize valuation');
  }
  if ((FORBIDDEN_ACTORS as readonly string[]).includes(input.actor)) {
    return valuationCandidateFailure('AI_CANNOT_AUTHORIZE_VALUATION', `${input.actor} cannot authorize valuation`);
  }
  if (input.extra && ('peveScore' in input.extra || 'peve' in input.extra)) {
    return valuationCandidateFailure('PEVE_FORBIDDEN', 'PEVE output cannot satisfy production valuation input');
  }
  if (input.extra && ('humanWorthScore' in input.extra || 'humanWorth' in input.extra)) {
    return valuationCandidateFailure('HUMAN_WORTH_FORBIDDEN', 'human-worth scores are forbidden');
  }
  if (input.contribution.peveScoreUsedAsValue !== false) {
    return valuationCandidateFailure('PEVE_FORBIDDEN', 'PEVE cannot become a reference value');
  }
  if (input.contribution.humanWorthScore !== false) {
    return valuationCandidateFailure('HUMAN_WORTH_FORBIDDEN', 'human-worth scores are forbidden');
  }
  const validated = validateValuationPolicyCandidate(input.policy);
  if (!validated.ok) {
    return validated;
  }
  if (input.contribution.verificationState !== 'VERIFIED') {
    return valuationCandidateFailure('CONTRIBUTION_NOT_VERIFIED', 'contribution verification is required');
  }
  if (!input.policy.eligibleContributionClasses.includes(input.contribution.contributionClass)) {
    return valuationCandidateFailure(
      'CONTRIBUTION_CLASS_INELIGIBLE',
      `${input.contribution.contributionClass} is not eligible under this candidate policy`,
    );
  }
  if (!input.policy.eligibleMeasurementBases.includes(input.contribution.measurementBasis)) {
    return valuationCandidateFailure('MEASUREMENT_BASIS_INELIGIBLE', 'measurement basis is not eligible');
  }
  if (!input.policy.eligibleMeasurementUnits.includes(input.contribution.measurementUnit)) {
    return valuationCandidateFailure('MEASUREMENT_UNIT_INELIGIBLE', 'measurement unit is not eligible');
  }
  if (
    (INFORMATION_RIGHT_REQUIRED_CLASSES as readonly string[]).includes(input.contribution.contributionClass) &&
    !(
      input.contribution.rightsEvidencePresent &&
      input.contribution.consentEvidencePresent &&
      input.contribution.provenanceEvidencePresent
    )
  ) {
    return valuationCandidateFailure(
      'POLICY_SCHEMA_INVALID',
      'Information Right contributions require rights, consent, and provenance evidence',
    );
  }
  if (input.contribution.economicAssetVerificationState === 'CHAIN_ANCHORED_ONLY') {
    return valuationCandidateFailure(
      'CHAIN_ANCHOR_IS_NOT_ECONOMIC_VERIFICATION',
      'chain anchored is not economically verified',
    );
  }
  if (
    input.contribution.economicAssetVerificationState !== 'NOT_APPLICABLE' &&
    input.contribution.economicAssetVerificationState !== 'VERIFIED'
  ) {
    return valuationCandidateFailure(
      'ECONOMIC_ASSET_NOT_VERIFIED',
      'economic asset verification is required where a contribution references an Economic Asset',
    );
  }
  const missing = reportUnconfiguredValues(input.policy);
  if (missing.length > 0) {
    return valuationCandidateFailure('VALUES_UNCONFIGURED', `numeric policy values unconfigured: ${missing.join(',')}`);
  }
  const matched = matchScheduleEntry(input.policy.baseValueSchedule, {
    contributionClass: input.contribution.contributionClass,
    measurementBasis: input.contribution.measurementBasis,
    measurementUnit: input.contribution.measurementUnit,
    purposeClass: input.contribution.purposeClass,
    verifiedEventType: input.contribution.verifiedEventType,
    jurisdictionPolicyClass: input.contribution.jurisdictionPolicyClass,
  });
  if (!matched || matched.baseValue.status !== 'CONFIGURED' || matched.baseValue.value === null) {
    return valuationCandidateFailure('VALUES_UNCONFIGURED', 'no configured base value matches this verified event');
  }
  if (typeof input.contribution.measurementQuantity !== 'bigint') {
    return valuationCandidateFailure('FLOAT_MONETARY_MATH_FORBIDDEN', 'measurement quantity must be bigint');
  }
  let reference = matched.baseValue.value * input.contribution.measurementQuantity;
  const applied: string[] = [];
  for (const rule of input.policy.factorPolicy) {
    if (!factorValuesConfigured(rule)) {
      return valuationCandidateFailure('VALUES_UNCONFIGURED', `factor '${rule.factor}' is unconfigured`);
    }
    const next = applyConfiguredFactor(reference, rule);
    if (!next.ok) {
      return next.error;
    }
    reference = next.value;
    applied.push(rule.factor);
  }
  if (input.policy.floorPolicy.amount.status === 'CONFIGURED' && reference < input.policy.floorPolicy.amount.value) {
    reference = input.policy.floorPolicy.amount.value;
  }
  if (input.policy.ceilingPolicy.amount.status === 'CONFIGURED' && reference > input.policy.ceilingPolicy.amount.value) {
    reference = input.policy.ceilingPolicy.amount.value;
  }
  return {
    ok: true,
    receipt: Object.freeze({
      schemaVersion: 1,
      valuationId: `hcv.candidate.${input.contribution.contributionId}.${input.policy.policyVersion}`,
      contributionId: input.contribution.contributionId,
      fingerprint: input.contribution.fingerprint,
      policyId: input.policy.policyId,
      policyVersion: input.policy.policyVersion,
      policyHash: input.policy.policyHash,
      referenceValue: reference,
      referenceDenomination: input.policy.referenceDenomination,
      factorsApplied: Object.freeze(applied),
      completeness: input.policy.completeness,
      sourceClass: input.policy.sourceClass,
      fixture: input.policy.fixture,
      rehearsalOnly: true,
      productionActivated: false,
      referenceValueEqualsSunReyByDefinition: false,
      valuationIsHumanWorth: false,
      peveUsedAsTokenFormula: false,
      sunReyQuantity: null,
      rehearsalFixtureLabel: input.policy.fixture ? REHEARSAL_FIXTURE : null,
      economicMeaning: NO_PRODUCTION_ECONOMIC_MEANING,
    }),
  };
}
