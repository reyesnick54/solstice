/**
 * Canonical validator economics engine.
 *
 * Bonds use exclusive native-lock semantics. Rewards use exact integer
 * arithmetic. Penalties require valid protocol evidence. Customer-asset
 * domains cannot be debited.
 */

import { transitionValidator } from '../validators/lifecycle.ts';
import type { ValidatorRecord, ValidatorStatus } from '../validators/types.ts';
import { authorizePolicyUpdate, createEconomicPolicy, policyAt } from './policy.ts';
import {
  BASIS_POINTS,
  MAX_ECONOMIC_UNITS,
  economicsErr,
  economicsOk,
  mapValidatorStatusToBondState,
  type BondAssetId,
  type EconomicAccountDomain,
  type EconomicSecurityMetrics,
  type EconomicsResult,
  type ExclusiveLock,
  type ExclusiveLockPurpose,
  type ParticipationRecord,
  type PolicyActor,
  type PolicyEnvironment,
  type ProtocolEvidence,
  type PublicBondView,
  type PublicPenaltyRecord,
  type PublicRewardSummary,
  type RewardSource,
  type ValidatorBondPosition,
  type ValidatorEconomicPolicy,
  type ValidatorEconomicsReconciliation,
  type ValidatorPenaltyReceipt,
  type ValidatorRewardReceipt,
} from './types.ts';

function emptyPosition(
  validatorId: string,
  operatorId: string,
  asset: BondAssetId,
  policyVersion: number,
  status: ValidatorStatus,
): ValidatorBondPosition {
  return Object.freeze({
    validatorId,
    operatorId,
    bondAsset: asset,
    bondedQuantity: 0n,
    activeLockedQuantity: 0n,
    pendingUnbondQuantity: 0n,
    rewardQuantity: 0n,
    penaltyQuantity: 0n,
    policyVersion,
    activationEpoch: 0n,
    state: mapValidatorStatusToBondState(status, null),
    validatorStatus: status,
    unbondRequestEpoch: null,
    releaseEpoch: null,
    jailEpoch: null,
  });
}

function checkedMul(left: bigint, right: bigint): bigint | null {
  if (left < 0n || right < 0n) {
    return null;
  }
  const product = left * right;
  if (product > MAX_ECONOMIC_UNITS) {
    return null;
  }
  return product;
}

export function verifyProtocolEvidence(evidence: ProtocolEvidence): EconomicsResult<ProtocolEvidence> {
  if (evidence.monitoringSuspicionOnly) {
    return economicsErr('MONITORING_SUSPICION_INSUFFICIENT', 'monitoring suspicion cannot produce a protocol penalty');
  }
  if (evidence.forged || !evidence.verified) {
    return economicsErr(evidence.forged ? 'FORGED_EVIDENCE' : 'INVALID_EVIDENCE', 'protocol evidence is not valid');
  }
  if (evidence.leftHash.length === 0 || evidence.rightHash.length === 0 || evidence.leftHash === evidence.rightHash) {
    return economicsErr('INVALID_EVIDENCE', 'equivocation evidence must present two conflicting messages');
  }
  if (evidence.signatureA.length === 0 || evidence.signatureB.length === 0) {
    return economicsErr('INVALID_EVIDENCE', 'equivocation evidence requires two valid signatures');
  }
  if (evidence.evidenceId.length === 0) {
    return economicsErr('INVALID_EVIDENCE', 'evidence id is required');
  }
  return economicsOk(evidence);
}

export function rewardWeight(record: ParticipationRecord, policy: ValidatorEconomicPolicy): bigint {
  if (!record.epochMember) {
    return 0n;
  }
  const votePart = record.validSignedVotes * policy.reward.voteWeight;
  const proposalPart = record.validProposals * policy.reward.proposalWeight;
  return (votePart + proposalPart) * record.activeVotingPower;
}

