/**
 * Wave 5 — MoonRey issuance proposal formalization.
 */

import { createHash } from 'node:crypto';

import type { EconomicProofBundle } from '../proof-bound/types.ts';
import type { InformationConsensusReceipt } from './types.ts';
import {
  MOONREY_ISSUANCE_PROPOSAL_SCHEMA,
  type MoonReyIssuanceProposalInput,
  type MoonReyPipelineRejection,
} from './types.ts';
import type { MonetaryPolicyEvaluation } from './monetary-policy.ts';
import { requiredGovernanceApprovals } from './governance.ts';

export function proposalIdOf(
  productiveClaimId: string,
  monetizationKey: string,
): string {
  return createHash('sha256')
    .update(`moonrey-proposal:${productiveClaimId}:${monetizationKey}`)
    .digest('hex')
    .slice(0, 32);
}

export function buildMoonReyIssuanceProposal(input: {
  readonly productiveClaimId: string;
  readonly claimCommitment: string;
  readonly productiveContributionId: string;
  readonly informationConsensus: InformationConsensusReceipt;
  readonly bundle: EconomicProofBundle;
  readonly gpuvValuationId: string;
  readonly gpuvQuantity: bigint;
  readonly gpuvDigest: string;
  readonly monetaryPolicy: MonetaryPolicyEvaluation;
  readonly governanceAuthorizationId: string;
  readonly productiveCategory: string;
  readonly productiveAssetId: string;
  readonly network: 'DEVELOPMENT' | 'TESTNET' | 'MAINNET';
}): MoonReyIssuanceProposalInput {
  const requestedMoonReyQuantity = input.monetaryPolicy.derivedMoonReyQuantity;
  return Object.freeze({
    schema: MOONREY_ISSUANCE_PROPOSAL_SCHEMA,
    proposalId: proposalIdOf(input.productiveClaimId, input.bundle.monetizationKey),
    schemaVersion: 1,
    productiveClaimId: input.productiveClaimId,
    claimCommitment: input.claimCommitment,
    productiveContributionId: input.productiveContributionId,
    informationConsensusReceiptId: input.informationConsensus.receiptId,
    informationConsensusDigest: input.informationConsensus.consensusDigest,
    evidenceProofRef: input.bundle.evidenceCommitmentHash,
    rightsProofRef: input.bundle.rightsCommitmentHash,
    policyProofRef: input.bundle.policyCommitmentHash,
    gpuvValuationId: input.gpuvValuationId,
    gpuvQuantity: input.gpuvQuantity.toString(),
    gpuvDigest: input.gpuvDigest,
    monetaryPolicyRef: input.monetaryPolicy.policyRef,
    monetaryPolicyVersion: input.monetaryPolicy.policyVersion,
    requestedMoonReyQuantity: requestedMoonReyQuantity.toString(),
    governedQuantityDerivation: 'MONETARY_POLICY_CONVERSION' as const,
    governanceAuthorizationId: input.governanceAuthorizationId,
    governanceRequirements: requiredGovernanceApprovals(input.network),
    monetizationKey: input.bundle.monetizationKey,
    productiveCategory: input.productiveCategory,
    productiveAssetId: input.productiveAssetId,
    network: input.network,
    productionEconomicsActive: false,
  });
}

export function validateMoonReyIssuanceProposal(
  proposal: MoonReyIssuanceProposalInput,
  bundle: EconomicProofBundle,
): MoonReyPipelineRejection | null {
  if (proposal.schema !== MOONREY_ISSUANCE_PROPOSAL_SCHEMA) {
    return 'TRANSACTION_INVALID';
  }
  if (proposal.productionEconomicsActive) {
    return 'MONETARY_POLICY_PRODUCTION_DISABLED';
  }
  if (proposal.productiveClaimId !== bundle.economicClaimId) {
    return 'CLAIM_INVALID';
  }
  if (proposal.claimCommitment !== bundle.claimCommitment) {
    return 'CLAIM_INVALID';
  }
  if (proposal.monetizationKey !== bundle.monetizationKey) {
    return 'TRANSACTION_INVALID';
  }
  if (proposal.gpuvQuantity === proposal.requestedMoonReyQuantity) {
    return 'GPUV_USED_AS_MOONREY_QUANTITY';
  }
  if (proposal.gpuvValuationId !== bundle.valuation.valuationId) {
    return 'GPUV_VERSION_MISMATCH';
  }
  if (proposal.governanceAuthorizationId !== bundle.governanceAuthorization.authorizationId) {
    return 'GOVERNANCE_MISSING';
  }
  if (bundle.economicDomain !== 'PRODUCTIVE_ECONOMY') {
    return 'CLAIM_INVALID';
  }
  return null;
}
