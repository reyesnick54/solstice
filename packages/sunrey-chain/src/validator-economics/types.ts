/**
 * Chunk 72 — SunRey validator economic-security types.
 *
 * Governed bond, reward, and accountability economics for existing
 * validator identities. This is not a second registry, not public
 * delegated staking, and not a second native-asset ledger.
 */

import type { ValidatorStatus } from '../validators/types.ts';

export const VALIDATOR_ECONOMICS_SCHEMA_VERSION = 1 as const;
export const VALIDATOR_ECONOMICS_OWNER = 'packages/sunrey-chain' as const;
export const VALIDATOR_ECONOMICS_DOMAIN = 'sunrey.validator.economics.v1' as const;

export const BOND_STATES = [
  'UNBONDED',
  'BONDING',
  'BONDED',
  'UNBONDING',
  'JAILED',
  'TOMBSTONED',
  'EXITED',
] as const;
export type BondState = (typeof BOND_STATES)[number];

export const BOND_ASSET_STATUSES = ['UNCONFIGURED', 'DEVELOPMENT_FIXTURE', 'REHEARSAL_FIXTURE'] as const;
export type BondAssetStatus = (typeof BOND_ASSET_STATUSES)[number];

export const BOND_ASSET_IDS = [
  'UNCONFIGURED',
  'DEVELOPMENT_SUNREY_COIN',
  'REHEARSAL_SUNREY_COIN',
] as const;
export type BondAssetId = (typeof BOND_ASSET_IDS)[number];

export const REWARD_SOURCES = [
  'TRANSACTION_FEE_ALLOCATION',
  'EXPLICIT_VALIDATOR_REWARD_POOL',
  'MONETARY_POLICY_APPROVED_SOURCE',
] as const;
export type RewardSource = (typeof REWARD_SOURCES)[number];

export const REMAINDER_DESTINATIONS = ['NETWORK_SINK', 'NEXT_EPOCH_REWARD_POOL'] as const;
export type RemainderDestination = (typeof REMAINDER_DESTINATIONS)[number];

export const VIOLATION_CLASSES = [
  'DOUBLE_PROPOSAL',
  'DOUBLE_PREVOTE',
  'DOUBLE_PRECOMMIT',
] as const;
export type ViolationClass = (typeof VIOLATION_CLASSES)[number];

export const EXCLUSIVE_LOCK_PURPOSES = [
  'VALIDATOR_BOND',
  'SPEND',
  'WITHDRAW',
  'EXCHANGE_RESERVED',
  'MACHINE_ESCROW',
  'INTEROP_ESCROW',
] as const;
export type ExclusiveLockPurpose = (typeof EXCLUSIVE_LOCK_PURPOSES)[number];

export const ECONOMIC_ACCOUNT_DOMAINS = [
  'VALIDATOR_BOND',
  'VALIDATOR_REWARD',
  'CUSTOMER_WALLET',
  'CUSTODY_CUSTOMER',
  'EXCHANGE_CUSTOMER',
  'FIAT_LEDGER',
  'MACHINE_ESCROW',
] as const;
export type EconomicAccountDomain = (typeof ECONOMIC_ACCOUNT_DOMAINS)[number];

export const POLICY_ENVIRONMENTS = ['development', 'rehearsal', 'production'] as const;
export type PolicyEnvironment = (typeof POLICY_ENVIRONMENTS)[number];

export const ECONOMICS_REASON_CODES = [
  'BOND_LOCKED',
  'BONDING_DELAY_PENDING',
  'BOND_ACTIVATED',
  'UNBOND_REQUESTED',
  'UNBOND_DELAY_PENDING',
  'UNBOND_RELEASED',
  'REWARD_SETTLED',
  'REWARD_REMAINDER_ALLOCATED',
  'PENALTY_APPLIED',
  'JAILED',
  'TOMBSTONED',
  'EXITED',
  'POLICY_ACTIVATED',
  'PRODUCTION_BOND_ASSET_UNCONFIGURED',
  'PRODUCTION_MINIMUM_BOND_UNCONFIGURED',
  'WRONG_BOND_ASSET',
  'MINIMUM_BOND_UNMET',
  'UNITS_ALREADY_OCCUPIED',
  'BONDED_TO_ANOTHER_VALIDATOR',
  'INSUFFICIENT_AVAILABLE',
  'IMMEDIATE_UNBOND_REJECTED',
  'ACCOUNTABILITY_WINDOW_ACTIVE',
  'PENDING_EVIDENCE',
  'REWARDS_NOT_RECONCILED',
  'DUPLICATE_REWARD',
  'DUPLICATE_PENALTY',
  'INVALID_EVIDENCE',
  'FORGED_EVIDENCE',
  'REPLAYED_EVIDENCE',
  'MONITORING_SUSPICION_INSUFFICIENT',
  'CUSTOMER_ASSET_ISOLATION',
  'UNAUTHORIZED_POLICY_UPDATE',
  'AI_CANNOT_AUTHORIZE_ECONOMICS',
  'WRONG_POLICY_VERSION',
  'REWARD_OVERFLOW',
  'HIDDEN_INFLATION_FORBIDDEN',
  'PUBLIC_DELEGATION_FORBIDDEN',
  'COIN_EQUALS_VOTE_FORBIDDEN',
  'TOMBSTONE_READMISSION_REQUIRES_GOVERNANCE',
  'UNDEFINED_VALIDATOR_TRANSITION',
  'VALIDATOR_NOT_FOUND',
] as const;
export type EconomicsReasonCode = (typeof ECONOMICS_REASON_CODES)[number];

