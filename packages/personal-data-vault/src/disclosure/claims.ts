import { sha256Hex } from '../../../security/src/hash.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import type { AssertionType, EvidenceReference, PrivacyAssertion } from './types.ts';

const POLICY_VERSION = 'wave7-privacy-assertion-v1';

export type AssertionInput = {
  readonly assertionType: AssertionType;
  readonly subjectCommitment: string;
  readonly purposeId: string;
  readonly satisfied: boolean;
  readonly evidenceRefs: readonly EvidenceReference[];
  readonly disclosedFields?: readonly string[];
  readonly evaluatedAt: UtcInstant;
  readonly seed?: string;
};

export function assertionIdFor(input: Pick<AssertionInput, 'assertionType' | 'subjectCommitment' | 'purposeId' | 'evaluatedAt' | 'seed'>): string {
  return `assert:${sha256Hex(
    JSON.stringify({
      assertionType: input.assertionType,
      subjectCommitment: input.subjectCommitment,
      purposeId: input.purposeId,
      evaluatedAt: input.evaluatedAt,
      seed: input.seed ?? '',
    }),
  ).slice(0, 24)}`;
}

export function createPrivacyAssertion(input: AssertionInput): PrivacyAssertion {
  return Object.freeze({
    assertionId: assertionIdFor(input),
    assertionType: input.assertionType,
    subjectCommitment: input.subjectCommitment,
    purposeId: input.purposeId,
    satisfied: input.satisfied,
    evidenceRefs: Object.freeze([...input.evidenceRefs]),
    disclosedFields: Object.freeze([...(input.disclosedFields ?? [])]),
    rawDataIncluded: false,
    evaluatedAt: input.evaluatedAt,
    policyVersion: POLICY_VERSION,
  });
}

export function credentialValidAssertion(input: {
  readonly subjectCommitment: string;
  readonly purposeId: string;
  readonly evidenceCommitmentHash: string;
  readonly credentialStatus: 'VALID' | 'EXPIRED' | 'REVOKED';
  readonly evaluatedAt: UtcInstant;
}): PrivacyAssertion {
  return createPrivacyAssertion({
    assertionType: 'CredentialValid',
    subjectCommitment: input.subjectCommitment,
    purposeId: input.purposeId,
    satisfied: input.credentialStatus === 'VALID',
    evidenceRefs: Object.freeze([
      { evidenceCommitmentHash: input.evidenceCommitmentHash },
    ]),
    disclosedFields: Object.freeze(['credentialStatus']),
    evaluatedAt: input.evaluatedAt,
  });
}

export function ageThresholdSatisfiedAssertion(input: {
  readonly subjectCommitment: string;
  readonly purposeId: string;
  readonly evidenceCommitmentHash: string;
  readonly minimumAgeYears: number;
  readonly thresholdSatisfied: boolean;
  readonly evaluatedAt: UtcInstant;
}): PrivacyAssertion {
  return createPrivacyAssertion({
    assertionType: 'AgeThresholdSatisfied',
    subjectCommitment: input.subjectCommitment,
    purposeId: input.purposeId,
    satisfied: input.thresholdSatisfied,
    evidenceRefs: Object.freeze([
      { evidenceCommitmentHash: input.evidenceCommitmentHash },
    ]),
    disclosedFields: Object.freeze(['minimumAgeYears', 'thresholdSatisfied']),
    evaluatedAt: input.evaluatedAt,
  });
}

export function computationCompletedAssertion(input: {
  readonly subjectCommitment: string;
  readonly purposeId: string;
  readonly evidenceCommitmentHash: string;
  readonly computationReceiptRef: string;
  readonly evaluatedAt: UtcInstant;
}): PrivacyAssertion {
  return createPrivacyAssertion({
    assertionType: 'ComputationCompleted',
    subjectCommitment: input.subjectCommitment,
    purposeId: input.purposeId,
    satisfied: true,
    evidenceRefs: Object.freeze([
      {
        evidenceCommitmentHash: input.evidenceCommitmentHash,
        proofRef: input.computationReceiptRef,
      },
    ]),
    disclosedFields: Object.freeze(['computationReceiptRef']),
    evaluatedAt: input.evaluatedAt,
  });
}

export function assertNoRawPayload(assertion: PrivacyAssertion): void {
  if (assertion.rawDataIncluded !== false) {
    throw new Error('privacy assertion must not include raw underlying data');
  }
  for (const field of assertion.disclosedFields) {
    if (/transcript|dateOfBirth|fullAddress|healthRecord|vaultContents|rawCredential/i.test(field)) {
      throw new Error(`forbidden disclosed field on assertion: ${field}`);
    }
  }
}
