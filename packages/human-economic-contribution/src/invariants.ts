import { err, ok, type Result } from '../../domain/src/result.ts';
import { isUtcInstant } from '../../domain/src/time.ts';
import { CONTRIBUTION_ID_PREFIXES } from './ids.ts';
import {
  FORBIDDEN_IDENTITY_FIELDS,
  FORBIDDEN_MONETARY_UNITS,
  FORBIDDEN_SCORE_FIELDS,
  HUMAN_CONTRIBUTION_TAXONOMY,
  PROTECTED_TRAIT_FIELDS,
  SOURCE_QUALITY_LOCK,
  informationRightsRequired,
  isMeasurementUnit,
  isNonAuthoritativeSource,
  usageReceiptRequired,
} from './taxonomy.ts';
import type {
  ContributionFailure,
  HumanContributionEvent,
  RecordContributionInput,
} from './types.ts';

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE = /(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/;
const SSN_RE = /\b\d{3}-\d{2}-\d{4}\b/;
const PASSPORT_RE = /\bpassport[:\s]/i;
const RAW_PDV_RE = /\bpdv[_-]?(raw|content|payload|row)\b/i;
const RAW_CLEAN_ROOM_RE = /\bclean[_-]?room[_-]?(raw|row|rows|payload)\b/i;
const JURISDICTION_RE = /^[A-Z]{2}(?:-[A-Z0-9]{1,8})?$/;

function isCanonicalReference(text: string): boolean {
  return Object.values(CONTRIBUTION_ID_PREFIXES).some((prefix) => text.startsWith(prefix));
}

const FORBIDDEN_KEY_SET = new Set<string>([
  ...FORBIDDEN_IDENTITY_FIELDS,
  ...FORBIDDEN_SCORE_FIELDS,
  ...PROTECTED_TRAIT_FIELDS,
]);

function failure(code: ContributionFailure['code'], message: string): ContributionFailure {
  return Object.freeze({ code, message });
}

function walkKeysAndStrings(value: unknown, keys: string[], strings: string[]): void {
  if (typeof value === 'string') {
    strings.push(value);
    return;
  }
  if (typeof value === 'bigint' || typeof value === 'number' || typeof value === 'boolean' || value === null) {
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      walkKeysAndStrings(item, keys, strings);
    }
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      keys.push(key);
      walkKeysAndStrings(item, keys, strings);
    }
  }
}

export function scanForbiddenPayload(input: unknown): Result<true, ContributionFailure> {
  const keys: string[] = [];
  const strings: string[] = [];
  walkKeysAndStrings(input, keys, strings);

  for (const key of keys) {
    if (FORBIDDEN_KEY_SET.has(key) || FORBIDDEN_KEY_SET.has(key.toLowerCase())) {
      if ((PROTECTED_TRAIT_FIELDS as readonly string[]).includes(key) || (PROTECTED_TRAIT_FIELDS as readonly string[]).includes(key.toLowerCase())) {
        return err(failure('PROTECTED_TRAIT_RANKING_FORBIDDEN', `protected trait '${key}' cannot be a contribution ranking or valuation input`));
      }
      if ((FORBIDDEN_SCORE_FIELDS as readonly string[]).includes(key) || (FORBIDDEN_SCORE_FIELDS as readonly string[]).includes(key.toLowerCase())) {
        return err(failure('HUMAN_WORTH_SCORE_FORBIDDEN', `score or mint field '${key}' is forbidden on a contribution record`));
      }
      if (key === 'rawPdvContent' || key === 'rawPdv' || key === 'raw_pdv') {
        return err(failure('RAW_PDV_CONTENT_FORBIDDEN', 'raw Personal Data Vault content cannot be the canonical contribution record'));
      }
      if (key === 'rawCleanRoomRows' || key === 'rawCleanRoomRow') {
        return err(failure('RAW_CLEAN_ROOM_ROWS_FORBIDDEN', 'raw clean-room rows cannot be the canonical contribution record'));
      }
      return err(failure('RAW_PERSONAL_DATA_FORBIDDEN', `raw identity field '${key}' is forbidden on a contribution record`));
    }
  }

  for (const text of strings) {
    if (isCanonicalReference(text)) {
      continue;
    }
    if (EMAIL_RE.test(text) || PHONE_RE.test(text) || SSN_RE.test(text) || PASSPORT_RE.test(text)) {
      return err(failure('RAW_PERSONAL_DATA_FORBIDDEN', 'raw identity, email, phone, SSN, or passport material is forbidden'));
    }
    if (RAW_PDV_RE.test(text)) {
      return err(failure('RAW_PDV_CONTENT_FORBIDDEN', 'raw Personal Data Vault content cannot be stored on a contribution record'));
    }
    if (RAW_CLEAN_ROOM_RE.test(text)) {
      return err(failure('RAW_CLEAN_ROOM_ROWS_FORBIDDEN', 'raw clean-room rows cannot be stored on a contribution record'));
    }
  }

  return ok(true);
}

