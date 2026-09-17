import { randomUUID } from 'node:crypto';

import type { Clock } from '@solstice/config';
import { asCurrencyCode, asHoldId, freezeHold, err, isErr, ok, type Result } from '@solstice/domain';
import type { Ledger } from '@solstice/ledger';
import { Money } from '@solstice/money';
import {
  formatMinorUnits,
  minMinorUnits,
  parseMinorUnits,
  subtractMinorUnits,
  type GrowAllocationFailure,
  type SandboxAccountFundsPort,
  type SandboxAccountPosition,
  type SandboxCapitalReservationPort,
  type SandboxReservationRequest,
  type SandboxReservationResult,
} from '@solstice/platform';
import {
  assertSufficientAvailable,
  projectBankingPosition,
} from '../../../accounts/src/available-funds.ts';
import type { HoldStore } from '../../../accounts/src/hold-store.ts';
import type { AccountStore } from '../../../accounts/src/stores.ts';

export type GrowSandboxAllocationAdapterDeps = {
  readonly ledger: Ledger;
  readonly holds: HoldStore;
  readonly accounts: AccountStore;
  readonly clock: Clock;
};

/**
 * Canonical accounts/ledger adapter for HELIOS Grow sandbox allocation.
 * Reservations are holds only — not spend, not ledger posts, not live provider custody.
 */
export class GrowSandboxAllocationAdapter
  implements SandboxAccountFundsPort, SandboxCapitalReservationPort
{
  private readonly ledger: Ledger;
  private readonly holds: HoldStore;
  private readonly accounts: AccountStore;
  private readonly clock: Clock;

  constructor(deps: GrowSandboxAllocationAdapterDeps) {
    this.ledger = deps.ledger;
    this.holds = deps.holds;
    this.accounts = deps.accounts;
    this.clock = deps.clock;
  }

  ownsAccount(customerId: string, accountId: string): boolean {
    const account = this.accounts.get(accountId);
    return account?.ownerId === customerId;
  }

  getPosition(customerId: string, accountId: string): Result<SandboxAccountPosition, GrowAllocationFailure> {
    const account = this.accounts.get(accountId);
    if (!account) {
      return err({ code: 'ACCOUNT_NOT_FOUND', message: 'account does not exist' });
    }
    if (account.ownerId !== customerId) {
      return err({ code: 'ACCOUNT_OWNER_MISMATCH', message: 'customer does not own account' });
    }
    const now = this.clock.now();
    const position = projectBankingPosition(this.ledger, account, this.holds, now);
    if (isErr(position)) {
      return err({ code: 'INSUFFICIENT_FUNDS', message: position.error.message });
    }
    return ok(
      Object.freeze({
        accountId: account.id,
        customerId,
        currency: position.value.currency,
        ledgerBalanceMinorUnits: position.value.ledgerBalance.minorUnits.toString(),
        settledMinorUnits: position.value.settled.minorUnits.toString(),
        heldMinorUnits: position.value.held.minorUnits.toString(),
        availableMinorUnits: position.value.available.minorUnits.toString(),
        epoch: this.holds.accountEpoch(account.id),
        asOf: now,
      }),
    );
  }

  async reserve(
    request: SandboxReservationRequest,
  ): Promise<Result<SandboxReservationResult, GrowAllocationFailure>> {
    return this.holds.withAccountLock(request.accountId, async () => {
      const replay = this.holds.getByIdempotencyKey(request.idempotencyKey);
      if (replay) {
        return ok(
          Object.freeze({
            holdId: replay.id,
            reservationReference: `hold:${replay.id}`,
            reservedAmountMinorUnits: replay.amountMinorUnits.toString(),
            epoch: replay.epoch,
          }),
        );
      }

      const account = this.accounts.get(request.accountId);
      if (!account || account.ownerId !== request.customerId) {
        return err({ code: 'ACCOUNT_OWNER_MISMATCH', message: 'customer does not own account' });
      }
      const now = this.clock.now();
      const position = projectBankingPosition(this.ledger, account, this.holds, now);
      if (isErr(position)) {
        return err({ code: 'RESERVATION_FAILED', message: position.error.message });
      }
      const availableAfterRetention = subtractMinorUnits(
        position.value.available.minorUnits.toString(),
        request.liquidityRetentionMinorUnits,
      );
      if (parseMinorUnits(availableAfterRetention) <= 0n) {
        if (parseMinorUnits(position.value.available.minorUnits.toString()) <= 0n) {
          return err({
            code: 'INSUFFICIENT_FUNDS',
            message: 'request exceeds available sandbox funds after retention and ceilings',
          });
        }
        return err({
          code: 'LIQUIDITY_RETAINED',
          message: 'mandate liquidity retention leaves no allocatable sandbox cash',
        });
      }
      const acceptedMinorUnits = minMinorUnits(
        minMinorUnits(request.requestedAmountMinorUnits, request.capitalCeilingMinorUnits),
        availableAfterRetention,
      );
      if (parseMinorUnits(acceptedMinorUnits) <= 0n) {
        return err({
          code: 'INSUFFICIENT_FUNDS',
          message: 'request exceeds available sandbox funds after retention and ceilings',
        });
      }
      const amount = Money.fromMinorUnitsString(acceptedMinorUnits, request.currency);
      const enough = assertSufficientAvailable(position.value, amount);
      if (isErr(enough)) {
        return err({ code: 'INSUFFICIENT_FUNDS', message: enough.error.message });
      }
      const holdId = asHoldId(`hold_grow_${randomUUID()}`);
      const reserved = this.holds.reserve(
        freezeHold({
          id: holdId,
          accountId: account.id,
          currency: asCurrencyCode(request.currency),
          amountMinorUnits: amount.minorUnits,
          purpose: 'GROW_ALLOCATION',
          state: 'ACTIVE',
          idempotencyKey: request.idempotencyKey,
          createdAt: now,
          updatedAt: now,
          expiresAt: null,
          captureJournalId: null,
          epoch: 0,
        }),
        this.holds.accountEpoch(account.id),
      );
      if (isErr(reserved)) {
        return err({ code: 'RESERVATION_FAILED', message: reserved.error.message });
      }
      return ok(
        Object.freeze({
          holdId: reserved.value.id,
          reservationReference: `hold:${reserved.value.id}`,
          reservedAmountMinorUnits: formatMinorUnits(reserved.value.amountMinorUnits),
          epoch: reserved.value.epoch,
        }),
      );
    });
  }

  async release(holdId: string, reason: string): Promise<Result<true, GrowAllocationFailure>> {
    const released = this.holds.transition(asHoldId(holdId), 'RELEASED', this.clock.now());
    if (isErr(released)) {
      return err({ code: 'INVALID_RELEASE', message: `${released.error.message}: ${reason}` });
    }
    return ok(true);
  }
}
