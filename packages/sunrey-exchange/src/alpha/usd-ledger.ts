/**
 * Sandbox USD authority for Alpha Exchange USD-quoted markets.
 * Reads and moves USD only through the canonical ledger account plane.
 */

import { Money } from '../../../money/src/money.ts';
import type { FiatPort } from '../ports.ts';

export type LedgerUsdHold = {
  readonly holdId: string;
  readonly accountId: string;
  readonly minorUnits: bigint;
};

export type LedgerUsdAuthority = {
  available(accountId: string): bigint;
  reserve(accountId: string, minorUnits: bigint): { readonly ok: true; readonly hold: LedgerUsdHold } | { readonly ok: false; readonly code: string };
  release(holdId: string): void;
  transfer(input: { readonly fromAccountId: string; readonly toAccountId: string; readonly minorUnits: bigint; readonly fromHoldId: string }): void;
};

export class InMemoryLedgerUsdAuthority implements LedgerUsdAuthority {
  private readonly balances = new Map<string, bigint>();
  private readonly holds = new Map<string, LedgerUsdHold & { released: boolean }>();
  private holdSeq = 0;

  seed(accountId: string, minorUnits: bigint): void {
    this.balances.set(accountId, (this.balances.get(accountId) ?? 0n) + minorUnits);
  }

  available(accountId: string): bigint {
    return this.balances.get(accountId) ?? 0n;
  }

  reserve(accountId: string, minorUnits: bigint): { readonly ok: true; readonly hold: LedgerUsdHold } | { readonly ok: false; readonly code: string } {
    const available = this.balances.get(accountId) ?? 0n;
    if (available < minorUnits) {
      return { ok: false, code: 'INSUFFICIENT_USD' };
    }
    this.balances.set(accountId, available - minorUnits);
    this.holdSeq += 1;
    const hold: LedgerUsdHold & { released: boolean } = Object.freeze({
      holdId: `usdhold_${this.holdSeq}`,
      accountId,
      minorUnits,
      released: false,
    });
    this.holds.set(hold.holdId, hold);
    return { ok: true, hold };
  }

  release(holdId: string): void {
    const hold = this.holds.get(holdId);
    if (!hold || hold.released) {
      return;
    }
    this.balances.set(hold.accountId, (this.balances.get(hold.accountId) ?? 0n) + hold.minorUnits);
    hold.released = true;
  }

  transfer(input: { readonly fromAccountId: string; readonly toAccountId: string; readonly minorUnits: bigint; readonly fromHoldId: string }): void {
    const hold = this.holds.get(input.fromHoldId);
    if (!hold || hold.released || hold.accountId !== input.fromAccountId || hold.minorUnits < input.minorUnits) {
      throw new Error('INVALID_USD_HOLD');
    }
    if (hold.minorUnits === input.minorUnits) {
      hold.released = true;
    } else {
      const remainder = hold.minorUnits - input.minorUnits;
      hold.minorUnits = remainder;
      this.balances.set(input.fromAccountId, (this.balances.get(input.fromAccountId) ?? 0n) + remainder);
    }
    this.balances.set(input.toAccountId, (this.balances.get(input.toAccountId) ?? 0n) + input.minorUnits);
  }
}

export function ledgerUsdAuthorityFromFiatPort(fiat: FiatPort): LedgerUsdAuthority {
  return Object.freeze({
    available(accountId) {
      return fiat.available(accountId).minorUnits;
    },
    reserve(accountId, minorUnits) {
      const result = fiat.reserve(accountId, Money.fromMinorUnits(minorUnits, 'USD'), `alpha.usd.${accountId}.${minorUnits}`);
      if (!result.ok) {
        return { ok: false, code: result.error.code };
      }
      return { ok: true, hold: Object.freeze({ holdId: result.value.holdId, accountId, minorUnits }) };
    },
    release(holdId) {
      fiat.release(holdId);
    },
    transfer(input) {
      const captured = fiat.capture(input.fromHoldId, Money.fromMinorUnits(input.minorUnits, 'USD'));
      if (!captured.ok) {
        throw new Error(captured.error.code);
      }
      const moved = fiat.transfer(
        'alpha_exchange',
        input.fromAccountId,
        input.toAccountId,
        Money.fromMinorUnits(input.minorUnits, 'USD'),
        `alpha.usd.transfer.${input.fromHoldId}`,
      );
      if (!moved.ok) {
        throw new Error(moved.error.code);
      }
    },
  });
}