export class ValidatorEconomicsEngine {
  readonly environment: PolicyEnvironment;
  epoch = 0n;
  height = 0n;
  private readonly history: ValidatorEconomicPolicy[];
  private readonly positions = new Map<string, ValidatorBondPosition>();
  private readonly records = new Map<string, ValidatorRecord>();
  private readonly locks = new Map<string, ExclusiveLock>();
  private readonly occupancies = new Map<string, ExclusiveLock[]>();
  private readonly available = new Map<string, bigint>();
  private readonly issued = new Map<string, bigint>();
  private readonly participation = new Map<string, ParticipationRecord>();
  private readonly paidEntitlements = new Set<string>();
  private readonly executedEvidence = new Set<string>();
  private readonly rewardReceipts: ValidatorRewardReceipt[] = [];
  private readonly penaltyReceipts: ValidatorPenaltyReceipt[] = [];
  private readonly pendingEvidence = new Map<string, string[]>();
  private readonly accountDomains = new Map<string, EconomicAccountDomain>();
  private readonly customerBalances = new Map<string, bigint>();
  rewardPool = 0n;
  remainderSink = 0n;
  entitledTotal = 0n;
  paidTotal = 0n;
  penalizedTotal = 0n;
  releasedTotal = 0n;
  private receiptSeq = 0;

  constructor(environment: PolicyEnvironment = 'development') {
    this.environment = environment;
    this.history = [createEconomicPolicy(environment, 1, 0n, 0n)];
  }

  policy(epoch = this.epoch): ValidatorEconomicPolicy {
    return policyAt(this.history, epoch);
  }

  policyHistory(): readonly ValidatorEconomicPolicy[] {
    return this.history;
  }

  registerValidator(record: ValidatorRecord, operatorAvailable = 0n): ValidatorBondPosition {
    this.records.set(record.validatorId, record);
    this.accountDomains.set(record.validatorId, 'VALIDATOR_BOND');
    if (record.operatorActorId) {
      this.accountDomains.set(record.operatorActorId, 'VALIDATOR_BOND');
    }
    const policy = this.policy();
    if (!this.positions.has(record.validatorId)) {
      this.positions.set(
        record.validatorId,
        emptyPosition(record.validatorId, record.operatorActorId, policy.bond.bondAsset, policy.version, record.status),
      );
    }
    if (operatorAvailable > 0n) {
      this.creditBondDomain(record.operatorActorId, operatorAvailable, policy.bond.bondAsset);
    }
    return this.positions.get(record.validatorId)!;
  }

  creditBondDomain(ownerId: string, quantity: bigint, asset: BondAssetId): void {
    const policy = this.policy();
    if (asset !== policy.bond.bondAsset) {
      throw new TypeError('bond-domain credit must use the active bond asset');
    }
    this.accountDomains.set(ownerId, 'VALIDATOR_BOND');
    this.available.set(ownerId, (this.available.get(ownerId) ?? 0n) + quantity);
    this.issued.set(asset, (this.issued.get(asset) ?? 0n) + quantity);
  }

  markCustomerAccount(accountId: string, domain: Exclude<EconomicAccountDomain, 'VALIDATOR_BOND' | 'VALIDATOR_REWARD'>, balance: bigint): void {
    this.accountDomains.set(accountId, domain);
    this.customerBalances.set(accountId, balance);
  }

  occupy(ownerId: string, purpose: ExclusiveLockPurpose, quantity: bigint, validatorId: string | null = null): EconomicsResult<ExclusiveLock> {
    const available = this.available.get(ownerId) ?? 0n;
    if (available < quantity) {
      return economicsErr('INSUFFICIENT_AVAILABLE', 'insufficient unoccupied units');
    }
    const existing = this.occupancies.get(ownerId) ?? [];
    if (purpose === 'VALIDATOR_BOND' && validatorId && existing.some((row) => row.purpose === 'VALIDATOR_BOND' && row.validatorId && row.validatorId !== validatorId && row.quantity > 0n && available === 0n)) {
      return economicsErr('BONDED_TO_ANOTHER_VALIDATOR', 'requested units are already bonded to another validator');
    }
    if (purpose !== 'VALIDATOR_BOND' && available === 0n && existing.some((row) => row.purpose === 'VALIDATOR_BOND')) {
      return economicsErr('UNITS_ALREADY_OCCUPIED', 'bonded units cannot be spent, withdrawn, reserved, or escrowed');
    }
    const lock: ExclusiveLock = Object.freeze({
      lockId: `lock_${ownerId}_${purpose}_${this.locks.size + 1}`,
      ownerId,
      validatorId,
      asset: this.policy().bond.bondAsset,
      quantity,
      purpose,
      createdEpoch: this.epoch,
    });
    this.locks.set(lock.lockId, lock);
    this.occupancies.set(ownerId, [...existing, lock]);
    if (purpose === 'VALIDATOR_BOND') {
      this.available.set(ownerId, available - quantity);
    } else {
      this.available.set(ownerId, available - quantity);
    }
    return economicsOk(lock);
  }

