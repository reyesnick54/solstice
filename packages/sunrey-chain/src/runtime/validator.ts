export const OPERATOR_LIFECYCLE = [
  'REGISTERED',
  'PENDING_ACTIVATION',
  'ACTIVE',
  'SUSPENDED',
  'EXITING',
  'INACTIVE',
] as const;
export type OperatorLifecycle = (typeof OPERATOR_LIFECYCLE)[number];

export const PROTOCOL_STATUSES = [
  'CANDIDATE',
  'BONDED',
  'PENDING_ACTIVATION',
  'ACTIVE',
  'PENDING_EXIT',
  'JAILED',
  'TOMBSTONED',
  'EXITED',
] as const;
export type ProtocolValidatorStatus = (typeof PROTOCOL_STATUSES)[number];

export type ValidatorProductRecord = {
  readonly validatorId: string;
  readonly operator: string;
  readonly networkId: string;
  readonly consensusKeyId: string;
  readonly p2pKeyId: string;
  readonly governanceKeyId: string;
  readonly status: OperatorLifecycle;
  readonly protocolStatus: ProtocolValidatorStatus;
  readonly votingPower: bigint;
  readonly bondKind: string;
  readonly bondUnits: bigint;
  readonly activationEpoch: number;
  readonly metadata: string;
  readonly mainnetActivationRequiresGovernance: true;
};

const PROTOCOL_TO_OPERATOR: Record<ProtocolValidatorStatus, OperatorLifecycle> = {
  CANDIDATE: 'REGISTERED',
  BONDED: 'REGISTERED',
  PENDING_ACTIVATION: 'PENDING_ACTIVATION',
  ACTIVE: 'ACTIVE',
  JAILED: 'SUSPENDED',
  PENDING_EXIT: 'EXITING',
  TOMBSTONED: 'INACTIVE',
  EXITED: 'INACTIVE',
};

export function toOperatorLifecycle(status: ProtocolValidatorStatus): OperatorLifecycle {
  return PROTOCOL_TO_OPERATOR[status];
}

export function refuseMainnetActivation(
  environment: string,
  humanGovernanceApproved: boolean,
): 'OK' | 'MAINNET_ACTIVATION_REQUIRES_GOVERNANCE' {
  if (environment === 'MAINNET' && !humanGovernanceApproved) {
    return 'MAINNET_ACTIVATION_REQUIRES_GOVERNANCE';
  }
  return 'OK';
}

export const ALLOWED_OPERATOR_TRANSITIONS: Record<OperatorLifecycle, readonly OperatorLifecycle[]> = {
  REGISTERED: ['PENDING_ACTIVATION', 'SUSPENDED'],
  PENDING_ACTIVATION: ['ACTIVE', 'SUSPENDED'],
  ACTIVE: ['EXITING', 'SUSPENDED'],
  SUSPENDED: ['REGISTERED', 'INACTIVE'],
  EXITING: ['INACTIVE', 'SUSPENDED'],
  INACTIVE: [],
};
