/**
 * Canonical SunRey validator control-plane types (Chunk 36R).
 * Private keys never appear on ValidatorRecord.
 * Voting power is a bounded unsigned integer. No floating point.
 */

export const VALIDATOR_SCHEMA_VERSION = 1 as const;

export const VALIDATOR_STATUSES = [
  'CANDIDATE',
  'BONDED',
  'PENDING_ACTIVATION',
  'ACTIVE',
  'PENDING_EXIT',
  'JAILED',
  'TOMBSTONED',
  'EXITED',
] as const;
export type ValidatorStatus = (typeof VALIDATOR_STATUSES)[number];

export const PERMITTED_VALIDATOR_CONTROLLERS = ['HUMAN', 'LEGAL_ENTITY', 'ENTERPRISE'] as const;
export type PermittedValidatorController = (typeof PERMITTED_VALIDATOR_CONTROLLERS)[number];

export const FORBIDDEN_VALIDATOR_CONTROLLERS = ['AI_AGENT', 'ROBOT', 'DEVICE'] as const;
export type ForbiddenValidatorController = (typeof FORBIDDEN_VALIDATOR_CONTROLLERS)[number];

export const VALIDATOR_KEY_ROLES = [
  'CONSENSUS_VOTING_KEY',
  'P2P_NODE_KEY',
  'GOVERNANCE_KEY',
  'RECOVERY_KEY',
  'REWARD_ADDRESS',
] as const;
export type ValidatorKeyRole = (typeof VALIDATOR_KEY_ROLES)[number];

export const FORBIDDEN_CONSENSUS_KEY_PURPOSES = [
  'EXECUTION_AUTHORITY_SIGNING',
  'CHAIN_OPERATION_SIGNING',
  'P2P_IDENTITY',
  'WALLET_SIGNING',
  'ORACLE_SIGNING',
] as const;

export const BOND_KINDS = ['SIMULATION_BOND', 'NATIVE_PROTOCOL_BOND', 'ADMISSION_CREDENTIAL'] as const;
export type BondKind = (typeof BOND_KINDS)[number];

export const QUEUED_CHANGE_KINDS = [
  'ADD_VALIDATOR',
  'ACTIVATE_VALIDATOR',
  'CHANGE_VOTING_POWER',
  'ROTATE_CONSENSUS_KEY',
  'SCHEDULE_EXIT',
  'JAIL_VALIDATOR',
  'RESTORE_ELIGIBLE_VALIDATOR',
] as const;
export type QueuedChangeKind = (typeof QUEUED_CHANGE_KINDS)[number];

export const CONSENSUS_MESSAGE_TYPES = ['PROPOSAL', 'PREVOTE', 'PRECOMMIT'] as const;
export type ConsensusMessageType = (typeof CONSENSUS_MESSAGE_TYPES)[number];

export const EQUIVOCATION_KINDS = ['DOUBLE_PROPOSAL', 'DOUBLE_PREVOTE', 'DOUBLE_PRECOMMIT'] as const;
export type EquivocationKind = (typeof EQUIVOCATION_KINDS)[number];

export const SIGNER_PROVIDER_KINDS = [
  'LOCAL_DEVELOPMENT_SIGNER',
  'REMOTE_SIGNER',
  'HSM_SIGNER',
  'KMS_SIGNER',
  'PQ_HYBRID_SIGNER',
] as const;
export type SignerProviderKind = (typeof SIGNER_PROVIDER_KINDS)[number];

export const VALIDATOR_REASON_CODES = [
  'BOND_ACCEPTED',
  'QUEUED_FOR_EPOCH',
  'EPOCH_BOUNDARY_ACTIVATE',
  'EXIT_SCHEDULED',
  'EPOCH_BOUNDARY_EXIT',
  'JAIL_EVIDENCE',
  'TOMBSTONE_EQUIVOCATION',
  'RESTORE_ELIGIBLE',
  'UNDEFINED_TRANSITION',
  'FORBIDDEN_CONTROLLER',
  'FORBIDDEN_KEY_PURPOSE',
  'DUPLICATE_CONSENSUS_KEY',
  'KEY_ROLE_MISMATCH',
  'UNIVERSAL_VALIDATOR_KEY',
  'PRIVATE_KEY_IN_RECORD',
  'FLOATING_POINT_FORBIDDEN',
  'CUSTOMER_LEDGER_FORBIDDEN',
  'SUNREY_COIN_STAKE_FORBIDDEN',
  'MOONREY_ISSUANCE_FORBIDDEN',
  'SIGNER_CONFLICT',
  'ACTIVE_SET_IMMUTABLE',
  'EPOCH_NOT_STARTED',
  'OLD_KEY_CANNOT_SIGN_NEW_EPOCH',
  'SIGNER_PROVIDER_UNAVAILABLE',
] as const;
export type ValidatorReasonCode = (typeof VALIDATOR_REASON_CODES)[number];

