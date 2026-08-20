/**
 * Structural validation for production-candidate valuation policies.
 *
 * Does not activate production valuation. Missing numeric values are
 * reported as VALUES_UNCONFIGURED, which is a valid candidate state.
 */

import { err, ok, type Result } from '../../../../domain/src/result.ts';
import { isContributionClass, isMeasurementUnit } from '../../taxonomy.ts';

import { bindingRejectedAsLatest } from './bindings.ts';
import { isForbiddenPersonLevelMultiplier, validateFactorRule } from './factors.ts';
import { HARDCODED_FIAT_DENOMINATIONS, SUNREY_DENOMINATIONS } from './policy.ts';
import { scanForbiddenScheduleDimensions, validateScheduleEntry } from './schedule.ts';
import {
  MEASUREMENT_BASES,
  valuationCandidateFailure,
  type HumanContributionProductionValuationPolicyCandidate,
  type ProductionCandidateValuationFailure,
  type ValuationPolicyCandidateValidationResult,
} from './types.ts';

const FORBIDDEN_PAYLOAD_KEYS = [
  'peveScore',
  'peve_score',
  'peveComposite',
  'humanWorthScore',
  'human_worth_score',
  'creditScore',
  'socialCreditScore',
  'race',
  'religion',
  'ethnicity',
  'sex',
  'sexualOrientation',
  'healthCondition',
  'politicalAffiliation',
  'celebrityMultiplier',
  'incomeMultiplier',
  'netWorthMultiplier',
  'followerCount',
  'citizenshipDesirability',
  'creditworthinessMultiplier',
  'personalPrestigeMultiplier',
] as const;

export function validateValuationPolicyCandidate(
  policy: HumanContributionProductionValuationPolicyCandidate,
): ValuationPolicyCandidateValidationResult {
  if (policy.schemaVersion !== 1) {
    return valuationCandidateFailure('POLICY_SCHEMA_INVALID', 'schemaVersion must be 1');
  }
  if (policy.productionActivated !== false) {
    return valuationCandidateFailure('PRODUCTION_VALUATION_UNAVAILABLE', 'production valuation cannot be activated');
  }
  if (policy.rehearsalOnly !== true) {
    return valuationCandidateFailure('POLICY_SCHEMA_INVALID', 'production-candidate policies are rehearsalOnly');
  }
  if (policy.referenceValueEqualsSunReyByDefinition !== false) {
    return valuationCandidateFailure('DENOMINATION_IS_SUNREY', 'REFERENCE_VALUE_EQUALS_SUNREY_BY_DEFINITION must be false');
  }
  if (policy.valuationIsHumanWorth !== false || policy.peveUsedAsTokenFormula !== false) {
    return valuationCandidateFailure('HUMAN_WORTH_FORBIDDEN', 'valuation cannot be human worth or PEVE');
  }
  if ((SUNREY_DENOMINATIONS as readonly string[]).includes(policy.referenceDenomination)) {
    return valuationCandidateFailure('DENOMINATION_IS_SUNREY', 'reference denomination cannot be a SunRey quantity');
  }
  if ((HARDCODED_FIAT_DENOMINATIONS as readonly string[]).includes(policy.referenceDenomination)) {
    return valuationCandidateFailure(
      'DENOMINATION_HARDCODED_FIAT',
      'do not hardcode USD/EUR/SAR unless an externally governed production policy chooses a denomination',
    );
  }
  if (policy.referenceDenomination.trim().length === 0) {
    return valuationCandidateFailure('POLICY_SCHEMA_INVALID', 'referenceDenomination is a required policy field');
  }
  if (policy.eligibleContributionClasses.length === 0) {
    return valuationCandidateFailure('POLICY_SCHEMA_INVALID', 'eligibleContributionClasses cannot be empty');
  }
  for (const contributionClass of policy.eligibleContributionClasses) {
    if (!isContributionClass(contributionClass)) {
      return valuationCandidateFailure('POLICY_SCHEMA_INVALID', `unknown contribution class '${contributionClass}'`);
    }
  }
  for (const basis of policy.eligibleMeasurementBases) {
    if (!(MEASUREMENT_BASES as readonly string[]).includes(basis)) {
      return valuationCandidateFailure('POLICY_SCHEMA_INVALID', `unknown measurement basis '${basis}'`);
    }
  }
  for (const unit of policy.eligibleMeasurementUnits) {
    if (!isMeasurementUnit(unit)) {
      return valuationCandidateFailure('POLICY_SCHEMA_INVALID', `unknown measurement unit '${unit}'`);
    }
  }
  const payloadScan = scanForbiddenPayload(policy);
  if (!payloadScan.ok) {
    return payloadScan.error;
  }
  const forbidden = scanForbiddenScheduleDimensions(policy);
  if (!forbidden.ok) {
    return forbidden.error;
  }
  for (const entry of policy.baseValueSchedule) {
    const schedule = validateScheduleEntry(entry);
    if (!schedule.ok) {
      return schedule.error;
    }
  }
  for (const rule of policy.factorPolicy) {
    if (isForbiddenPersonLevelMultiplier(rule.factor)) {
      return valuationCandidateFailure(
        'PERSON_LEVEL_MULTIPLIER_FORBIDDEN',
        `person-level desirability multiplier '${rule.factor}' is forbidden`,
      );
    }
    const factor = validateFactorRule(rule);
    if (!factor.ok) {
      return factor.error;
    }
  }
  const bindings = [
    policy.rightsPolicyReference,
    policy.verificationPolicyReference,
    policy.economicAssetVerificationReference,
    policy.HINPolicyReference,
    policy.chainAnchorPolicyReference,
    policy.jurisdictionPolicyReference,
  ];
  for (const binding of bindings) {
    if (bindingRejectedAsLatest(binding.versionId)) {
      return valuationCandidateFailure('BINDING_LATEST_REJECTED', `binding '${binding.key}' cannot use latest`);
    }
    if (binding.versionId.trim().length === 0 || binding.contentHash.trim().length === 0) {
      return valuationCandidateFailure('POLICY_SCHEMA_INVALID', `binding '${binding.key}' requires versionId and contentHash`);
    }
  }
  if (policy.fixture && policy.sourceClass !== 'FIXTURE' && policy.sourceClass !== 'REHEARSAL') {
    return valuationCandidateFailure(
      'FIXTURE_CANNOT_AUTHORIZE_PRODUCTION',
      'a fixture policy cannot claim a governed production source class',
    );
  }
  if (policy.completeness === 'VALUES_UNCONFIGURED') {
    return { ok: true, value: policy };
  }
  const valuesReady =
    policy.baseValueSchedule.length > 0 &&
    policy.baseValueSchedule.every((row) => row.baseValue.status === 'CONFIGURED') &&
    policy.floorPolicy.amount.status === 'CONFIGURED' &&
    policy.ceilingPolicy.amount.status === 'CONFIGURED';
  if (policy.completeness === 'STRUCTURALLY_COMPLETE' && !valuesReady && !hasUnconfiguredMarker(policy)) {
    return valuationCandidateFailure('VALUES_UNCONFIGURED', 'numeric policy values are unconfigured');
  }
  return { ok: true, value: policy };
}

