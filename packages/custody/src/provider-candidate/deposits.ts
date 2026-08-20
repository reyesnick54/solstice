/**
 * Provider deposit notification is evidence, not a credit instruction.
 */

import type { NativeCustodyAssetId } from '../native-assets.ts';
import { verifyAuthenticCallback, type CustodyProviderCallback } from './callbacks.ts';
import { candidateErr, candidateOk, type CustodyCandidateResult } from './types.ts';

export type DepositDestinationMapping = {
  readonly address: string;
  readonly ownerId: string;
  readonly assetId: NativeCustodyAssetId;
};

export type DepositAdmission = {
  readonly callbackId: string;
  readonly transactionRef: string;
  readonly assetId: NativeCustodyAssetId;
  readonly quantity: bigint;
  readonly destinationMapping: DepositDestinationMapping;
  readonly chainFinalityRequired: true;
  readonly creditedCustomerBalance: false;
  readonly requiresReconciliation: true;
};

const seenDepositCallbacks = new Set<string>();

export function admitProviderDeposit(input: {
  readonly callback: CustodyProviderCallback;
  readonly hmacSecret: string;
  readonly mapping: DepositDestinationMapping;
  readonly finalizedOnChain: boolean;
}): CustodyCandidateResult<DepositAdmission> {
  const authentic = verifyAuthenticCallback(input.callback, input.hmacSecret);
  if (!authentic.ok) {
    return authentic;
  }
  if (input.callback.kind !== 'DEPOSIT') {
    return candidateErr('WRONG_CALLBACK_KIND', 'deposit admission requires a deposit callback');
  }
  if (seenDepositCallbacks.has(input.callback.callbackId) || seenDepositCallbacks.has(input.callback.transactionRef)) {
    return candidateErr('DUPLICATE_DEPOSIT_CALLBACK', 'duplicate deposit callback rejected');
  }
  if (input.callback.assetId !== input.mapping.assetId) {
    return candidateErr('WRONG_ASSET_CALLBACK', 'callback asset does not match destination mapping');
  }
  if (input.callback.destination !== input.mapping.address) {
    return candidateErr('DESTINATION_MISMATCH', 'callback destination does not match mapping');
  }
  if (!input.finalizedOnChain) {
    return candidateErr('FINALITY_REQUIRED', 'chain finality policy is not satisfied');
  }
  seenDepositCallbacks.add(input.callback.callbackId);
  seenDepositCallbacks.add(input.callback.transactionRef);
  return candidateOk(
    Object.freeze({
      callbackId: input.callback.callbackId,
      transactionRef: input.callback.transactionRef,
      assetId: input.callback.assetId,
      quantity: input.callback.quantity,
      destinationMapping: input.mapping,
      chainFinalityRequired: true,
      creditedCustomerBalance: false,
      requiresReconciliation: true,
    }),
  );
}

export function resetDepositCallbacks(): void {
  seenDepositCallbacks.clear();
}
