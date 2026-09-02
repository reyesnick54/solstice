/**
 * Wave 5 — MoonRey monetary pipeline types.
 *
 * Connects productive economy outputs to Wave 3 proof-bound monetary
 * transitions. No stage before MonetaryIssuanceAuthority may mint.
 */

export const MOONREY_ISSUANCE_PROPOSAL_SCHEMA = 'sunrey.moonrey.issuance-proposal.v1' as const;
export const INFORMATION_CONSENSUS_RECEIPT_SCHEMA = 'sunrey.information-consensus.receipt.v1' as const;
export const MOONREY_ECONOMIC_RECEIPT_SCHEMA = 'sunrey.moonrey.economic-receipt.v1' as const;

export const FORBIDDEN_MONETARY_AUTHORIZATION_SOURCES = [
  'ORACLE',
  'AI',
  'PRODUCTIVE_VALUE_ENGINE',
  'EXCHANGE',
  'API',
  'DATABASE',
  'VALIDATOR',
] as const;
export type ForbiddenMonetaryAuthorizationSource = (typeof FORBIDDEN_MONETARY_AUTHORIZATION_SOURCES)[number];

export const PERMITTED_GOVERNANCE_ACTORS = ['HUMAN_GOVERNANCE', 'PROTOCOL'] as const;
export type PermittedGovernanceActor = (typeof PERMITTED_GOVERNANCE_ACTORS)[number];

export type InformationConsensusReceipt = {
  readonly schema: typeof INFORMATION_CONSENSUS_RECEIPT_SCHEMA;
  readonly receiptId: string;
  readonly consensusClass: 'ORACLE_MESH_QUORUM';
  readonly observationIds: readonly string[];
  readonly providerIds: readonly string[];
  readonly quorumAchieved: true;
  readonly consensusDigest: string;
  readonly finalizedAtUtc: string;
  readonly mintsNativeAsset: false;
};

export type ProductivePipelineStage =
  | 'PRODUCTIVE_SOURCES'
  | 'ORACLE_MESH'
  | 'INFORMATION_CONSENSUS'
  | 'CANONICAL_PRODUCTIVE_EVENT'
  | 'ECONOMIC_CLAIM'
  | 'EVIDENCE_RIGHTS_POLICY'
  | 'PRODUCTIVE_ECONOMIC_CONTRIBUTION'
  | 'GPUV_VALUATION'
  | 'MONETARY_POLICY'
  | 'MOONREY_ISSUANCE_PROPOSAL'
  | 'GOVERNANCE'
  | 'PROTOCOL_ISSUE'
  | 'VALIDATOR_CONSENSUS'
  | 'FINALIZED_STATE';

export type MoonReyIssuanceProposalInput = {
  readonly schema: typeof MOONREY_ISSUANCE_PROPOSAL_SCHEMA;
  readonly proposalId: string;
  readonly schemaVersion: 1;
  readonly productiveClaimId: string;
  readonly claimCommitment: string;
  readonly productiveContributionId: string;
  readonly informationConsensusReceiptId: string;
  readonly informationConsensusDigest: string;
  readonly evidenceProofRef: string;
  readonly rightsProofRef: string;
  readonly policyProofRef: string;
  readonly gpuvValuationId: string;
  readonly gpuvQuantity: string;
  readonly gpuvDigest: string;
  readonly monetaryPolicyRef: string;
  readonly monetaryPolicyVersion: string;
  readonly requestedMoonReyQuantity: string;
  readonly governedQuantityDerivation: 'MONETARY_POLICY_CONVERSION' | 'EXPLICIT_GOVERNANCE_QUANTITY';
  readonly governanceAuthorizationId: string;
  readonly governanceRequirements: readonly string[];
  readonly monetizationKey: string;
  readonly productiveCategory: string;
  readonly productiveAssetId: string;
  readonly network: 'DEVELOPMENT' | 'TESTNET' | 'MAINNET';
  readonly productionEconomicsActive: false;
};

export type MoonReyPipelineRejection =
  | 'ORACLE_QUORUM_INSUFFICIENT'
  | 'INFORMATION_CONSENSUS_INVALID'
  | 'CLAIM_INVALID'
  | 'CLAIM_ALREADY_CONSUMED'
  | 'DUPLICATE_PRODUCTIVE_EVENT'
  | 'DUPLICATE_CLAIM'
  | 'EVIDENCE_INVALID'
  | 'EVIDENCE_TAMPERED'
  | 'RIGHTS_INVALID'
  | 'LICENSE_INVALID'
  | 'POLICY_INVALID'
  | 'POLICY_VERSION_MISMATCH'
  | 'GPUV_INVALID'
  | 'GPUV_VERSION_MISMATCH'
  | 'GPUV_USED_AS_MOONREY_QUANTITY'
  | 'EXCHANGE_PRICE_AS_ISSUANCE_AUTHORITY'
  | 'MONETARY_POLICY_UNAPPROVED'
  | 'MONETARY_POLICY_PRODUCTION_DISABLED'
  | 'GOVERNANCE_MISSING'
  | 'AI_GOVERNANCE_REJECTED'
  | 'FORBIDDEN_AUTHORIZATION_SOURCE'
  | 'ORACLE_CANNOT_AUTHORIZE'
  | 'PRODUCTIVE_VALUE_ENGINE_CANNOT_AUTHORIZE'
  | 'VALIDATOR_CANNOT_AUTHORIZE_ALONE'
  | 'TRANSACTION_INVALID'
  | 'CONSENSUS_FAILED'
  | 'REPLAY_REJECTED'
  | 'STATE_SYNC_REPLAY_REJECTED'
  | 'ZERO_SUPPLY_CHANGE_ON_FAILURE'
  | import('../proof-bound/types.ts').ProofBoundRejection
  | import('../../native-assets/issuance-pipelines.ts').PipelineRefusal;

export type MoonReyEconomicReceipt = {
  readonly schema: typeof MOONREY_ECONOMIC_RECEIPT_SCHEMA;
  readonly receiptKind: 'MOONREY_ECONOMIC_ISSUANCE';
  readonly transactionId: string;
  readonly moonReyQuantity: string;
  readonly productiveClaimId: string;
  readonly productiveAssetId: string;
  readonly productiveCategory: string;
  readonly productiveContributionId: string;
  readonly informationConsensusReceiptId: string;
  readonly informationConsensusDigest: string;
  readonly evidenceRoot: string;
  readonly evidenceProofRef: string;
  readonly rightsRoot: string;
  readonly rightsProofRef: string;
  readonly policyRoot: string;
  readonly policyProofRef: string;
  readonly gpuvValuationId: string;
  readonly gpuvQuantity: string;
  readonly monetaryPolicyRef: string;
  readonly monetaryPolicyVersion: string;
  readonly governanceAuthorizationId: string;
  readonly finalizedBlockHeight: number;
  readonly monetaryStateRoot: string;
  readonly monetizationKey: string;
  readonly whyMoonReyEnteredCirculation: string;
};