export function reportUnconfiguredValues(
  policy: HumanContributionProductionValuationPolicyCandidate,
): readonly string[] {
  const missing: string[] = [];
  if (policy.baseValueSchedule.length === 0) {
    missing.push('baseValueSchedule');
  }
  for (const [index, row] of policy.baseValueSchedule.entries()) {
    if (row.baseValue.status !== 'CONFIGURED') {
      missing.push(`baseValueSchedule[${index}]`);
    }
  }
  for (const [index, rule] of policy.factorPolicy.entries()) {
    if (rule.multiplier.kind === 'BASIS_POINTS' && rule.multiplier.points.status !== 'CONFIGURED') {
      missing.push(`factorPolicy[${index}].points`);
    }
    if (rule.multiplier.kind === 'RATIONAL') {
      if (rule.multiplier.numerator.status !== 'CONFIGURED') {
        missing.push(`factorPolicy[${index}].numerator`);
      }
      if (rule.multiplier.denominator.status !== 'CONFIGURED') {
        missing.push(`factorPolicy[${index}].denominator`);
      }
    }
  }
  if (policy.floorPolicy.amount.status !== 'CONFIGURED') {
    missing.push('floorPolicy');
  }
  if (policy.ceilingPolicy.amount.status !== 'CONFIGURED') {
    missing.push('ceilingPolicy');
  }
  return Object.freeze(missing);
}

function hasUnconfiguredMarker(policy: HumanContributionProductionValuationPolicyCandidate): boolean {
  return reportUnconfiguredValues(policy).length > 0;
}

function scanForbiddenPayload(
  input: unknown,
): Result<true, ProductionCandidateValuationFailure> {
  const keys: string[] = [];
  walkKeys(input, keys);
  for (const key of keys) {
    const lower = key.toLowerCase();
    if ((FORBIDDEN_PAYLOAD_KEYS as readonly string[]).some((item) => item.toLowerCase() === lower)) {
      if (lower.includes('peve')) {
        return err(valuationCandidateFailure('PEVE_FORBIDDEN', `PEVE field '${key}' cannot be a valuation input`));
      }
      if (lower.includes('humanworth') || lower.includes('human_worth')) {
        return err(valuationCandidateFailure('HUMAN_WORTH_FORBIDDEN', `human-worth field '${key}' cannot be a valuation input`));
      }
      if (
        lower.includes('race') ||
        lower.includes('religion') ||
        lower.includes('ethnicity') ||
        lower === 'sex' ||
        lower.includes('sexual') ||
        lower.includes('health') ||
        lower.includes('political')
      ) {
        return err(valuationCandidateFailure('PROTECTED_TRAIT_FORBIDDEN', `protected trait '${key}' is forbidden`));
      }
      return err(
        valuationCandidateFailure(
          'PERSON_LEVEL_MULTIPLIER_FORBIDDEN',
          `person-level field '${key}' cannot be a valuation factor`,
        ),
      );
    }
  }
  return ok(true);
}

function walkKeys(value: unknown, keys: string[]): void {
  if (!value || typeof value !== 'object') {
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      walkKeys(item, keys);
    }
    return;
  }
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    keys.push(key);
    walkKeys(item, keys);
  }
}