  bond(input: {
    readonly validatorId: string;
    readonly quantity: bigint;
    readonly asset: BondAssetId;
    readonly policyVersion?: number;
  }): EconomicsResult<ValidatorBondPosition> {
    const record = this.records.get(input.validatorId);
    if (!record) {
      return economicsErr('VALIDATOR_NOT_FOUND', `unknown validator ${input.validatorId}`);
    }
    const policy = this.policy();
    if (input.policyVersion !== undefined && input.policyVersion !== policy.version) {
      return economicsErr('WRONG_POLICY_VERSION', 'bond must use the policy active at this epoch');
    }
    if (policy.environment === 'production' || policy.bond.bondAsset === 'UNCONFIGURED') {
      return economicsErr('PRODUCTION_BOND_ASSET_UNCONFIGURED', 'production bond asset is UNCONFIGURED');
    }
    if (policy.bond.minimumBond === 'UNCONFIGURED') {
      return economicsErr('PRODUCTION_MINIMUM_BOND_UNCONFIGURED', 'production minimum bond is UNCONFIGURED');
    }
    if (input.asset !== policy.bond.bondAsset) {
      return economicsErr('WRONG_BOND_ASSET', `bond asset must be ${policy.bond.bondAsset}`);
    }
    if (input.quantity < policy.bond.minimumBond) {
      return economicsErr('MINIMUM_BOND_UNMET', 'quantity is below the governed minimum bond');
    }
    const current = this.positions.get(input.validatorId)!;
    if (current.state === 'TOMBSTONED') {
      return economicsErr('TOMBSTONE_READMISSION_REQUIRES_GOVERNANCE', 'tombstoned identities cannot silently rebond');
    }
    const locked = this.occupy(record.operatorActorId, 'VALIDATOR_BOND', input.quantity, input.validatorId);
    if (!locked.ok) {
      return locked;
    }
    let nextRecord = record;
    if (record.status === 'CANDIDATE') {
      const transitioned = transitionValidator(record, 'BONDED', this.height, this.epoch, '2026-08-17T00:00:00.000Z');
      if (!transitioned.ok) {
        return economicsErr('UNDEFINED_VALIDATOR_TRANSITION', transitioned.error.message);
      }
      nextRecord = transitioned.value.record;
      this.records.set(input.validatorId, nextRecord);
    }
    const next: ValidatorBondPosition = Object.freeze({
      ...current,
      bondAsset: input.asset,
      bondedQuantity: current.bondedQuantity + input.quantity,
      activeLockedQuantity: current.activeLockedQuantity + input.quantity,
      policyVersion: policy.version,
      activationEpoch: this.epoch,
      state: policy.bond.bondingDelayEpochs === 0n ? 'BONDED' : 'BONDING',
      validatorStatus: nextRecord.status,
    });
    this.positions.set(input.validatorId, next);
    return economicsOk(next);
  }

  advanceEpoch(): void {
    this.epoch += 1n;
    this.height += 8n;
    const policy = this.policy();
    for (const [id, position] of this.positions) {
      const record = this.records.get(id);
      if (!record) {
        continue;
      }
      if (position.state === 'BONDING' && policy.bond.bondingDelayEpochs !== 'UNCONFIGURED') {
        if (this.epoch >= position.activationEpoch + policy.bond.bondingDelayEpochs) {
          let nextRecord = record;
          if (record.status === 'BONDED') {
            const queued = transitionValidator(record, 'PENDING_ACTIVATION', this.height, this.epoch, '2026-08-17T00:00:00.000Z');
            if (queued.ok) {
              const activated = transitionValidator(queued.value.record, 'ACTIVE', this.height, this.epoch, '2026-08-17T00:00:00.000Z');
              if (activated.ok) {
                nextRecord = activated.value.record;
              }
            }
          }
          this.records.set(id, nextRecord);
          this.positions.set(id, Object.freeze({
            ...position,
            state: 'BONDED',
            validatorStatus: nextRecord.status,
          }));
        }
      }
    }
  }

