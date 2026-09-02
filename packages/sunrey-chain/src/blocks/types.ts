/**
 * Canonical block and transaction lifecycle types for Wave 2.
 *
 * Extension commitment slots are versioned for Wave 3 economic-proof roots.
 */

import type { NativeAssetId } from '../protocol/assets.ts';

export const BLOCK_HEADER_VERSION_V1 = 1 as const;
export const SUPPORTED_BLOCK_HEADER_VERSIONS = [BLOCK_HEADER_VERSION_V1] as const;

/** Reserved extension keys for future commitment roots (Wave 3). */
export const RESERVED_EXTENSION_COMMITMENT_KEYS = [
  'EVIDENCE_ROOT',
  'RIGHTS_ROOT',
  'POLICY_ROOT',
] as const;

export type CanonicalBlockHeader = {
  readonly version: typeof BLOCK_HEADER_VERSION_V1;
  readonly networkId: string;
  readonly chainId: string;
  readonly height: bigint;
  readonly round: number;
  readonly parentBlockHash: Uint8Array;
  readonly transactionRoot: Uint8Array;
  /** State commitment before block execution. */
  readonly previousStateCommitment: Uint8Array;
  /** State commitment after deterministic execution. */
  readonly resultingStateCommitment: Uint8Array;
  readonly validatorSetHash: Uint8Array;
  readonly consensusParameterHash: Uint8Array;
  readonly protocolVersion: string;
  readonly moduleRegistryHash: Uint8Array;
  readonly codecRegistryHash: Uint8Array;
  readonly cryptoPolicyHash: Uint8Array;
  readonly timestampUnixMs: bigint;
  readonly proposer: string;
  readonly cryptoSuiteId: string;
  /** Hash of the BFT commit certificate when finalized; zero before commit. */
  readonly consensusCertificateHash: Uint8Array;
  /** Future roots (evidence, rights, policy) — empty in Wave 2. */
  readonly extensionCommitments: Readonly<Record<string, Uint8Array>>;
};

export type CandidateTransaction = {
  readonly txId: string;
  readonly canonicalBytes: Uint8Array;
  readonly signerAccountId: string;
  readonly nonce: bigint;
  readonly assetId: NativeAssetId;
  readonly amount: bigint;
  readonly fee: bigint;
  readonly toAccountId: string;
};

export type ProposedBlock = {
  readonly header: CanonicalBlockHeader;
  readonly blockHash: string;
  readonly transactions: readonly CandidateTransaction[];
  readonly rejected: readonly { readonly txId: string; readonly reason: string }[];
};

export type FinalizedBlock = ProposedBlock & {
  readonly consensusCertificateHash: string;
  readonly finalizedAtUnixMs: bigint;
};

export const TRANSACTION_LIFECYCLE = [
  'SUBMITTED',
  'PENDING',
  'INCLUDED',
  'EXECUTED',
  'FINALIZED',
  'FAILED',
] as const;
export type TransactionLifecycleStatus = (typeof TRANSACTION_LIFECYCLE)[number];

export type TransactionLifecycleRecord = {
  readonly txId: string;
  readonly status: TransactionLifecycleStatus;
  readonly height: bigint | null;
  readonly blockHash: string | null;
  readonly finalized: boolean;
  readonly failureReason: string | null;
};

export const BLOCK_PIPELINE_STAGES = [
  'CANDIDATE',
  'PROPOSED',
  'VALIDATED',
  'EXECUTED',
  'COMMITTED',
  'FINALIZED',
  'REJECTED',
] as const;
export type BlockPipelineStage = (typeof BLOCK_PIPELINE_STAGES)[number];

export type BlockValidationFailure =
  | 'UNSUPPORTED_VERSION'
  | 'WRONG_NETWORK'
  | 'WRONG_CHAIN'
  | 'INCORRECT_HEIGHT'
  | 'INCORRECT_PARENT'
  | 'WRONG_TRANSACTION_ROOT'
  | 'WRONG_PREVIOUS_STATE'
  | 'WRONG_RESULTING_STATE'
  | 'INVALID_TRANSACTION'
  | 'STATE_DIVERGENCE'
  | 'INVALID_CONSENSUS_CERTIFICATE'
  | 'VALIDATOR_SET_MISMATCH'
  | 'UNSUPPORTED_PROTOCOL_VERSION'
  | 'TIMESTAMP_REGRESSION';

export type ChainIdentity = {
  readonly networkId: string;
  readonly chainId: string;
  readonly protocolVersion: string;
};

export type ValidatorPower = {
  readonly validatorId: string;
  readonly votingPower: bigint;
};

export type CommitCertificate = {
  readonly height: bigint;
  readonly round: number;
  readonly blockHash: string;
  readonly validatorSetVersion: bigint;
  readonly voterIds: readonly string[];
  readonly certificateHash: string;
};

export type NetworkStatus = {
  readonly networkId: string;
  readonly chainId: string;
  readonly protocolVersion: string;
  readonly latestFinalizedHeight: bigint;
  readonly latestFinalizedBlockHash: string | null;
  readonly resultingStateCommitment: string | null;
  readonly validatorSetHash: string | null;
  readonly consensusModel: 'BFT_DETERMINISTIC';
};