export function assertPseudonymousSubject(subjectRef: string): Result<true, ContributionFailure> {
  if (!subjectRef.startsWith(CONTRIBUTION_ID_PREFIXES.subject)) {
    return err(failure('SUBJECT_REF_NOT_PSEUDONYMOUS', 'subjectRef must be a pseudonymous canonical reference'));
  }
  if (EMAIL_RE.test(subjectRef) || subjectRef.includes(' ') || subjectRef.includes('@')) {
    return err(failure('SUBJECT_REF_NOT_PSEUDONYMOUS', 'subjectRef cannot contain legal name, email, or other raw identity'));
  }
  return ok(true);
}

export function assertMeasurement(input: RecordContributionInput): Result<true, ContributionFailure> {
  if (!isMeasurementUnit(input.measurementUnit)) {
    return err(failure('INVALID_MEASUREMENT', 'measurementUnit is not a governed contribution unit'));
  }
  if ((FORBIDDEN_MONETARY_UNITS as readonly string[]).includes(input.measurementUnit)) {
    return err(failure('MEASUREMENT_IS_MONETARY', 'measurement cannot use a monetary or token unit'));
  }
  if (input.measurementQuantity <= 0n) {
    return err(failure('INVALID_MEASUREMENT', 'measurement quantity must be a positive integer count'));
  }
  const extra = input as Record<string, unknown>;
  if ('sunReyQuantity' in extra && extra.sunReyQuantity !== null && extra.sunReyQuantity !== undefined) {
    return err(failure('MEASUREMENT_IS_SUNREY_QUANTITY', 'a contribution cannot carry a SunRey Coin quantity'));
  }
  if ('peveScore' in extra || ('peveScoreUsedAsValue' in extra && extra.peveScoreUsedAsValue === true)) {
    return err(failure('MEASUREMENT_IS_PEVE_SCORE', 'PEVE scores cannot be used as contribution value'));
  }
  return ok(true);
}

export function assertProvenance(input: RecordContributionInput): Result<true, ContributionFailure> {
  if (isNonAuthoritativeSource(input.sourceClass)) {
    const locked = SOURCE_QUALITY_LOCK[input.sourceClass];
    if (input.verificationQuality && input.verificationQuality !== locked) {
      return err(
        failure(
          'PROVENANCE_UPGRADE_FORBIDDEN',
          `${input.sourceClass} cannot silently become ${input.verificationQuality}; it remains ${locked}`,
        ),
      );
    }
    if (input.status === 'VERIFIED') {
      return err(
        failure(
          input.sourceClass === 'MODEL_INFERENCE' ? 'MODEL_INFERENCE_CANNOT_VERIFY' : 'PROVENANCE_UPGRADE_FORBIDDEN',
          input.sourceClass === 'MODEL_INFERENCE'
            ? 'model inference alone cannot constitute a verified economic contribution'
            : `${input.sourceClass} cannot enter VERIFIED lifecycle by itself`,
        ),
      );
    }
  }
  return ok(true);
}