  requestUnbond(validatorId: string, quantity?: bigint): EconomicsResult<ValidatorBondPosition> {
    const position = this.positions.get(validatorId);
    const record = this.records.get(validatorId);
    if (!position || !record) {
      return economicsErr('VALIDATOR_NOT_FOUND', `unknown validator ${validatorId}`);
    }
    const policy = this.policy();
    if (policy.bond.unbondingDelayEpochs === 'UNCONFIGURED') {
      return economicsErr('PRODUCTION_MINIMUM_BOND_UNCONFIGURED', 'production unbonding delay is UNCONFIGURED');
    }
    if (position.state !== 'BONDED' && position.state !== 'JAILED') {
      return economicsErr('IMMEDIATE_UNBOND_REJECTED', 'unbond requires an active or jailed bonded position');
    }
    const amount = quantity ?? position.activeLockedQuantity;
    if (amount <= 0n || amount > position.activeLockedQuantity) {
      return economicsErr('INSUFFICIENT_AVAILABLE', 'unbond quantity exceeds active locked quantity');
    }
    let nextRecord = record;
    if (record.status === 'ACTIVE') {
      const transitioned = transitionValidator(record, 'PENDING_EXIT', this.height, this.epoch, '2026-08-17T00:00:00.000Z');
      if (!transitioned.ok) {
        return economicsErr('UNDEFINED_VALIDATOR_TRANSITION', transitioned.error.message);
      }
      nextRecord = transitioned.value.record;
      this.records.set(validatorId, nextRecord);
    }
    const next: ValidatorBondPosition = Object.freeze({
      ...position,
      activeLockedQuantity: position.activeLockedQuantity - amount,
      pendingUnbondQuantity: position.pendingUnbondQuantity + amount,
      state: 'UNBONDING',
      validatorStatus: nextRecord.status,
      unbondRequestEpoch: this.epoch,
      releaseEpoch: this.epoch + policy.bond.unbondingDelayEpochs,
    });
    this.positions.set(validatorId, next);
    return economicsOk(next);
  }

  releaseUnbond(validatorId: string): EconomicsResult<ValidatorBondPosition> {
    const position = this.positions.get(validatorId);
    const record = this.records.get(validatorId);
    if (!position || !record) {
      return economicsErr('VALIDATOR_NOT_FOUND', `unknown validator ${validatorId}`);
    }
    if (position.releaseEpoch === null || position.pendingUnbondQuantity === 0n) {
      return economicsErr('IMMEDIATE_UNBOND_REJECTED', 'no pending unbond to release');
    }
    if (this.epoch < position.releaseEpoch) {
      return economicsErr('IMMEDIATE_UNBOND_REJECTED', 'unbond delay has not elapsed');
    }
    const pending = this.pendingEvidence.get(validatorId) ?? [];
    if (pending.length > 0) {
      return economicsErr('PENDING_EVIDENCE', 'pending evidence blocks unbond release');
    }
    const policy = this.policy();
    if (
      position.unbondRequestEpoch !== null
      && this.epoch < position.unbondRequestEpoch + policy.bond.accountabilityWindowEpochs
    ) {
      return economicsErr('ACCOUNTABILITY_WINDOW_ACTIVE', 'accountability window has not elapsed');
    }
    this.available.set(
      position.operatorId,
      (this.available.get(position.operatorId) ?? 0n) + position.pendingUnbondQuantity,
    );
    this.releasedTotal += position.pendingUnbondQuantity;
    const remainingBond = position.bondedQuantity - position.pendingUnbondQuantity;
    let nextRecord = record;
    let nextState = remainingBond > 0n ? position.state : 'UNBONDED';
    if (remainingBond === 0n && (record.status === 'PENDING_EXIT' || record.status === 'ACTIVE')) {
      const from = record.status === 'ACTIVE'
        ? transitionValidator(record, 'PENDING_EXIT', this.height, this.epoch, '2026-08-17T00:00:00.000Z')
        : { ok: true as const, value: { record } };
      if (from.ok) {
        const exited = transitionValidator(from.value.record, 'EXITED', this.height, this.epoch, '2026-08-17T00:00:00.000Z');
        if (exited.ok) {
          nextRecord = exited.value.record;
          nextState = 'EXITED';
        }
      }
    }
    this.records.set(validatorId, nextRecord);
    const next: ValidatorBondPosition = Object.freeze({
      ...position,
      bondedQuantity: remainingBond,
      pendingUnbondQuantity: 0n,
      state: nextState === 'UNBONDED' && nextRecord.status === 'EXITED' ? 'EXITED' : nextState,
      validatorStatus: nextRecord.status,
      unbondRequestEpoch: null,
      releaseEpoch: null,
    });
    this.positions.set(validatorId, next);
    return economicsOk(next);
  }

