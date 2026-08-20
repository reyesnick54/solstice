import { createHash } from 'node:crypto';

import { candidateErr, candidateOk, type CustodyCandidatePreview, type CustodyCandidateResult } from './types.ts';

export type HumanApproval = {
  readonly actorKind: 'HUMAN_OPERATOR' | 'HUMAN_SECURITY';
  readonly boundPreviewHash: string;
};

export function hashCandidatePreview(preview: Omit<CustodyCandidatePreview, 'previewId' | 'previewHash'>): string {
  return createHash('sha256')
    .update(
      [
        preview.source,
        preview.destination,
        preview.assetId,
        preview.quantity.toString(),
        preview.feeAssetId,
        preview.feeLimit.toString(),
        preview.nonce.toString(),
        preview.networkId,
        preview.chainId,
        preview.canonicalBytes,
      ].join('|'),
    )
    .digest('hex');
}

export function bindHumanApproval(previewHash: string): HumanApproval {
  return Object.freeze({
    actorKind: 'HUMAN_OPERATOR',
    boundPreviewHash: previewHash,
  });
}

export function aiApproveWithdrawal(): CustodyCandidateResult<never> {
  return candidateErr('AI_CANNOT_APPROVE_WITHDRAWAL', 'AI cannot approve a custody withdrawal');
}

export function aiSignTransaction(): CustodyCandidateResult<never> {
  return candidateErr('AI_CANNOT_SIGN', 'AI cannot sign a custody transaction');
}

export function aiModifyAllowlist(): CustodyCandidateResult<never> {
  return candidateErr('AI_CANNOT_MODIFY_ALLOWLIST', 'AI cannot modify a destination allowlist');
}

export function aiReduceQuorum(): CustodyCandidateResult<never> {
  return candidateErr('AI_CANNOT_REDUCE_QUORUM', 'AI cannot reduce approval quorum');
}

export function aiDisableCoolingPeriod(): CustodyCandidateResult<never> {
  return candidateErr('AI_CANNOT_DISABLE_COOLING', 'AI cannot disable a cooling period');
}

export function approvalStillValid(approval: HumanApproval, preview: CustodyCandidatePreview): boolean {
  return approval.boundPreviewHash === preview.previewHash;
}

export function previewChangedInvalidatesApproval(
  previous: CustodyCandidatePreview,
  next: CustodyCandidatePreview,
): boolean {
  return (
    previous.destination !== next.destination ||
    previous.assetId !== next.assetId ||
    previous.quantity !== next.quantity ||
    previous.feeLimit !== next.feeLimit ||
    previous.nonce !== next.nonce ||
    previous.networkId !== next.networkId ||
    previous.canonicalBytes !== next.canonicalBytes ||
    previous.previewHash !== next.previewHash
  );
}