export const MAX_ECONOMIC_UNITS = 10n ** 38n - 1n;
export const BASIS_POINTS = 10_000n;

export type EconomicsFailure = {
  readonly code: EconomicsReasonCode;
  readonly message: string;
};

export type EconomicsResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: EconomicsFailure };

export function economicsOk<T>(value: T): EconomicsResult<T> {
  return { ok: true, value };
}

export function economicsErr(code: EconomicsReasonCode, message: string): EconomicsResult<never> {
  return { ok: false, error: { code, message } };
}

export type ValidatorBondPolicy = {
  readonly version: number;
  readonly environment: PolicyEnvironment;
  readonly bondAsset: BondAssetId;
  readonly bondAssetStatus: BondAssetStatus;
  readonly minimumBond: bigint | 'UNCONFIGURED';
  readonly minimumBondFixture: boolean;
  readonly bondingDelayEpochs: bigint | 'UNCONFIGURED';
  readonly unbondingDelayEpochs: bigint | 'UNCONFIGURED';
  readonly accountabilityWindowEpochs: bigint;
  readonly productionParametersConfigured: false | boolean;
  readonly notes: string;
};

export type ValidatorRewardPolicy = {
  readonly version: number;
  readonly environment: PolicyEnvironment;
  readonly approvedSources: readonly RewardSource[];
  readonly voteWeight: bigint;
  readonly proposalWeight: bigint;
  readonly feeRewardShareBps: bigint;
  readonly remainderDestination: RemainderDestination;
  readonly hiddenInflation: false;
  readonly notes: string;
};

export type ValidatorPenaltyRule = {
  readonly violationClass: ViolationClass;
  readonly requiredEvidence: ViolationClass;
  readonly bondImpactBps: bigint;
  readonly rewardForfeit: boolean;
  readonly jail: boolean;
  readonly tombstone: boolean;
  readonly policyVersion: number;
};

export type ValidatorPenaltyPolicy = {
  readonly version: number;
  readonly environment: PolicyEnvironment;
  readonly rules: readonly ValidatorPenaltyRule[];
  readonly monitoringSuspicionInsufficient: true;
  readonly notes: string;
};

export type ValidatorEconomicPolicy = {
  readonly version: number;
  readonly activationEpoch: bigint;
  readonly activationHeight: bigint;
  readonly environment: PolicyEnvironment;
  readonly bond: ValidatorBondPolicy;
  readonly reward: ValidatorRewardPolicy;
  readonly penalty: ValidatorPenaltyPolicy;
  readonly coinEqualsVote: false;
  readonly publicDelegation: false;
  readonly customerAssetsIsolated: true;
  readonly aiMayAuthorize: false;
};

export type ValidatorBondPosition = {
  readonly validatorId: string;
  readonly operatorId: string;
  readonly bondAsset: BondAssetId;
  readonly bondedQuantity: bigint;
  readonly activeLockedQuantity: bigint;
  readonly pendingUnbondQuantity: bigint;
  readonly rewardQuantity: bigint;
  readonly penaltyQuantity: bigint;
  readonly policyVersion: number;
  readonly activationEpoch: bigint;
  readonly state: BondState;
  readonly validatorStatus: ValidatorStatus;
  readonly unbondRequestEpoch: bigint | null;
  readonly releaseEpoch: bigint | null;
  readonly jailEpoch: bigint | null;
};

export type ParticipationRecord = {
  readonly entitlementId: string;
  readonly validatorId: string;
  readonly epoch: bigint;
  readonly height: bigint;
  readonly expectedVotes: bigint;
  readonly validSignedVotes: bigint;
  readonly missedVotes: bigint;
  readonly proposalAssignments: bigint;
  readonly validProposals: bigint;
  readonly activeVotingPower: bigint;
  readonly epochMember: boolean;
  readonly policyVersion: number;
};

export type ValidatorRewardReceipt = {
  readonly receiptId: string;
  readonly entitlementId: string;
  readonly validatorId: string;
  readonly epoch: bigint;
  readonly height: bigint;
  readonly asset: BondAssetId;
  readonly source: RewardSource;
  readonly entitled: bigint;
  readonly paid: bigint;
  readonly policyVersion: number;
};