  ingestFeeAllocation(amount: bigint, source: RewardSource = 'TRANSACTION_FEE_ALLOCATION'): EconomicsResult<bigint> {
    const policy = this.policy();
    if (!policy.reward.approvedSources.includes(source)) {
      return economicsErr('HIDDEN_INFLATION_FORBIDDEN', 'reward source is not monetary-policy approved');
    }
    if (amount < 0n) {
      return economicsErr('HIDDEN_INFLATION_FORBIDDEN', 'negative reward credit is forbidden');
    }
    const next = this.rewardPool + amount;
    if (next > MAX_ECONOMIC_UNITS) {
      return economicsErr('REWARD_OVERFLOW', 'reward pool would overflow');
    }
    this.rewardPool = next;
    return economicsOk(this.rewardPool);
  }

  recordParticipation(record: ParticipationRecord): EconomicsResult<ParticipationRecord> {
    const policy = this.policy(record.epoch);
    if (record.policyVersion !== policy.version) {
      return economicsErr('WRONG_POLICY_VERSION', 'participation must cite the policy active in that epoch');
    }
    if (this.participation.has(record.entitlementId) || this.paidEntitlements.has(record.entitlementId)) {
      return economicsErr('DUPLICATE_REWARD', 'participation entitlement already recorded');
    }
    this.participation.set(record.entitlementId, record);
    return economicsOk(record);
  }

  settleEpochRewards(epoch: bigint, source: RewardSource = 'TRANSACTION_FEE_ALLOCATION'): EconomicsResult<readonly ValidatorRewardReceipt[]> {
    const policy = this.policy(epoch);
    const records = [...this.participation.values()].filter((row) => row.epoch === epoch);
    const weights = records.map((row) => ({ row, weight: rewardWeight(row, policy) }));
    const totalWeight = weights.reduce((sum, row) => sum + row.weight, 0n);
    const pool = this.rewardPool;
    const receipts: ValidatorRewardReceipt[] = [];
    let distributed = 0n;
    for (const { row, weight } of weights) {
      if (this.paidEntitlements.has(row.entitlementId)) {
        return economicsErr('DUPLICATE_REWARD', `entitlement ${row.entitlementId} already paid`);
      }
      const product = checkedMul(pool, weight);
      if (product === null) {
        return economicsErr('REWARD_OVERFLOW', 'reward product exceeds governed maximum');
      }
      const entitled = totalWeight === 0n ? 0n : product / totalWeight;
      distributed += entitled;
      const receipt: ValidatorRewardReceipt = Object.freeze({
        receiptId: `rr_${++this.receiptSeq}`,
        entitlementId: row.entitlementId,
        validatorId: row.validatorId,
        epoch,
        height: this.height,
        asset: policy.bond.bondAsset,
        source,
        entitled,
        paid: entitled,
        policyVersion: policy.version,
      });
      this.paidEntitlements.add(row.entitlementId);
      this.rewardReceipts.push(receipt);
      receipts.push(receipt);
      const position = this.positions.get(row.validatorId);
      if (position) {
        this.positions.set(row.validatorId, Object.freeze({
          ...position,
          rewardQuantity: position.rewardQuantity + entitled,
        }));
      }
    }
    const remainder = pool - distributed;
    if (remainder < 0n) {
      return economicsErr('REWARD_OVERFLOW', 'distributed rewards exceeded the pool');
    }
    if (policy.reward.remainderDestination === 'NETWORK_SINK') {
      this.remainderSink += remainder;
    } else {
      this.rewardPool = remainder;
    }
    if (policy.reward.remainderDestination === 'NETWORK_SINK') {
      this.rewardPool = 0n;
    }
    this.entitledTotal += distributed;
    this.paidTotal += distributed;
    return economicsOk(Object.freeze(receipts));
  }

