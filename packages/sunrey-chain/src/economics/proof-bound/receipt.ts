/**
 * Wave 3 — Monetary issuance receipt / proof.
 *
 * Read-only audit artifact explaining WHY supply changed without
 * exposing underlying private records.
 */

import type { EconomicProofBundle, MonetaryIssuanceReceipt } from './types.ts';
import { monetaryStateCommitment } from './roots.ts';

export function buildMonetaryIssuanceReceipt(input: {
  readonly transactionId: string;
  readonly assetId: 'SUNREY_COIN' | 'MOONREY_COIN';
  readonly quantity: bigint;
  readonly bundle: EconomicProofBundle;
  readonly finalizedBlockHeight: number;
  readonly supplyTotal: bigint;
}): MonetaryIssuanceReceipt {
  return Object.freeze({
    receiptKind: 'MONETARY_ISSUANCE',
    transactionId: input.transactionId,
    assetId: input.assetId,
    quantity: input.quantity.toString(),
    economicClaimId: input.bundle.economicClaimId,
    evidenceCommitmentHash: input.bundle.evidenceCommitmentHash,
    evidenceRoot: input.bundle.evidenceRoot,
    rightsCommitmentHash: input.bundle.rightsCommitmentHash,
    rightsRoot: input.bundle.rightsRoot,
    policyCommitmentHash: input.bundle.policyCommitmentHash,
    policyRoot: input.bundle.policyRoot,
    governanceAuthorizationId: input.bundle.governanceAuthorization.authorizationId,
    finalizedBlockHeight: input.finalizedBlockHeight,
    monetaryStateCommitment: monetaryStateCommitment({
      assetId: input.assetId,
      supplyTotal: input.supplyTotal.toString(),
      blockHeight: input.finalizedBlockHeight,
      transactionId: input.transactionId,
    }),
    monetizationKey: input.bundle.monetizationKey,
  });
}

export function receiptExplainsSupplyChange(receipt: MonetaryIssuanceReceipt): {
  readonly why: string;
  readonly claimReference: string;
  readonly proofRoots: readonly string[];
  readonly governanceReference: string;
} {
  return Object.freeze({
    why: `Supply of ${receipt.assetId} increased by ${receipt.quantity} because economic claim ${receipt.economicClaimId} was monetized under governance authorization ${receipt.governanceAuthorizationId}.`,
    claimReference: receipt.economicClaimId,
    proofRoots: Object.freeze([receipt.evidenceRoot, receipt.rightsRoot, receipt.policyRoot]),
    governanceReference: receipt.governanceAuthorizationId,
  });
}

export function issuanceReceiptDistinctFromBurn(): true {
  return true;
}