export type ProtocolEvidence = {
  readonly evidenceId: string;
  readonly violationClass: ViolationClass;
  readonly validatorId: string;
  readonly height: bigint;
  readonly round: bigint;
  readonly leftHash: string;
  readonly rightHash: string;
  readonly signatureA: string;
  readonly signatureB: string;
  readonly verified: boolean;
  readonly forged: boolean;
  readonly monitoringSuspicionOnly: boolean;
};

export type ValidatorPenaltyReceipt = {
  readonly receiptId: string;
  readonly evidenceId: string;
  readonly validatorId: string;
  readonly violationClass: ViolationClass;
  readonly epoch: bigint;
  readonly height: bigint;
  readonly bondImpact: bigint;
  readonly rewardImpact: bigint;
  readonly jailed: boolean;
  readonly tombstoned: boolean;
  readonly policyVersion: number;
};

export type ExclusiveLock = {
  readonly lockId: string;
  readonly ownerId: string;
  readonly validatorId: string | null;
  readonly asset: BondAssetId;
  readonly quantity: bigint;
  readonly purpose: ExclusiveLockPurpose;
  readonly createdEpoch: bigint;
};

export type PolicyActor = {
  readonly actorId: string;
  readonly kind: 'HUMAN' | 'AI' | 'AGENT' | 'AUTOMATION';
  readonly role: string;
  readonly governanceAuthorized: boolean;
};

export type ValidatorEconomicsReconciliation = {
  readonly epoch: bigint;
  readonly bondLocks: bigint;
  readonly pendingUnbond: bigint;
  readonly rewardPool: bigint;
  readonly rewardEntitlements: bigint;
  readonly paidRewards: bigint;
  readonly remainder: bigint;
  readonly penalties: bigint;
  readonly supplyImpact: {
    readonly issuedToBondDomain: bigint;
    readonly locked: bigint;
    readonly released: bigint;
    readonly penalized: bigint;
    readonly available: bigint;
  };
  readonly balanced: boolean;
  readonly balancingEntries: false;
  readonly notes: string;
};

export type EconomicSecurityMetrics = {
  readonly totalBondedQuantity: bigint;
  readonly bondConcentration: { readonly largest: bigint; readonly total: bigint };
  readonly rewardDistribution: readonly { readonly validatorId: string; readonly paid: bigint }[];
  readonly penaltyExposure: bigint;
  readonly bondAtRisk: bigint;
  readonly votingPowerConcentration: { readonly largest: bigint; readonly total: bigint };
  readonly operatorConcentration: { readonly largestOperatorValidators: number; readonly validatorCount: number };
  readonly attackCostProxy: {
    readonly assumptions: string;
    readonly bondedQuantityAtRisk: bigint;
    readonly guaranteedEconomicSecurity: false;
  };
};

export type PublicBondView = {
  readonly validatorId: string;
  readonly bondState: BondState;
  readonly bondAsset: BondAssetId;
  readonly bondedQuantity: string;
  readonly policyVersion: number;
  readonly jailStatus: 'JAILED' | null;
  readonly tombstone: boolean;
  readonly unbondStatus: {
    readonly pending: string;
    readonly releaseEpoch: string | null;
  };
};

export type PublicRewardSummary = {
  readonly validatorId: string;
  readonly paid: string;
  readonly pending: string;
  readonly policyVersion: number;
};

export type PublicPenaltyRecord = {
  readonly evidenceId: string;
  readonly violationClass: ViolationClass;
  readonly bondImpact: string;
  readonly jailed: boolean;
  readonly tombstoned: boolean;
  readonly policyVersion: number;
};

export function mapValidatorStatusToBondState(
  status: ValidatorStatus,
  position: Pick<ValidatorBondPosition, 'state' | 'activeLockedQuantity' | 'pendingUnbondQuantity'> | null,
): BondState {
  if (status === 'JAILED') {
    return 'JAILED';
  }
  if (status === 'TOMBSTONED') {
    return 'TOMBSTONED';
  }
  if (status === 'EXITED') {
    return 'EXITED';
  }
  if (status === 'PENDING_EXIT' || (position && position.pendingUnbondQuantity > 0n)) {
    return 'UNBONDING';
  }
  if (status === 'CANDIDATE' && (!position || position.activeLockedQuantity === 0n)) {
    return 'UNBONDED';
  }
  if (status === 'BONDED' || status === 'PENDING_ACTIVATION') {
    return position?.state === 'BONDED' ? 'BONDED' : 'BONDING';
  }
  if (status === 'ACTIVE') {
    return 'BONDED';
  }
  return position?.state ?? 'UNBONDED';
}