  applyPenalty(evidence: ProtocolEvidence): EconomicsResult<ValidatorPenaltyReceipt> {
    const verified = verifyProtocolEvidence(evidence);
    if (!verified.ok) {
      return verified;
    }
    if (this.executedEvidence.has(evidence.evidenceId)) {
      return economicsErr('DUPLICATE_PENALTY', 'canonical evidence id already executed a penalty');
    }
    const position = this.positions.get(evidence.validatorId);
    const record = this.records.get(evidence.validatorId);
    if (!position || !record) {
      return economicsErr('VALIDATOR_NOT_FOUND', `unknown validator ${evidence.validatorId}`);
    }
    const domain = this.accountDomains.get(evidence.validatorId);
    if (domain && domain !== 'VALIDATOR_BOND' && domain !== 'VALIDATOR_REWARD') {
      return economicsErr('CUSTOMER_ASSET_ISOLATION', 'penalty target is outside the validator economic domain');
    }
    const policy = this.policy();
    const rule = policy.penalty.rules.find((row) => row.violationClass === evidence.violationClass);
    if (!rule) {
      return economicsErr('INVALID_EVIDENCE', 'no penalty rule for this violation class');
    }
    const bondBase = position.activeLockedQuantity + position.pendingUnbondQuantity;
    const product = checkedMul(bondBase, rule.bondImpactBps);
    if (product === null) {
      return economicsErr('REWARD_OVERFLOW', 'penalty product exceeds governed maximum');
    }
    const bondImpact = product / BASIS_POINTS;
    const rewardImpact = rule.rewardForfeit ? position.rewardQuantity : 0n;
    let nextRecord = record;
    let nextState = position.state;
    if (rule.jail && (record.status === 'ACTIVE' || record.status === 'BONDED' || record.status === 'PENDING_ACTIVATION' || record.status === 'PENDING_EXIT')) {
      const jailed = transitionValidator(record, 'JAILED', this.height, this.epoch, '2026-08-17T00:00:00.000Z');
      if (jailed.ok) {
        nextRecord = jailed.value.record;
        nextState = 'JAILED';
      }
    }
    if (rule.tombstone) {
      const from = nextRecord.status === 'JAILED'
        ? { ok: true as const, value: { record: nextRecord } }
        : transitionValidator(nextRecord, 'JAILED', this.height, this.epoch, '2026-08-17T00:00:00.000Z');
      if (from.ok) {
        const tombstoned = transitionValidator(from.value.record, 'TOMBSTONED', this.height, this.epoch, '2026-08-17T00:00:00.000Z');
        if (tombstoned.ok) {
          nextRecord = tombstoned.value.record;
          nextState = 'TOMBSTONED';
        }
      }
    }
    this.records.set(evidence.validatorId, nextRecord);
    const nextLocked = position.activeLockedQuantity > bondImpact
      ? position.activeLockedQuantity - bondImpact
      : 0n;
    const appliedFromLocked = position.activeLockedQuantity - nextLocked;
    const remainingImpact = bondImpact - appliedFromLocked;
    const nextPending = position.pendingUnbondQuantity > remainingImpact
      ? position.pendingUnbondQuantity - remainingImpact
      : 0n;
    const next: ValidatorBondPosition = Object.freeze({
      ...position,
      bondedQuantity: position.bondedQuantity - bondImpact,
      activeLockedQuantity: nextLocked,
      pendingUnbondQuantity: nextPending,
      rewardQuantity: position.rewardQuantity - rewardImpact,
      penaltyQuantity: position.penaltyQuantity + bondImpact,
      state: nextState,
      validatorStatus: nextRecord.status,
      jailEpoch: nextState === 'JAILED' || nextState === 'TOMBSTONED' ? this.epoch : position.jailEpoch,
    });
    this.positions.set(evidence.validatorId, next);
    this.executedEvidence.add(evidence.evidenceId);
    this.penalizedTotal += bondImpact;
    const receipt: ValidatorPenaltyReceipt = Object.freeze({
      receiptId: `pr_${++this.receiptSeq}`,
      evidenceId: evidence.evidenceId,
      validatorId: evidence.validatorId,
      violationClass: evidence.violationClass,
      epoch: this.epoch,
      height: this.height,
      bondImpact,
      rewardImpact,
      jailed: nextState === 'JAILED',
      tombstoned: nextState === 'TOMBSTONED',
      policyVersion: policy.version,
    });
    this.penaltyReceipts.push(receipt);
    const pending = this.pendingEvidence.get(evidence.validatorId) ?? [];
    this.pendingEvidence.set(evidence.validatorId, pending.filter((id) => id !== evidence.evidenceId));
    return economicsOk(receipt);
  }

