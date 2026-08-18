/**
 * Offline drafts and client-side offline signing.
 *
 * A draft is not authorization. Signed payloads bind network, chain,
 * nonce/replay data, fee authorization, and canonical transaction bytes.
 * Submission revalidates account, nonce, fees, delegation, policy,
 * network, and chain.
 */

import { createHash } from 'node:crypto';

import { reject, type MobileSyncRejection, type OfflineSignedPayload, type OfflineTransactionDraft, type StaleDraftCheck } from './types.ts';

export type OfflineDraftContext = {
  readonly accountActive: boolean;
  readonly chainNonce: string;
  readonly requiredFeeMinorUnits: string;
  readonly delegationValid: boolean;
  readonly policyValid: boolean;
  readonly networkId: string;
  readonly chainId: string;
};

export class OfflineDraftBook {
  private readonly drafts = new Map<string, OfflineTransactionDraft>();

  create(input: {
    readonly walletId: string;
    readonly accountId: string;
    readonly networkId: string;
    readonly chainId: string;
    readonly nonce: string;
    readonly feeAuthorizedMinorUnits: string;
    readonly canonicalTransactionBytesHex: string;
    readonly nowUtc: string;
    readonly expiresAtUtc: string;
  }): OfflineTransactionDraft {
    const policySnapshotHash = createHash('sha256')
      .update([input.networkId, input.chainId, input.nonce, input.feeAuthorizedMinorUnits].join('|'))
      .digest('hex');
    const draft: OfflineTransactionDraft = Object.freeze({
      draftId: `draft.${input.walletId}.${input.nonce}`,
      walletId: input.walletId,
      accountId: input.accountId,
      networkId: input.networkId,
      chainId: input.chainId,
      nonce: input.nonce,
      feeAuthorizedMinorUnits: input.feeAuthorizedMinorUnits,
      canonicalTransactionBytesHex: input.canonicalTransactionBytesHex,
      policySnapshotHash,
      networkInfoCapturedAtUtc: input.nowUtc,
      expiresAtUtc: input.expiresAtUtc,
      authorization: false,
      signed: false,
    });
    this.drafts.set(draft.draftId, draft);
    return draft;
  }

  get(draftId: string): OfflineTransactionDraft | undefined {
    return this.drafts.get(draftId);
  }

  list(walletId: string): readonly OfflineTransactionDraft[] {
    return [...this.drafts.values()].filter((draft) => draft.walletId === walletId);
  }

  signOffline(input: {
    readonly draftId: string;
    readonly signatureHex: string;
  }): OfflineSignedPayload | MobileSyncRejection {
    const draft = this.drafts.get(input.draftId);
    if (!draft) {
      return reject('STALE_DRAFT', 'offline draft is unknown');
    }
    const signed: OfflineSignedPayload = Object.freeze({
      draftId: draft.draftId,
      networkId: draft.networkId,
      chainId: draft.chainId,
      nonce: draft.nonce,
      feeAuthorization: draft.feeAuthorizedMinorUnits,
      canonicalTransactionBytesHex: draft.canonicalTransactionBytesHex,
      signatureHex: input.signatureHex,
      signedOffline: true,
    });
    this.drafts.set(draft.draftId, Object.freeze({ ...draft, signed: true }));
    return signed;
  }

  revalidate(draft: OfflineTransactionDraft, context: OfflineDraftContext, nowUtc: string): StaleDraftCheck {
    const reasons: string[] = [];
    if (!context.accountActive) {
      reasons.push('account state');
    }
    if (context.chainNonce !== draft.nonce) {
      reasons.push('nonce/replay state');
    }
    if (BigInt(context.requiredFeeMinorUnits) > BigInt(draft.feeAuthorizedMinorUnits)) {
      reasons.push('fee requirements');
    }
    if (!context.delegationValid) {
      reasons.push('delegation validity');
    }
    if (!context.policyValid) {
      reasons.push('policy validity');
    }
    if (context.networkId !== draft.networkId) {
      reasons.push('network');
    }
    if (context.chainId !== draft.chainId) {
      reasons.push('chain');
    }
    if (nowUtc > draft.expiresAtUtc) {
      reasons.push('expired policy/network information');
    }
    return Object.freeze({
      draftId: draft.draftId,
      stale: reasons.length > 0,
      reasons: Object.freeze(reasons),
    });
  }

  refuseAsAuthorization(): MobileSyncRejection {
    return reject('DRAFT_IS_NOT_AUTHORIZATION', 'an offline draft is not authorization');
  }
}

export function signedPayloadComplete(payload: OfflineSignedPayload): boolean {
  return (
    payload.networkId.length > 0 &&
    payload.chainId.length > 0 &&
    payload.nonce.length > 0 &&
    payload.feeAuthorization.length > 0 &&
    payload.canonicalTransactionBytesHex.length > 0 &&
    payload.signatureHex.length > 0
  );
}
