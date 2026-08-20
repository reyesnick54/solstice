import type { Result } from '../../../../domain/src/result.ts';
import type { HumanInformationConsentGrant } from '../types.ts';
import type { HumanInformationRevocation } from '../types.ts';
import type { HumanInformationUsageReceipt } from '../types.ts';
import type { HumanInformationAnchorCoordinator } from './coordinator.ts';
import type { HinAnchorFailure, HumanInformationAnchor } from './types.ts';

/**
 * Records a PENDING_ANCHOR after a successful HIN business action.
 * Callers must not wait for block finality.
 */
export function scheduleConsentAnchor(
  coordinator: HumanInformationAnchorCoordinator,
  input: {
    readonly grant: HumanInformationConsentGrant;
    readonly subjectHandle: string;
    readonly subjectRawId: string;
    readonly jurisdictionCell: string;
  },
): Result<HumanInformationAnchor, HinAnchorFailure> {
  return coordinator.prepare({
    kind: 'CONSENT_RECEIPT',
    sourceRecordId: input.grant.grantId,
    subjectHandle: input.subjectHandle,
    requesterId: input.grant.requesterId,
    purpose: input.grant.purpose,
    jurisdictionCell: input.jurisdictionCell,
    correlationId: `hin-consent:${input.grant.grantId}`,
    subjectRawId: input.subjectRawId,
    schemaFields: {
      consentId: input.grant.grantId,
      consentVersion: input.grant.policyVersion,
      consentHash: input.grant.consentHash,
      purposeId: input.grant.purpose,
      purposeVersion: input.grant.policyVersion,
      subjectReference: input.subjectHandle,
      recipientClass: input.grant.recipientClass,
      scopeCommitment: input.grant.consentHash,
      effectiveState: input.grant.status,
      expirationReference: input.grant.expiresAt,
      timestamp: input.grant.createdAt,
    },
  });
}

export function scheduleUsageAnchor(
  coordinator: HumanInformationAnchorCoordinator,
  input: {
    readonly receipt: HumanInformationUsageReceipt;
    readonly subjectHandle: string;
    readonly subjectRawId: string;
    readonly jurisdictionCell: string;
  },
): Result<HumanInformationAnchor, HinAnchorFailure> {
  return coordinator.prepare({
    kind: 'USAGE_RECEIPT',
    sourceRecordId: input.receipt.receiptId,
    subjectHandle: input.subjectHandle,
    requesterId: input.receipt.requesterId,
    purpose: input.receipt.purpose,
    jurisdictionCell: input.jurisdictionCell,
    correlationId: `hin-usage:${input.receipt.receiptId}`,
    subjectRawId: input.subjectRawId,
    schemaFields: {
      receiptHash: input.receipt.evidenceDigest,
      requesterReference: input.receipt.requesterId,
      purpose: input.receipt.purpose,
      privacyPolicyVersion: input.receipt.policyVersion,
      resultCommitment: input.receipt.evidenceDigest,
      timestamp: input.receipt.occurredAt,
    },
  });
}

export function scheduleRevocationAnchor(
  coordinator: HumanInformationAnchorCoordinator,
  input: {
    readonly revocation: HumanInformationRevocation;
    readonly grant: HumanInformationConsentGrant;
    readonly subjectHandle: string;
    readonly subjectRawId: string;
    readonly jurisdictionCell: string;
    readonly priorConsentCommitment: string | null;
  },
): Result<HumanInformationAnchor, HinAnchorFailure> {
  return coordinator.prepare({
    kind: 'CONSENT_REVOCATION',
    sourceRecordId: input.revocation.revocationId,
    subjectHandle: input.subjectHandle,
    requesterId: input.grant.requesterId,
    purpose: input.grant.purpose,
    jurisdictionCell: input.jurisdictionCell,
    correlationId: `hin-revocation:${input.revocation.revocationId}`,
    subjectRawId: input.subjectRawId,
    priorConsentCommitment: input.priorConsentCommitment,
    schemaFields: {
      consentId: input.grant.grantId,
      consentVersion: input.grant.policyVersion,
      revocationId: input.revocation.revocationId,
      subjectReference: input.subjectHandle,
      revokedAt: input.revocation.revokedAt,
      priorReceiptCommitment: input.priorConsentCommitment ?? input.grant.consentHash,
    },
  });
}

export function scheduleContributionAnchor(
  coordinator: HumanInformationAnchorCoordinator,
  input: {
    readonly contributionId: string;
    readonly fingerprint: string;
    readonly verificationDecision: string;
    readonly informationRightEvidence: string;
    readonly usageReceiptId: string;
    readonly subjectHandle: string;
    readonly subjectRawId: string;
    readonly purpose: string;
    readonly jurisdictionCell: string;
    readonly requesterId?: string | null;
  },
): Result<HumanInformationAnchor, HinAnchorFailure> {
  return coordinator.prepare({
    kind: 'PROOF_OF_CONTRIBUTION',
    sourceRecordId: input.contributionId,
    subjectHandle: input.subjectHandle,
    requesterId: input.requesterId ?? null,
    purpose: input.purpose,
    jurisdictionCell: input.jurisdictionCell,
    correlationId: `hin-contribution:${input.contributionId}`,
    subjectRawId: input.subjectRawId,
    schemaFields: {
      contributionCommitment: input.fingerprint,
      subjectReference: input.subjectHandle,
      purpose: input.purpose,
      receiptReference: input.usageReceiptId,
      verificationDecision: input.verificationDecision,
      informationRightEvidence: input.informationRightEvidence,
      doesNotMint: true,
    },
  });
}

export function scheduleSettlementAnchor(
  coordinator: HumanInformationAnchorCoordinator,
  input: {
    readonly settlementRef: string;
    readonly journalId: string;
    readonly transferId: string;
    readonly assetCommitment: string;
    readonly subjectHandle: string;
    readonly jurisdictionCell: string;
    readonly requesterId?: string | null;
  },
): Result<HumanInformationAnchor, HinAnchorFailure> {
  return coordinator.prepare({
    kind: 'DIGITAL_ASSET_SETTLEMENT',
    sourceRecordId: input.settlementRef,
    subjectHandle: input.subjectHandle,
    requesterId: input.requesterId ?? null,
    purpose: 'hin-settlement-evidence',
    jurisdictionCell: input.jurisdictionCell,
    correlationId: `hin-settlement:${input.settlementRef}`,
    schemaFields: {
      journalId: input.journalId,
      transferId: input.transferId,
      assetCommitment: input.assetCommitment,
      authoritativeLedger: 'canonical-internal-ledger',
      chainBalanceAuthoritative: false,
    },
  });
}