export function assertInformationRights(input: RecordContributionInput): Result<true, ContributionFailure> {
  if (!informationRightsRequired(input.contributionClass)) {
    return ok(true);
  }
  const rights = input.rightsReferences ?? input.canonicalReferences?.informationRightRefs ?? [];
  const consents = input.consentReferences ?? input.canonicalReferences?.consentGrantRefs ?? [];
  const purposes = input.purposeReferences ?? [];
  if (rights.length === 0 || consents.length === 0 || purposes.length === 0) {
    return err(
      failure(
        'INFORMATION_RIGHTS_REQUIRED',
        `${input.contributionClass} requires consent, purpose, and information-right references; raw PDV content is never the record`,
      ),
    );
  }
  if (usageReceiptRequired(input.contributionClass)) {
    const receipts = input.usageReceiptReferences ?? input.canonicalReferences?.usageReceiptRefs ?? [];
    if (receipts.length === 0) {
      return err(failure('USAGE_RECEIPT_REQUIRED', `${input.contributionClass} requires a usage-receipt reference`));
    }
  }
  return ok(true);
}

export function assertEligibilityNotAutomatic(input: RecordContributionInput): Result<true, ContributionFailure> {
  const record = HUMAN_CONTRIBUTION_TAXONOMY.records[input.contributionClass];
  if (record.policy.settlementEligibleByDefault !== false || record.policy.issuanceEligibleByDefault !== false) {
    return err(failure('TAXONOMY_DOES_NOT_GRANT_ELIGIBILITY', 'taxonomy class policy must stay ineligible by default'));
  }
  if (input.eligibilityState === 'SETTLEMENT_ELIGIBLE_BY_POLICY' && !input.policyDecisionRef) {
    return err(failure('POLICY_REF_REQUIRED', 'settlement eligibility requires an explicit policy decision reference'));
  }
  return ok(true);
}

export function assertLifecycle(input: RecordContributionInput): Result<true, ContributionFailure> {
  if (input.status === 'VERIFIED' && input.sourceClass === 'MODEL_INFERENCE') {
    return err(failure('MODEL_INFERENCE_CANNOT_VERIFY', 'AI/model inference alone cannot verify a contribution'));
  }
  if (input.validUntil && isUtcInstant(input.validFrom) && isUtcInstant(input.validUntil) && input.validUntil <= input.validFrom) {
    return err(failure('INVALID_LIFECYCLE', 'validUntil must be after validFrom'));
  }
  if (!JURISDICTION_RE.test(input.jurisdiction)) {
    return err(failure('INVALID_LIFECYCLE', 'jurisdiction must be a coded reference, not a personal address'));
  }
  return ok(true);
}

export function validateContributionInput(input: RecordContributionInput): Result<true, ContributionFailure> {
  const payload = scanForbiddenPayload(input);
  if (!payload.ok) {
    return payload;
  }
  const subject = assertPseudonymousSubject(input.subjectRef);
  if (!subject.ok) {
    return subject;
  }
  const measurement = assertMeasurement(input);
  if (!measurement.ok) {
    return measurement;
  }
  const provenance = assertProvenance(input);
  if (!provenance.ok) {
    return provenance;
  }
  const rights = assertInformationRights(input);
  if (!rights.ok) {
    return rights;
  }
  const eligibility = assertEligibilityNotAutomatic(input);
  if (!eligibility.ok) {
    return eligibility;
  }
  return assertLifecycle(input);
}

export function eventHasNoSunReyQuantity(event: HumanContributionEvent): boolean {
  return event.sunReyQuantity === null && event.measurement.isSunReyQuantity === false && event.issuanceEligible === false;
}

export function eventCannotAuthorizeExecution(event: HumanContributionEvent): boolean {
  return (
    event.authorityBoundary.authorizesFinancialExecution === false &&
    event.authorityBoundary.issuesExecutionAuthority === false &&
    event.authorityBoundary.authorizesLedgerPosting === false
  );
}

export function eventCannotAuthorizeMint(event: HumanContributionEvent): boolean {
  return event.authorityBoundary.authorizesSunReyIssuance === false && event.privacyBoundary.automaticMintAuthority === false;
}

export function eventIsNotHumanWorth(event: HumanContributionEvent): boolean {
  return (
    event.humanWorthScore === false &&
    event.privacyBoundary.humanWorthScore === false &&
    event.privacyBoundary.socialCreditScore === false &&
    event.privacyBoundary.creditScore === false &&
    event.privacyBoundary.protectedTraitRanking === false
  );
}
