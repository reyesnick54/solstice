import { sha256Hex } from '../../../security/src/hash.ts';

export type WithdrawalPreviewBinding = {
  readonly withdrawalId: string;
  readonly destinationBinding: string;
  readonly assetId: string;
  readonly quantity: bigint;
  readonly feePolicyId: string;
  readonly networkId: string;
  readonly chainId: string;
  readonly policyResult: string;
  readonly canonicalBytesHex: string;
  readonly bindingHash: string;
};

export function bindWithdrawalPreview(input: Omit<WithdrawalPreviewBinding, 'bindingHash'>): WithdrawalPreviewBinding {
  const bindingHash = sha256Hex(
    [
      input.withdrawalId,
      input.destinationBinding,
      input.assetId,
      input.quantity.toString(),
      input.feePolicyId,
      input.networkId,
      input.chainId,
      input.policyResult,
      input.canonicalBytesHex,
    ].join('|'),
  );
  return Object.freeze({ ...input, bindingHash });
}

export function previewBytesStillBound(
  approved: WithdrawalPreviewBinding,
  submittedCanonicalBytesHex: string,
): boolean {
  return approved.canonicalBytesHex === submittedCanonicalBytesHex;
}

export function changedBytesInvalidateAuthorization(
  approved: WithdrawalPreviewBinding,
  submitted: WithdrawalPreviewBinding,
): boolean {
  return approved.bindingHash !== submitted.bindingHash || approved.canonicalBytesHex !== submitted.canonicalBytesHex;
}
