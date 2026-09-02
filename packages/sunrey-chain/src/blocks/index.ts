export {
  DOMAIN_BLOCK_ID,
  DOMAIN_LEAF,
  DOMAIN_MERKLE,
  DOMAIN_STATE_ROOT,
  DOMAIN_TX_ROOT,
  HASH_SIZE,
  blockId,
  hashDomain,
  hashFromHex,
  hashToHex,
  merkleRoot,
  stateLeaf,
  stateRoot,
  transactionIdFromBytes,
  transactionRoot,
  encodeBlockHeader,
} from './commitments.ts';

export { encodeBytes, encodeString, encodeU32, encodeU64, domainPayload } from './codec.ts';

export {
  BLOCK_HEADER_VERSION_V1,
  BLOCK_PIPELINE_STAGES,
  RESERVED_EXTENSION_COMMITMENT_KEYS,
  SUPPORTED_BLOCK_HEADER_VERSIONS,
  TRANSACTION_LIFECYCLE,
} from './types.ts';
export type {
  BlockPipelineStage,
  BlockValidationFailure,
  CandidateTransaction,
  CanonicalBlockHeader,
  ChainIdentity,
  CommitCertificate,
  FinalizedBlock,
  NetworkStatus,
  ProposedBlock,
  TransactionLifecycleRecord,
  TransactionLifecycleStatus,
  ValidatorPower,
} from './types.ts';

export { MonetaryStateStore, reconcileNativeSupply } from './monetary-state.ts';
export type { AccountBalance, AssetSupplySnapshot } from './monetary-state.ts';

export {
  advanceLifecycle,
  advanceToIncluded,
  canAdvance,
  createSubmitted,
  isCanonicalTruth,
  isNonFinalExposure,
  lifecycleRank,
} from './lifecycle.ts';

export {
  BFT_FAULT_THRESHOLD_DENOMINATOR,
  BFT_FAULT_THRESHOLD_NUMERATOR,
  bftQuorumSatisfied,
  buildCommitCertificate,
  observeFinality,
  quorumPower,
  totalVotingPower,
  verifyCommitCertificate,
} from './finality.ts';
export type { FinalityObservation } from './finality.ts';

export {
  computeTransactionRoot,
  executeTransactions,
  validateBlockHeader,
  validateConsensusCertificate,
  validateProposedBlock,
} from './validation.ts';
export type { BlockValidationResult } from './validation.ts';

export { rejectNonFinalizedAsCanonical, resolveFinalizedConflict } from './fork.ts';
export type { ForkResolution } from './fork.ts';

export { createChainQueries } from './queries.ts';
export type { ChainQuerySurface } from './queries.ts';

export { assertFinalizedReconciliation, reconcileFinalizedBlock } from './reconciliation.ts';
export type { ReconciliationReport } from './reconciliation.ts';

export { BlockLifecycleEngine, candidateTransaction } from './engine.ts';
export type { PersistedChainSnapshot } from './engine.ts';

export const WAVE2_BLOCKS_CAPABILITY = {
  owner: 'packages/sunrey-chain',
  path: 'packages/sunrey-chain/src/blocks',
  consensusModel: 'BFT_DETERMINISTIC',
  extensionCommitmentsReserved: true,
} as const;
