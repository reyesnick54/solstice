import { err, ok, type Result } from '../../../domain/src/result.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import {
  ageThresholdSatisfiedAssertion,
  assertNoRawPayload,
  computationCompletedAssertion,
  createPrivacyAssertion,
  credentialValidAssertion,
} from './claims.ts';
import { denyOverbroadFieldRequest, minimizeRecord, type VerificationPurpose } from './minimization-policy.ts';
import type { SelectiveDisclosureProvider } from './selective-disclosure.ts';
import type { AssertionFailure, PrivacyAssertion } from './types.ts';

export type ClaimDisclosureRequest = {
  readonly subjectCommitment: string;
  readonly purposeId: string;
  readonly boundPurposeId: string;
  readonly verificationPurpose: VerificationPurpose;
  readonly requestedFields?: readonly string[];
  readonly evidenceCommitmentHash: string;
  readonly evaluatedAt: UtcInstant;
  readonly sourceDeleted?: boolean;
  readonly commitmentStillVerifiable?: boolean;
};

export type ClaimDisclosureServiceOptions = {
  readonly selectiveDisclosure?: SelectiveDisclosureProvider;
};

export class ClaimDisclosureService {
  readonly #selectiveDisclosure: SelectiveDisclosureProvider | undefined;

  constructor(options: ClaimDisclosureServiceOptions = {}) {
    this.#selectiveDisclosure = options.selectiveDisclosure;
  }

  issueMinimalAssertion(request: ClaimDisclosureRequest): Result<PrivacyAssertion, AssertionFailure> {
    if (request.purposeId !== request.boundPurposeId) {
      return err({
        code: 'PURPOSE_MISMATCH',
        message: `purpose ${request.purposeId} does not match bound purpose ${request.boundPurposeId}`,
      });
    }
    if (!request.evidenceCommitmentHash || request.evidenceCommitmentHash.length < 16) {
      return err({ code: 'EVIDENCE_MISSING', message: 'evidence commitment is required' });
    }
    if (request.sourceDeleted && request.commitmentStillVerifiable) {
      return this.#deletedSourceAssertion(request);
    }
    const fields = denyOverbroadFieldRequest({
      purpose: request.verificationPurpose,
      requestedFields: request.requestedFields ?? [],
    });
    if (!fields.ok) {
      return fields;
    }
    const assertion = this.#buildAssertion(request, fields.value);
    assertNoRawPayload(assertion);
    return ok(assertion);
  }

  selectiveDisclosureProvider(): SelectiveDisclosureProvider | undefined {
    return this.#selectiveDisclosure;
  }

  #deletedSourceAssertion(request: ClaimDisclosureRequest): Result<PrivacyAssertion, AssertionFailure> {
    const assertion = createPrivacyAssertion({
      assertionType: 'ContributionVerified',
      subjectCommitment: request.subjectCommitment,
      purposeId: request.purposeId,
      satisfied: true,
      evidenceRefs: Object.freeze([{ evidenceCommitmentHash: request.evidenceCommitmentHash }]),
      disclosedFields: Object.freeze(['commitmentVerifiable', 'sourceDeleted']),
      evaluatedAt: request.evaluatedAt,
      seed: 'deleted-source',
    });
    assertNoRawPayload(assertion);
    return ok(assertion);
  }

  #buildAssertion(
    request: ClaimDisclosureRequest,
    allowedFields: readonly string[],
  ): PrivacyAssertion {
    switch (request.verificationPurpose) {
      case 'credentialStatus':
        return credentialValidAssertion({
          subjectCommitment: request.subjectCommitment,
          purposeId: request.purposeId,
          evidenceCommitmentHash: request.evidenceCommitmentHash,
          credentialStatus: 'VALID',
          evaluatedAt: request.evaluatedAt,
        });
      case 'ageThreshold':
        return ageThresholdSatisfiedAssertion({
          subjectCommitment: request.subjectCommitment,
          purposeId: request.purposeId,
          evidenceCommitmentHash: request.evidenceCommitmentHash,
          minimumAgeYears: 18,
          thresholdSatisfied: true,
          evaluatedAt: request.evaluatedAt,
        });
      case 'computationCompleted':
        return computationCompletedAssertion({
          subjectCommitment: request.subjectCommitment,
          purposeId: request.purposeId,
          evidenceCommitmentHash: request.evidenceCommitmentHash,
          computationReceiptRef: `receipt:${request.evidenceCommitmentHash.slice(0, 16)}`,
          evaluatedAt: request.evaluatedAt,
        });
      default: {
        const minimized = minimizeRecord(
          {
            purposeId: request.purposeId,
            authorized: true,
            employmentStatus: 'VERIFIED',
            employerRef: 'employer:simulation',
            contributionClass: 'INFORMATION_RIGHT_CONTRIBUTION',
            verificationState: 'VERIFIED',
            jurisdictionCode: 'US',
            satisfied: true,
            outputClass: 'AGGREGATE_STATISTIC',
          },
          allowedFields,
        );
        const assertionType =
          request.verificationPurpose === 'employmentVerified'
            ? 'EmploymentVerified'
            : request.verificationPurpose === 'contributionVerified'
              ? 'ContributionVerified'
              : request.verificationPurpose === 'jurisdictionSatisfied'
                ? 'JurisdictionSatisfied'
                : 'DatasetUsageAuthorized';
        return createPrivacyAssertion({
          assertionType,
          subjectCommitment: request.subjectCommitment,
          purposeId: request.purposeId,
          satisfied: true,
          evidenceRefs: Object.freeze([{ evidenceCommitmentHash: request.evidenceCommitmentHash }]),
          disclosedFields: Object.freeze(Object.keys(minimized)),
          evaluatedAt: request.evaluatedAt,
        });
      }
    }
  }
}
