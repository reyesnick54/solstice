/**
 * Wave 5 — MoonRey economic receipt.
 *
 * Read-only audit artifact answering: WHY DID THIS MOONREY ENTER CIRCULATION?
 */

import type { EconomicProofBundle } from '../proof-bound/types.ts';
import type { MonetaryIssuanceReceipt } from '../proof-bound/types.ts';
import { monetaryStateCommitment } from '../proof-bound/roots.ts';
import type { InformationConsensusReceipt, MoonReyEconomicReceipt, MoonReyIssuanceProposalInput } from './types.ts';
import { MOONREY_ECONOMIC_RECEIPT_SCHEMA } from './types.ts';

export function buildMoonReyEconomicReceipt(input: {
  readonly proposal: MoonReyIssuanceProposalInput;
  readonly informationConsensus: InformationConsensusReceipt;
  readonly bundle: EconomicProofBundle;
  readonly issuanceReceipt: MonetaryIssuanceReceipt;
  readonly finalizedBlockHeight: number;
  readonly supplyTotal: bigint;
}): MoonReyEconomicReceipt {
  const monetaryStateRoot = monetaryStateCommitment({
    assetId: 'MOONREY_COIN',
    supplyTotal: input.supplyTotal.toString(),
    blockHeight: input.finalizedBlockHeight,
    transactionId: input.issuanceReceipt.transactionId,
  });
  const why = [
    `MoonRey entered circulation because productive claim ${input.proposal.productiveClaimId}`,
    `(category ${input.proposal.productiveCategory}, asset ${input.proposal.productiveAssetId})`,
    `was monetized under governance ${input.proposal.governanceAuthorizationId}.`,
    `GPUV valuation ${input.proposal.gpuvValuationId} (${input.proposal.gpuvQuantity} GPUV)`,
    `converted via ${input.proposal.monetaryPolicyRef} v${input.proposal.monetaryPolicyVersion}`,
    `to ${input.proposal.requestedMoonReyQuantity} MoonRey.`,
    `Information consensus ${input.informationConsensus.receiptId} achieved oracle mesh quorum.`,
  ].join(' ');
  return Object.freeze({
    schema: MOONREY_ECONOMIC_RECEIPT_SCHEMA,
    receiptKind: 'MOONREY_ECONOMIC_ISSUANCE',
    transactionId: input.issuanceReceipt.transactionId,
    moonReyQuantity: input.proposal.requestedMoonReyQuantity,
    productiveClaimId: input.proposal.productiveClaimId,
    productiveAssetId: input.proposal.productiveAssetId,
    productiveCategory: input.proposal.productiveCategory,
    productiveContributionId: input.proposal.productiveContributionId,
    informationConsensusReceiptId: input.informationConsensus.receiptId,
    informationConsensusDigest: input.informationConsensus.consensusDigest,
    evidenceRoot: input.bundle.evidenceRoot,
    evidenceProofRef: input.proposal.evidenceProofRef,
    rightsRoot: input.bundle.rightsRoot,
    rightsProofRef: input.proposal.rightsProofRef,
    policyRoot: input.bundle.policyRoot,
    policyProofRef: input.proposal.policyProofRef,
    gpuvValuationId: input.proposal.gpuvValuationId,
    gpuvQuantity: input.proposal.gpuvQuantity,
    monetaryPolicyRef: input.proposal.monetaryPolicyRef,
    monetaryPolicyVersion: input.proposal.monetaryPolicyVersion,
    governanceAuthorizationId: input.proposal.governanceAuthorizationId,
    finalizedBlockHeight: input.finalizedBlockHeight,
    monetaryStateRoot,
    monetizationKey: input.proposal.monetizationKey,
    whyMoonReyEnteredCirculation: why,
  });
}

export function receiptAnswersWhy(receipt: MoonReyEconomicReceipt): {
  readonly claim: string;
  readonly category: string;
  readonly gpuv: string;
  readonly monetaryPolicy: string;
  readonly governance: string;
  readonly consensus: string;
} {
  return Object.freeze({
    claim: receipt.productiveClaimId,
    category: receipt.productiveCategory,
    gpuv: `${receipt.gpuvQuantity} (${receipt.gpuvValuationId})`,
    monetaryPolicy: `${receipt.monetaryPolicyRef} v${receipt.monetaryPolicyVersion}`,
    governance: receipt.governanceAuthorizationId,
    consensus: receipt.informationConsensusReceiptId,
  });
}