export const CANONICAL_VALIDATOR_SUITE_ID = 'sunrey-ed25519-v1';
export const HYBRID_VALIDATOR_SUITE_ID = 'sunrey-hybrid-ed25519-mldsa-v1';
export const PQ_VALIDATOR_SUITE_ID = 'sunrey-mldsa-65-v1';
export const DEVELOPMENT_PQ_VALIDATOR_SUITE_IDS = [
  CANONICAL_VALIDATOR_SUITE_ID,
  HYBRID_VALIDATOR_SUITE_ID,
  PQ_VALIDATOR_SUITE_ID,
] as const;
export const CANONICAL_VALIDATOR_ALGORITHM_ID = 'Ed25519';
export const DOMAIN_VALSET = 'sunrey.valset.v1';
export const DOMAIN_CONSENSUS_PROPOSAL = 'sunrey.consensus.proposal.v1';
export const DOMAIN_CONSENSUS_PREVOTE = 'sunrey.consensus.prevote.v1';
export const DOMAIN_CONSENSUS_PRECOMMIT = 'sunrey.consensus.precommit.v1';
export const DOMAIN_VALIDATOR_RECORD = 'sunrey.validator.record.v1';
export const NIL_BLOCK_ID = 'NIL';

export type BondDescriptor = {
  readonly kind: BondKind;
  readonly units: bigint;
  readonly assetRef: string;
  readonly notes: string;
};

export type PublicKeyRef = {
  readonly role: ValidatorKeyRole;
  readonly purpose: string;
  readonly publicKeyHex: string;
  readonly keyId: string;
  readonly suiteId: string;
};

export type ValidatorRecord = {
  readonly validatorId: string;
  readonly operatorActorId: string;
  readonly controllerKind: string;
  readonly legalEntityRef: string | null;
  readonly consensusPublicKey: PublicKeyRef;
  readonly cryptoSuiteId: string;
  readonly p2pNodeId: string;
  readonly p2pPublicKey: PublicKeyRef;
  readonly governancePublicKey: PublicKeyRef;
  readonly recoveryKeyRef: PublicKeyRef;
  readonly rewardAddress: string | null;
  readonly bondDescriptor: BondDescriptor;
  readonly votingPower: bigint;
  readonly status: ValidatorStatus;
  readonly activationEpoch: bigint;
  readonly exitEpoch: bigint | null;
  readonly jurisdictionMetadata: string;
  readonly protocolMetadata: string;
  readonly createdHeight: bigint;
  readonly updatedHeight: bigint;
  readonly schemaVersion: typeof VALIDATOR_SCHEMA_VERSION;
  readonly historicalConsensusKeys: readonly PublicKeyRef[];
};

export type ValidatorEvent = {
  readonly kind: 'VALIDATOR_TRANSITION';
  readonly validatorId: string;
  readonly from: ValidatorStatus;
  readonly to: ValidatorStatus;
  readonly reason: ValidatorReasonCode;
  readonly height: bigint;
  readonly epoch: bigint;
  readonly atUtc: string;
};

export type Epoch = {
  readonly number: bigint;
  readonly startHeight: bigint;
  readonly endHeight: bigint;
  readonly validatorSetVersion: bigint;
};

export type QueuedChange = {
  readonly kind: QueuedChangeKind;
  readonly validatorId: string;
  readonly activationEpoch: bigint;
  readonly votingPower?: bigint;
  readonly consensusPublicKey?: PublicKeyRef;
  readonly controllerKind?: string;
  readonly record?: ValidatorRecord;
};

export type ValidatorSet = {
  readonly version: bigint;
  readonly epoch: bigint;
  readonly validators: readonly ValidatorRecord[];
};

export type TransitionReceipt = {
  readonly fromVersion: bigint;
  readonly toVersion: bigint;
  readonly fromEpoch: bigint;
  readonly toEpoch: bigint;
  readonly applied: readonly QueuedChangeKind[];
  readonly nextValidatorSetHash: string;
};

export type EquivocationEvidence = {
  readonly kind: EquivocationKind;
  readonly validatorId: string;
  readonly validatorSetVersion: bigint;
  readonly height: bigint;
  readonly round: bigint;
  readonly messageType: ConsensusMessageType;
  readonly messageAHash: string;
  readonly messageBHash: string;
  readonly signatureAHex: string;
  readonly signatureBHex: string;
  readonly publicKeyHex: string;
  readonly cryptoSuiteId: string;
  readonly networkId: string;
  readonly chainId: string;
};

export type SignerSafetyState = {
  readonly validatorId: string;
  readonly chainId: string;
  readonly lastSignedHeight: bigint;
  readonly lastSignedRound: bigint;
  readonly lastSignedStep: ConsensusMessageType;
  readonly canonicalSignBytesHash: string;
  readonly signatureReference: string;
  readonly updatedAt: string;
};

export type ConsensusSignRequest = {
  readonly validatorId: string;
  readonly networkId: string;
  readonly chainId: string;
  readonly protocolVersion: string;
  readonly messageType: ConsensusMessageType;
  readonly height: bigint;
  readonly round: bigint;
  readonly blockId: string;
  readonly validatorSetVersion: bigint;
  readonly cryptoSuiteId: string;
};

export type ValidatorFailure = {
  readonly code: ValidatorReasonCode;
  readonly message: string;
};

export type ValidatorResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: ValidatorFailure };

export function validatorOk<T>(value: T): ValidatorResult<T> {
  return { ok: true, value };
}

export function validatorErr(code: ValidatorReasonCode, message: string): ValidatorResult<never> {
  return { ok: false, error: { code, message } };
}

export function simulationBond(units: bigint = 1n): BondDescriptor {
  return Object.freeze({
    kind: 'SIMULATION_BOND',
    units,
    assetRef: 'SIMULATION.VALIDATOR_BOND',
    notes: 'Development accountability primitive. Not customer fiat, not SunRey Coin, not MoonRey.',
  });
}