  queueEvidence(validatorId: string, evidenceId: string): void {
    const pending = this.pendingEvidence.get(validatorId) ?? [];
    this.pendingEvidence.set(validatorId, [...pending, evidenceId]);
  }

  debitCustomer(accountId: string, quantity: bigint): EconomicsResult<never> {
    const domain = this.accountDomains.get(accountId);
    if (!domain || domain === 'VALIDATOR_BOND' || domain === 'VALIDATOR_REWARD') {
      return economicsErr('CUSTOMER_ASSET_ISOLATION', 'refusing debit outside an isolated customer domain check');
    }
    return economicsErr(
      'CUSTOMER_ASSET_ISOLATION',
      `validator penalties cannot debit ${domain} account ${accountId} for ${quantity.toString()}`,
    );
  }

  attemptDelegation(): EconomicsResult<never> {
    return economicsErr('PUBLIC_DELEGATION_FORBIDDEN', 'public delegated staking is not part of this architecture');
  }

  attemptCoinEqualsVote(): EconomicsResult<never> {
    return economicsErr('COIN_EQUALS_VOTE_FORBIDDEN', 'bond eligibility is distinct from voting power');
  }

  authorizePolicy(next: ValidatorEconomicPolicy, actor: PolicyActor): EconomicsResult<ValidatorEconomicPolicy> {
    const authorized = authorizePolicyUpdate(this.policy(), next, actor);
    if (!authorized.ok) {
      return authorized;
    }
    this.history.push(authorized.value);
    return authorized;
  }

  getBond(validatorId: string): ValidatorBondPosition | undefined {
    return this.positions.get(validatorId);
  }

  getValidatorEconomicPolicy(epoch = this.epoch): ValidatorEconomicPolicy {
    return this.policy(epoch);
  }

  getValidatorRewardSummary(validatorId: string): PublicRewardSummary {
    const position = this.positions.get(validatorId);
    const pending = [...this.participation.values()]
      .filter((row) => row.validatorId === validatorId && !this.paidEntitlements.has(row.entitlementId))
      .length;
    return Object.freeze({
      validatorId,
      paid: (position?.rewardQuantity ?? 0n).toString(),
      pending: pending.toString(),
      policyVersion: this.policy().version,
    });
  }

  getValidatorPublicPenalties(validatorId: string): readonly PublicPenaltyRecord[] {
    return Object.freeze(
      this.penaltyReceipts
        .filter((row) => row.validatorId === validatorId)
        .map((row) =>
          Object.freeze({
            evidenceId: row.evidenceId,
            violationClass: row.violationClass,
            bondImpact: row.bondImpact.toString(),
            jailed: row.jailed,
            tombstoned: row.tombstoned,
            policyVersion: row.policyVersion,
          }),
        ),
    );
  }

  getValidatorUnbondStatus(validatorId: string): PublicBondView['unbondStatus'] {
    const position = this.positions.get(validatorId);
    return Object.freeze({
      pending: (position?.pendingUnbondQuantity ?? 0n).toString(),
      releaseEpoch: position?.releaseEpoch?.toString() ?? null,
    });
  }

