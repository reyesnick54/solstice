import type { Result } from '../../../../domain/src/result.ts';
import type { HumanInformationConsentGrant } from '../types.ts';
import type { HumanInformationRevocation } from '../types.ts';
import type { HumanInformationUsageReceipt } from '../types.ts';
import type { HumanInformationAnchorCoordinator } from './coordinator.ts';
import type { CanonicalSettlementReference, HinAnchorFailure, HumanInformationAnchor } from './types.ts';

/**
 * Records a PENDING_ANCHOR after a successful HIN business action.
 * Callers must not wait for block finality.
 */
export function scheduleConsentAnchor(
  coordinator: HumanInformationAnchorCoordinator,
  input: {
    readonly grant: HumanInformationConsentGrant;
    readonly subjectHandle: string;
  },
): Result<HumanInformationAnchor, HinAnchorFailure> {
  return coordinator.prepare({
    kind: 'CONSENT_GRANT',
    sourceRecordId: input.grant.grantId,
    requesterId: input.grant.requesterId,
    subjectHandle: input.subjectHandle,
  });
}

export function scheduleUsageAnchor(
  coordinator: HumanInformationAnchorCoordinator,
  input: {
    readonly receipt: HumanInformationUsageReceipt;
    readonly subjectHandle: string;
  },
): Result<HumanInformationAnchor, HinAnchorFailure> {
  return coordinator.prepare({
    kind: 'USAGE_RECEIPT',
    sourceRecordId: input.receipt.receiptId,
    requesterId: input.receipt.requesterId,
    subjectHandle: input.subjectHandle,
  });
}

export function scheduleRevocationAnchor(
  coordinator: HumanInformationAnchorCoordinator,
  input: {
    readonly revocation: HumanInformationRevocation;
    readonly grant: HumanInformationConsentGrant;
    readonly subjectHandle: string;
    readonly priorConsentCommitment: string | null;
  },
): Result<HumanInformationAnchor, HinAnchorFailure> {
  return coordinator.prepare({
    kind: 'CONSENT_REVOCATION',
    sourceRecordId: input.revocation.revocationId,
    requesterId: input.grant.requesterId,
    subjectHandle: input.subjectHandle,
    priorConsentCommitment: input.priorConsentCommitment,
  });
}

export function scheduleContributionAnchor(
  coordinator: HumanInformationAnchorCoordinator,
  input: {
    readonly contributionId: string;
    readonly subjectHandle: string;
    readonly requesterId?: string | null;
  },
): Result<HumanInformationAnchor, HinAnchorFailure> {
  return coordinator.prepare({
    kind: 'HUMAN_CONTRIBUTION_PROOF',
    sourceRecordId: input.contributionId,
    contributionId: input.contributionId,
    requesterId: input.requesterId ?? null,
    subjectHandle: input.subjectHandle,
  });
}

export function scheduleSettlementAnchor(
  coordinator: HumanInformationAnchorCoordinator,
  input: {
    readonly sourceRecordId: string;
    readonly canonicalSettlement: CanonicalSettlementReference;
    readonly subjectHandle: string;
    readonly requesterId?: string | null;
  },
): Result<HumanInformationAnchor, HinAnchorFailure> {
  return coordinator.prepare({
    kind: 'COMPENSATION_SETTLEMENT_REFERENCE',
    sourceRecordId: input.sourceRecordId,
    canonicalSettlement: input.canonicalSettlement,
    requesterId: input.requesterId ?? null,
    subjectHandle: input.subjectHandle,
  });
}
