import {
  asHoldId,
  canAdjustHold,
  canTransitionHold,
  freezeHold,
  isActiveHold,
  type FundsHold,
  type HoldId,
  type HoldState,
} from '../../../packages/domain/src/hold.ts';
import type { AccountId } from '../../../packages/domain/src/account.ts';
import { err, ok, type Result } from '../../../packages/domain/src/result.ts';
import type { UtcInstant } from '../../../packages/domain/src/time.ts';
import type { HoldView } from './available-funds.ts';

export type HoldStoreRejection = {
  readonly code: 'HOLD_CONFLICT' | 'HOLD_NOT_FOUND' | 'HOLD_ILLEGAL_TRANSITION' | 'HOLD_EXPIRED';
  readonly message: string;
};

/**
 * In-memory hold store with per-account epoch CAS.
 * Concurrent reservations against the same account cannot both succeed
 * when available funds cover only one of them.
 */
export class HoldStore implements HoldView {
  private readonly byId = new Map<string, FundsHold>();
  private readonly byIdempotency = new Map<string, FundsHold>();
  private readonly epochs = new Map<string, number>();
  private readonly locks = new Map<string, Promise<void>>();

  get(id: HoldId): FundsHold | undefined {
    return this.byId.get(id);
  }

  getByIdempotencyKey(key: string): FundsHold | undefined {
    return this.byIdempotency.get(key);
  }

  list(): readonly FundsHold[] {
    return [...this.byId.values()];
  }

  listByAccount(accountId: AccountId | string): readonly FundsHold[] {
    return this.list().filter((hold) => hold.accountId === accountId);
  }

  accountEpoch(accountId: string): number {
    return this.epochs.get(accountId) ?? 0;
  }

  put(hold: FundsHold): void {
    const frozen = freezeHold(hold);
    this.byId.set(frozen.id, frozen);
    this.byIdempotency.set(frozen.idempotencyKey, frozen);
  }

  hydrate(holds: readonly FundsHold[]): void {
    this.byId.clear();
    this.byIdempotency.clear();
    this.epochs.clear();
    for (const hold of holds) {
      this.put(hold);
      const current = this.epochs.get(hold.accountId) ?? 0;
      if (hold.epoch > current) {
        this.epochs.set(hold.accountId, hold.epoch);
      }
    }
  }

  /**
   * Compare-and-swap reserve. `expectedEpoch` must match the current
   * account epoch or the reservation fails. On success the epoch advances.
   */
  hydrate(holds: readonly FundsHold[]): void {
    this.byId.clear();
    this.byIdempotency.clear();
    this.epochs.clear();
    for (const hold of holds) {
      this.put(hold);
      const current = this.epochs.get(hold.accountId) ?? 0;
      if (hold.epoch > current) {
        this.epochs.set(hold.accountId, hold.epoch);
      }
    }
  }

  adjust(
    id: HoldId,
    amountMinorUnits: bigint,
    now: UtcInstant,
    expectedEpoch: number,
  ): Result<FundsHold, HoldStoreRejection> {
    const current = this.byId.get(id);
    if (!current) {
      return err({ code: 'HOLD_NOT_FOUND', message: 'hold does not exist' });
    }
    if (!canAdjustHold(current, now)) {
      return err({
        code: current.expiresAt !== null && current.expiresAt <= now ? 'HOLD_EXPIRED' : 'HOLD_ILLEGAL_TRANSITION',
        message: 'only an ACTIVE unexpired hold can be adjusted',
      });
    }
    if (this.accountEpoch(current.accountId) !== expectedEpoch) {
      return err({
        code: 'HOLD_CONFLICT',
        message: 'account reservation epoch changed; retry available-funds check',
      });
    }
    const next = freezeHold({
      ...current,
      amountMinorUnits,
      updatedAt: now,
      epoch: expectedEpoch + 1,
    });
    this.epochs.set(current.accountId, expectedEpoch + 1);
    this.put(next);
    return ok(next);
  }

  reserve(hold: FundsHold, expectedEpoch: number): Result<FundsHold, HoldStoreRejection> {
    const existing = this.byIdempotency.get(hold.idempotencyKey);
    if (existing) {
      return ok(existing);
    }
    const current = this.accountEpoch(hold.accountId);
    if (current !== expectedEpoch) {
      return err({
        code: 'HOLD_CONFLICT',
        message: 'account reservation epoch changed; retry available-funds check',
      });
    }
    const frozen = freezeHold({ ...hold, epoch: current + 1 });
    this.epochs.set(hold.accountId, current + 1);
    this.put(frozen);
    return ok(frozen);
  }

  transition(
    id: HoldId,
    to: HoldState,
    now: UtcInstant,
    captureJournalId: string | null = null,
  ): Result<FundsHold, HoldStoreRejection> {
    const current = this.byId.get(id);
    if (!current) {
      return err({ code: 'HOLD_NOT_FOUND', message: 'hold does not exist' });
    }
    if (current.state === 'ACTIVE' && current.expiresAt !== null && current.expiresAt <= now) {
      const expired = freezeHold({ ...current, state: 'EXPIRED', updatedAt: now });
      this.put(expired);
      return err({ code: 'HOLD_EXPIRED', message: 'hold has expired' });
    }
    if (!canTransitionHold(current.state, to)) {
      return err({
        code: 'HOLD_ILLEGAL_TRANSITION',
        message: `hold cannot move ${current.state} → ${to}`,
      });
    }
    const next = freezeHold({
      ...current,
      state: to,
      updatedAt: now,
      captureJournalId: to === 'CAPTURED' ? captureJournalId : current.captureJournalId,
    });
    this.put(next);
    return ok(next);
  }

  expireDue(now: UtcInstant): readonly FundsHold[] {
    const expired: FundsHold[] = [];
    for (const hold of this.list()) {
      if (hold.state === 'ACTIVE' && hold.expiresAt !== null && hold.expiresAt <= now) {
        const next = freezeHold({ ...hold, state: 'EXPIRED', updatedAt: now });
        this.put(next);
        expired.push(next);
      }
    }
    return expired;
  }

  activeFor(accountId: string, now: UtcInstant): readonly FundsHold[] {
    return this.listByAccount(accountId).filter((hold) => isActiveHold(hold, now));
  }

  /**
   * Per-account mutex for concurrent reservation attempts.
   */
  async withAccountLock<T>(accountId: string, fn: () => T | Promise<T>): Promise<T> {
    const previous = this.locks.get(accountId) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const next = previous.then(() => gate);
    this.locks.set(accountId, next);
    await previous;
    try {
      return await fn();
    } finally {
      release();
    }
  }
}

export function newHoldId(prefix: string): HoldId {
  return asHoldId(prefix);
}
