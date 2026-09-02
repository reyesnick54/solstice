/**
 * Wave 6 — SunRey economic receipt.
 *
 * Read-only audit artifact answering WHY DID THIS SUNREY ENTER CIRCULATION?
 * Never exposes unnecessary raw personal data.
 */

import type { EconomicProofBundle } from '../proof-bound/types.ts';
import type { MonetaryIssuanceReceipt } from '../proof-bound/types.ts';
import { monetaryStateCommitment } from '../proof-bound/roots.ts';
import {
  SUNREY_ECONOMIC_RECEIPT_SCHEMA,
  type SunReyEconomicReceipt,
  type SunReyHumanEconomyIssuanceProposal,
} from './types.ts';

export function buildSunReyEconomicReceipt(input: {
  readonly baseReceipt: MonetaryIssuanceReceipt;
  readonly proposal: SunReyHumanEconomyIssuanceProposal;
  readonly bundle: EconomicProofBundle;
  readonly supplyTotal: bigint;
}): SunReyEconomicReceipt {
  return Object.freeze({
    schema: SUNREY_ECONOMIC_RECEIPT_SCHEMA,
    receiptKind: 'SUNREY_HUMAN_ECONOMY_ISSUANCE',
    transactionId: input.baseReceipt.transactionId,
    sunReyQuantity: input.baseReceipt.quantity,
    economicClaimId: input.proposal.economicClaimId,
    canonicalContributionEventId: input.proposal.canonicalContributionEvent.contributionEventId,
    pseudonymousActorCommitment: input.proposal.pseudonymousActor.actorCommitment,
    verificationReceiptId: input.proposal.verificationReceipt.receiptId,
    evidenceRoot: input.baseReceipt.evidenceRoot,
    evidenceProofHash: input.bundle.evidenceCommitmentHash,
    rightsRoot: input.baseReceipt.rightsRoot,
    rightsProofHash: input.bundle.rightsCommitmentHash,
    policyRoot: input.baseReceipt.policyRoot,
    policyProofHash: input.bundle.policyCommitmentHash,
    peveValuationId: input.proposal.peveValuation.valuationId,
    peveReferenceValue: input.proposal.peveReferenceValue,
    monetaryPolicyId: input.proposal.monetaryPolicy.policyId,
    governanceAuthorizationId: input.proposal.governanceAuthorizationId!,
    finalizedBlockHeight: input.baseReceipt.finalizedBlockHeight,
    monetaryStateRoot: monetaryStateCommitment({
      assetId: 'SUNREY_COIN',
      supplyTotal: input.supplyTotal.toString(),
      blockHeight: input.baseReceipt.finalizedBlockHeight,
      transactionId: input.baseReceipt.transactionId,
    }),
    monetizationKey: input.baseReceipt.monetizationKey,
    containsRawPersonalData: false,
  });
}

export function receiptExplainsCirculation(receipt: SunReyEconomicReceipt): {
  readonly why: string;
  readonly claimReference: string;
  readonly contributionEventReference: string;
  readonly proofRoots: readonly string[];
  readonly governanceReference: string;
  readonly monetaryPolicyReference: string;
} {
  return Object.freeze({
    why: `SunRey quantity ${receipt.sunReyQuantity} entered circulation because human economic claim ${receipt.economicClaimId} was monetized under governance authorization ${receipt.governanceAuthorizationId} after PEVE valuation ${receipt.peveValuationId} was converted through monetary policy ${receipt.monetaryPolicyId}.`,
    claimReference: receipt.economicClaimId,
    contributionEventReference: receipt.canonicalContributionEventId,
    proofRoots: Object.freeze([receipt.evidenceRoot, receipt.rightsRoot, receipt.policyRoot]),
    governanceReference: receipt.governanceAuthorizationId,
    monetaryPolicyReference: receipt.monetaryPolicyId,
  });
}
