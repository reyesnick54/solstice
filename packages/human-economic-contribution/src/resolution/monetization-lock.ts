import { asUtcInstant, type UtcInstant } from '../../../domain/src/time.ts';
import { consumptionCommitmentOf, monetizationKeyOf } from './ids.ts';
import type {
  ContributionResolutionFingerprint,
  HumanEconomicClaimId,
  MonetizationConsumptionCommitment,
  MonetizationContextId,
  MonetizationLock,
  MonetizationLockStatus,
} from './types.ts';

export function emptyMonetizationLock(now: UtcInstant = asUtcInstant(new Date().toISOString())): MonetizationLock {
  return Object.freeze({
    status: 'UNMONETIZED',
    contextId: null,
    consumptionCommitment: null,
    replayKey: null,
    updatedAtUtc: now,
  });
}

function transition(
  lock: MonetizationLock,
  status: MonetizationLockStatus,
  now: UtcInstant,
  extras?: Partial<Pick<MonetizationLock, 'contextId' | 'consumptionCommitment' | 'replayKey'>>,
): MonetizationLock {
  return Object.freeze({
    status,
    contextId: extras?.contextId ?? lock.contextId,
    consumptionCommitment: extras?.consumptionCommitment ?? lock.consumptionCommitment,
    replayKey: extras?.replayKey ?? lock.replayKey,
    updatedAtUtc: now,
  });
}

export type MonetizationTransitionResult =
  | { readonly ok: true; readonly lock: MonetizationLock }
  | { readonly ok: false; readonly code: string; readonly message: string };

/**
 * Wave 3-compatible monetization lock for human economic claims.
 * One claim cannot be monetized repeatedly through new wallet, API request,
 * evidence bundle, attestation combination, proposal, restart, or validator.
 */
export class HumanContributionMonetizationStore {
  private readonly consumedKeys = new Set<string>();
  private readonly claimLocks = new Map<HumanEconomicClaimId, MonetizationLock>();

  getLock(claimId: HumanEconomicClaimId): MonetizationLock {
    return this.claimLocks.get(claimId) ?? emptyMonetizationLock();
  }

  propose(claimId: HumanEconomicClaimId, contextId: MonetizationContextId, now: UtcInstant): MonetizationTransitionResult {
    const lock = this.getLock(claimId);
    if (lock.status !== 'UNMONETIZED' && lock.status !== 'REJECTED') {
      return { ok: false, code: 'INVALID_LOCK_TRANSITION', message: `Cannot propose from ${lock.status}` };
    }
    const next = transition(lock, 'PROPOSED', now, { contextId });
    this.claimLocks.set(claimId, next);
    return { ok: true, lock: next };
  }

  authorize(claimId: HumanEconomicClaimId, contextId: MonetizationContextId, now: UtcInstant): MonetizationTransitionResult {
    const lock = this.getLock(claimId);
    if (lock.status !== 'PROPOSED' && lock.status !== 'UNMONETIZED') {
      return { ok: false, code: 'INVALID_LOCK_TRANSITION', message: `Cannot authorize from ${lock.status}` };
    }
    const next = transition(lock, 'AUTHORIZED', now, { contextId });
    this.claimLocks.set(claimId, next);
    return { ok: true, lock: next };
  }

  consume(input: {
    readonly claimId: HumanEconomicClaimId;
    readonly resolutionFingerprint: ContributionResolutionFingerprint;
    readonly contextId: MonetizationContextId;
    readonly replayKey?: string;
    readonly now?: UtcInstant;
  }): MonetizationTransitionResult {
    const now = input.now ?? asUtcInstant(new Date().toISOString());
    const lock = this.getLock(input.claimId);
    if (lock.status === 'CONSUMED') {
      return { ok: false, code: 'ALREADY_CONSUMED', message: 'Claim already crossed monetary boundary' };
    }
    if (lock.status !== 'AUTHORIZED' && lock.status !== 'PROPOSED') {
      return { ok: false, code: 'NOT_AUTHORIZED_FOR_CONSUMPTION', message: `Cannot consume from ${lock.status}` };
    }
    const key = monetizationKeyOf(input.resolutionFingerprint, input.contextId);
    if (this.consumedKeys.has(key)) {
      return { ok: false, code: 'DUPLICATE_MONETIZATION_KEY', message: `monetization key ${key} already consumed` };
    }
    const replayKey = input.replayKey ?? key;
    const commitment = consumptionCommitmentOf(input.resolutionFingerprint, input.contextId, replayKey);
    this.consumedKeys.add(key);
    const next = transition(lock, 'CONSUMED', now, {
      contextId: input.contextId,
      consumptionCommitment: commitment,
      replayKey,
    });
    this.claimLocks.set(input.claimId, next);
    return { ok: true, lock: next };
  }

  isConsumed(resolutionFingerprint: ContributionResolutionFingerprint, contextId: MonetizationContextId): boolean {
    return this.consumedKeys.has(monetizationKeyOf(resolutionFingerprint, contextId));
  }

  restoreConsumedKeys(keys: readonly string[]): void {
    for (const key of keys) {
      this.consumedKeys.add(key);
    }
  }

  listConsumedKeys(): readonly string[] {
    return Object.freeze([...this.consumedKeys].sort());
  }
}

export function wave3CompatibleReplayKey(
  resolutionFingerprint: ContributionResolutionFingerprint,
  authorizationId: string,
): string {
  return `${resolutionFingerprint}:${authorizationId}`;
}