  publicBondView(validatorId: string): PublicBondView | undefined {
    const position = this.positions.get(validatorId);
    if (!position) {
      return undefined;
    }
    return Object.freeze({
      validatorId,
      bondState: position.state,
      bondAsset: position.bondAsset,
      bondedQuantity: position.bondedQuantity.toString(),
      policyVersion: position.policyVersion,
      jailStatus: position.state === 'JAILED' ? 'JAILED' : null,
      tombstone: position.state === 'TOMBSTONED',
      unbondStatus: this.getValidatorUnbondStatus(validatorId),
    });
  }

  reconcile(): ValidatorEconomicsReconciliation {
    let locks = 0n;
    let pending = 0n;
    for (const position of this.positions.values()) {
      locks += position.activeLockedQuantity;
      pending += position.pendingUnbondQuantity;
    }
    let available = 0n;
    for (const quantity of this.available.values()) {
      available += quantity;
    }
    const issued = [...this.issued.values()].reduce((sum, row) => sum + row, 0n);
    const lockedAndPending = locks + pending;
    const balanced = issued === available + lockedAndPending + this.penalizedTotal;
    return Object.freeze({
      epoch: this.epoch,
      bondLocks: locks,
      pendingUnbond: pending,
      rewardPool: this.rewardPool,
      rewardEntitlements: this.entitledTotal,
      paidRewards: this.paidTotal,
      remainder: this.remainderSink,
      penalties: this.penalizedTotal,
      supplyImpact: Object.freeze({
        issuedToBondDomain: issued,
        locked: locks,
        released: this.releasedTotal,
        penalized: this.penalizedTotal,
        available,
      }),
      balanced,
      balancingEntries: false,
      notes: balanced
        ? 'bond-domain supply equals available + locked + pending + penalized. No balancing entries.'
        : 'reconciliation mismatch recorded; no balancing entry was invented.',
    });
  }

  metrics(): EconomicSecurityMetrics {
    const positions = [...this.positions.values()];
    const totalBonded = positions.reduce((sum, row) => sum + row.bondedQuantity, 0n);
    const largestBond = positions.reduce((max, row) => (row.bondedQuantity > max ? row.bondedQuantity : max), 0n);
    const records = [...this.records.values()];
    const totalPower = records.reduce((sum, row) => sum + row.votingPower, 0n);
    const largestPower = records.reduce((max, row) => (row.votingPower > max ? row.votingPower : max), 0n);
    const byOperator = new Map<string, number>();
    for (const row of records) {
      byOperator.set(row.operatorActorId, (byOperator.get(row.operatorActorId) ?? 0) + 1);
    }
    const largestOperator = [...byOperator.values()].reduce((max, count) => Math.max(max, count), 0);
    return Object.freeze({
      totalBondedQuantity: totalBonded,
      bondConcentration: Object.freeze({ largest: largestBond, total: totalBonded }),
      rewardDistribution: Object.freeze(
        positions.map((row) => Object.freeze({ validatorId: row.validatorId, paid: row.rewardQuantity })),
      ),
      penaltyExposure: this.penalizedTotal,
      bondAtRisk: totalBonded,
      votingPowerConcentration: Object.freeze({ largest: largestPower, total: totalPower }),
      operatorConcentration: Object.freeze({
        largestOperatorValidators: largestOperator,
        validatorCount: records.length,
      }),
      attackCostProxy: Object.freeze({
        assumptions: 'Proxy equals currently bonded quantity under the active fixture policy. Not a market price and not guaranteed economic security.',
        bondedQuantityAtRisk: totalBonded,
        guaranteedEconomicSecurity: false,
      }),
    });
  }

  customerBalance(accountId: string): bigint {
    return this.customerBalances.get(accountId) ?? 0n;
  }

  rewardReceiptsView(): readonly ValidatorRewardReceipt[] {
    return this.rewardReceipts;
  }

  penaltyReceiptsView(): readonly ValidatorPenaltyReceipt[] {
    return this.penaltyReceipts;
  }
}
