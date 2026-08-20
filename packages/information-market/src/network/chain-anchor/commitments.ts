import { commitCanonical } from '../../../../sunrey-chain/src/hash.ts';
import { HIN_ANCHOR_COMMITMENT_DOMAINS } from './policy.ts';
import type { HinAnchorKind, HumanInformationAnchorKey } from './types.ts';

function sortedEntries(value: Readonly<Record<string, string | number | boolean | null>>): Readonly<Record<string, string | number | boolean | null>> {
  return Object.fromEntries(
    Object.entries(value).sort(([left], [right]) => left.localeCompare(right)),
  );
}

export function commitHinDomain(
  domain: string,
  fields: Readonly<Record<string, string | number | boolean | null>>,
): string {
  return commitCanonical({
    domain,
    fields: sortedEntries(fields),
  });
}

export function consentCommitment(fields: {
  readonly grantId: string;
  readonly consentHash: string;
  readonly consentVersion: string;
  readonly purpose: string;
  readonly policyVersion: string;
}): string {
  return commitHinDomain(HIN_ANCHOR_COMMITMENT_DOMAINS.CONSENT_GRANT, {
    grantId: fields.grantId,
    consentHash: fields.consentHash,
    consentVersion: fields.consentVersion,
    purpose: fields.purpose,
    policyVersion: fields.policyVersion,
  });
}

export function revocationCommitment(fields: {
  readonly revocationId: string;
  readonly grantId: string;
  readonly consentHash: string;
  readonly policyVersion: string;
}): string {
  return commitHinDomain(HIN_ANCHOR_COMMITMENT_DOMAINS.CONSENT_REVOCATION, {
    revocationId: fields.revocationId,
    grantId: fields.grantId,
    consentHash: fields.consentHash,
    policyVersion: fields.policyVersion,
  });
}

export function rightStateCommitment(fields: {
  readonly rightId: string;
  readonly rightType: string;
  readonly purpose: string;
  readonly processingClass: string;
  readonly outputClass: string;
  readonly status: string;
  readonly policyVersion: string;
  readonly consentReference: string;
  readonly expiration: string;
}): string {
  return commitHinDomain(HIN_ANCHOR_COMMITMENT_DOMAINS.INFORMATION_RIGHT_STATE, {
    rightId: fields.rightId,
    rightType: fields.rightType,
    purpose: fields.purpose,
    processingClass: fields.processingClass,
    outputClass: fields.outputClass,
    status: fields.status,
    policyVersion: fields.policyVersion,
    consentReference: fields.consentReference,
    expiration: fields.expiration,
  });
}

export function purposeGrantCommitment(fields: {
  readonly purposeGrantId: string;
  readonly purpose: string;
  readonly status: string;
  readonly policyVersion: string;
}): string {
  return commitHinDomain(HIN_ANCHOR_COMMITMENT_DOMAINS.PURPOSE_GRANT, {
    purposeGrantId: fields.purposeGrantId,
    purpose: fields.purpose,
    status: fields.status,
    policyVersion: fields.policyVersion,
  });
}

export function usageReceiptCommitment(fields: {
  readonly receiptId: string;
  readonly usageReceiptHash: string;
  readonly requesterId: string;
  readonly purpose: string;
  readonly computationId: string | null;
  readonly policyVersion: string;
  readonly outputClass: string;
}): string {
  return commitHinDomain(HIN_ANCHOR_COMMITMENT_DOMAINS.USAGE_RECEIPT, {
    receiptId: fields.receiptId,
    usageReceiptHash: fields.usageReceiptHash,
    requesterId: fields.requesterId,
    purpose: fields.purpose,
    computationId: fields.computationId,
    policyVersion: fields.policyVersion,
    outputClass: fields.outputClass,
  });
}

export function computationCommitment(fields: {
  readonly computationRequestId: string;
  readonly approvedComputationHash: string;
  readonly inputRightSet: string;
  readonly privacyPolicyVersion: string;
  readonly resultCommitment: string;
  readonly outputClass: string;
  readonly cohortPolicy: string;
}): string {
  return commitHinDomain(HIN_ANCHOR_COMMITMENT_DOMAINS.CLEAN_ROOM_COMPUTATION, {
    computationRequestId: fields.computationRequestId,
    approvedComputationHash: fields.approvedComputationHash,
    inputRightSet: fields.inputRightSet,
    privacyPolicyVersion: fields.privacyPolicyVersion,
    resultCommitment: fields.resultCommitment,
    outputClass: fields.outputClass,
    cohortPolicy: fields.cohortPolicy,
  });
}

export function provenanceCommitment(fields: {
  readonly source: string;
  readonly collectionAuthority: string;
  readonly timestamp: string;
  readonly transforms: string;
}): string {
  return commitHinDomain(HIN_ANCHOR_COMMITMENT_DOMAINS.PROVENANCE, {
    source: fields.source,
    collectionAuthority: fields.collectionAuthority,
    timestamp: fields.timestamp,
    transforms: fields.transforms,
  });
}

export function contributionProofCommitment(fields: {
  readonly contributionId: string;
  readonly fingerprint: string;
  readonly verificationDecision: string;
  readonly rightEvidence: string;
  readonly purpose: string;
  readonly usageReceiptId: string;
}): string {
  return commitHinDomain(HIN_ANCHOR_COMMITMENT_DOMAINS.HUMAN_CONTRIBUTION_PROOF, {
    contributionId: fields.contributionId,
    fingerprint: fields.fingerprint,
    verificationDecision: fields.verificationDecision,
    rightEvidence: fields.rightEvidence,
    purpose: fields.purpose,
    usageReceiptId: fields.usageReceiptId,
  });
}

export function humanInformationAnchorKey(input: {
  readonly kind: HinAnchorKind;
  readonly sourceRecordId: string;
  readonly sourceRecordVersion: string;
  readonly payloadCommitment: string;
}): HumanInformationAnchorKey {
  return commitHinDomain(HIN_ANCHOR_COMMITMENT_DOMAINS.IDEMPOTENCY, {
    kind: input.kind,
    sourceRecordId: input.sourceRecordId,
    sourceRecordVersion: input.sourceRecordVersion,
    payloadCommitment: input.payloadCommitment,
  }) as HumanInformationAnchorKey;
}
