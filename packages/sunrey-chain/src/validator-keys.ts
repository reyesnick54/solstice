import type {
  CryptoSuiteId,
  KeyId,
  KeyPurpose,
  PublicKeyDescriptor,
} from '../../security/src/index.ts';

/**
 * Validator key-separation contract. Chunk 36 implements lifecycle
 * against these types. There is no universal validator key.
 *
 * Execution Authority keys must never appear here.
 */

export type ValidatorOperatorIdentity = {
  readonly kind: 'VALIDATOR_OPERATOR_IDENTITY';
  readonly operatorId: string;
  readonly displayName: string;
};

export type ValidatorConsensusVotingKey = {
  readonly kind: 'VALIDATOR_CONSENSUS_VOTING_KEY';
  readonly purpose: 'VALIDATOR_CONSENSUS_SIGNING';
  readonly keyId: KeyId;
  readonly suiteId: CryptoSuiteId;
  readonly publicKey: PublicKeyDescriptor;
};

export type ValidatorBlockProposalKey = {
  readonly kind: 'VALIDATOR_BLOCK_PROPOSAL_KEY';
  readonly purpose: 'BLOCK_PROPOSAL_SIGNING';
  readonly keyId: KeyId;
  readonly suiteId: CryptoSuiteId;
  readonly publicKey: PublicKeyDescriptor;
};

export type ValidatorP2PKey = {
  readonly kind: 'VALIDATOR_P2P_KEY';
  readonly purpose: 'P2P_IDENTITY';
  readonly keyId: KeyId;
  readonly suiteId: CryptoSuiteId;
  readonly publicKey: PublicKeyDescriptor;
};

export type ValidatorRewardAddress = {
  readonly kind: 'VALIDATOR_REWARD_ADDRESS';
  readonly addressCommitment: string;
  readonly purpose: 'WALLET_SIGNING';
};

export type ValidatorGovernanceKey = {
  readonly kind: 'VALIDATOR_GOVERNANCE_KEY';
  readonly purpose: 'GOVERNANCE_SIGNING';
  readonly keyId: KeyId;
  readonly suiteId: CryptoSuiteId;
  readonly publicKey: PublicKeyDescriptor;
};

export type ValidatorRecoveryKey = {
  readonly kind: 'VALIDATOR_RECOVERY_KEY';
  readonly purpose: 'ATTESTATION_SIGNING';
  readonly keyId: KeyId;
  readonly suiteId: CryptoSuiteId;
  readonly publicKey: PublicKeyDescriptor;
};

export type ValidatorKeySet = {
  readonly operator: ValidatorOperatorIdentity;
  readonly consensusVoting: ValidatorConsensusVotingKey;
  readonly blockProposal: ValidatorBlockProposalKey;
  readonly p2p: ValidatorP2PKey;
  readonly rewardAddress: ValidatorRewardAddress;
  readonly governance: ValidatorGovernanceKey;
  readonly recovery: ValidatorRecoveryKey;
};

export const VALIDATOR_KEY_KINDS = [
  'VALIDATOR_OPERATOR_IDENTITY',
  'VALIDATOR_CONSENSUS_VOTING_KEY',
  'VALIDATOR_BLOCK_PROPOSAL_KEY',
  'VALIDATOR_P2P_KEY',
  'VALIDATOR_REWARD_ADDRESS',
  'VALIDATOR_GOVERNANCE_KEY',
  'VALIDATOR_RECOVERY_KEY',
] as const;

export const FORBIDDEN_VALIDATOR_PURPOSES = ['EXECUTION_AUTHORITY_SIGNING'] as const satisfies readonly KeyPurpose[];

export function assertSeparatedValidatorKeys(set: ValidatorKeySet): void {
  const keyIds = [
    set.consensusVoting.keyId,
    set.blockProposal.keyId,
    set.p2p.keyId,
    set.governance.keyId,
    set.recovery.keyId,
  ];
  if (new Set(keyIds).size !== keyIds.length) {
    throw new Error('validator keys must be distinct; no universal validator key');
  }
  const purposes = [
    set.consensusVoting.purpose,
    set.blockProposal.purpose,
    set.p2p.purpose,
    set.governance.purpose,
    set.recovery.purpose,
  ];
  if (purposes.includes('EXECUTION_AUTHORITY_SIGNING' as typeof purposes[number])) {
    throw new Error('Execution Authority keys cannot be validator keys');
  }
}
