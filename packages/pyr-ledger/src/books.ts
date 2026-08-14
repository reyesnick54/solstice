import {
  asAccountId,
  err,
  ok,
  type AccountId,
  type ActionIntentId,
  type CustomerId,
  type Result,
  type UtcInstant,
} from '@solstice/domain';
import {
  assertKernelAuthorization,
  assertKernelAuthorizationAny,
  isPyrCapabilityEnabled,
  type KernelAuthorization,
} from '@solstice/kernel';
import {
  commitJournal,
  journalBalances,
  JournalStore,
  signedEffect,
  type Journal,
} from '@solstice/ledger';
import { SimulatedCustodyProvider } from '@solstice/crypto-custody';
import { PyrAmount } from './amount.ts';
import {
  freezePyrAccount,
  type PyrAccount,
  type PyrHolderClass,
} from './accounts.ts';

export type PyrBooksError =
  | { readonly code: 'UNBALANCED' }
  | { readonly code: 'COMMINGLED' }
  | { readonly code: 'TRANSFER_DISABLED'; readonly jurisdiction: string }
  | { readonly code: 'NOT_FOUND' }
  | { readonly code: 'INSUFFICIENT' }
  | { readonly code: 'ASSET_MIX' };

const PYR_JOURNAL_KINDS = [
  'OPEN_PYR_WALLET',
  'SEED_PYR',
  'SETTLE_PYR_COMPENSATION',
  'TRANSFER_PYR',
] as const;

/**
 * PYR books. Six ledger invariants apply:
 * BALANCE, IMMUTABILITY, AUTHORITY, CLASS_BRIDGE (not used to mix
 * holder classes), NO_COMMINGLING, IDEMPOTENCY (via intent keys).
 *
 * Customer PYR and Solstice corporate PYR never share a journal.
 */
export class PyrBooks {
  readonly journals = new JournalStore();
  readonly custody = new SimulatedCustodyProvider();
  readonly #accounts = new Map<string, PyrAccount>();

  getAccount(id: AccountId): PyrAccount | undefined {
    return this.#accounts.get(String(id));
  }

  listAccounts(holderClass?: PyrHolderClass): readonly PyrAccount[] {
    const all = [...this.#accounts.values()];
    return holderClass === undefined ? all : all.filter((a) => a.holderClass === holderClass);
  }

  /** @kernelGated */
  openWallet(authorization: KernelAuthorization, account: PyrAccount): PyrAccount {
    assertKernelAuthorization(authorization, 'OPEN_PYR_WALLET');
    const frozen = freezePyrAccount(account);
    this.#accounts.set(String(frozen.id), frozen);
    return frozen;
  }

  position(accountId: AccountId): PyrAmount {
    let total = PyrAmount.zero();
    for (const line of this.journals.linesForAccount(accountId)) {
      if (line.amount.currency !== 'PYR') {
        throw new Error('PYR book encountered a non-PYR line');
      }
      const signed = signedEffect(line);
      total = PyrAmount.fromMinorUnits(total.minorUnits + signed.minorUnits);
    }
    return total;
  }

  customerTotal(customerId: CustomerId): PyrAmount {
    let total = PyrAmount.zero();
    for (const account of this.#accounts.values()) {
      if (account.holderClass !== 'CUSTOMER' || account.ownerId !== customerId) continue;
      if (account.role !== 'WALLET') continue;
      total = total.add(this.position(account.id));
    }
    return total;
  }

  corporateTreasuryTotal(): PyrAmount {
    let total = PyrAmount.zero();
    for (const account of this.#accounts.values()) {
      if (account.holderClass !== 'CORPORATE' || account.role !== 'TREASURY') continue;
      total = total.add(this.position(account.id));
    }
    return total;
  }

  /**
   * Seed corporate treasury against issuance contra. Both lines CORPORATE.
   * @kernelGated
   */
  seedCorporate(
    authorization: KernelAuthorization,
    input: {
      readonly intentId: ActionIntentId;
      readonly treasuryId: AccountId;
      readonly issuanceContraId: AccountId;
      readonly amount: PyrAmount;
      readonly at: UtcInstant;
    },
  ): Result<Journal, PyrBooksError> {
    assertKernelAuthorization(authorization, 'SEED_PYR');
    return this.#postSameClass(authorization, {
      intentId: input.intentId,
      debitId: input.treasuryId,
      creditId: input.issuanceContraId,
      amount: input.amount,
      memo: 'seed corporate PYR treasury',
      at: input.at,
      expectedClass: 'CORPORATE',
    });
  }

  /**
   * Compensation: two journals, no commingling.
   * Corporate: Dr expense, Cr treasury (corporate PYR inventory down).
   * Customer: Dr wallet, Cr earnings contra (customer PYR up).
   * @kernelGated
   */
  settleCompensation(
    authorization: KernelAuthorization,
    input: {
      readonly intentId: ActionIntentId;
      readonly customerWalletId: AccountId;
      readonly customerEarningsContraId: AccountId;
      readonly corporateTreasuryId: AccountId;
      readonly corporateExpenseId: AccountId;
      readonly amount: PyrAmount;
      readonly at: UtcInstant;
      readonly settlementRef: string;
    },
  ): Result<{ readonly corporate: Journal; readonly customer: Journal }, PyrBooksError> {
    assertKernelAuthorization(authorization, 'SETTLE_PYR_COMPENSATION');
    const corporate = this.#postSameClass(authorization, {
      intentId: input.intentId,
      debitId: input.corporateExpenseId,
      creditId: input.corporateTreasuryId,
      amount: input.amount,
      memo: `pyr compensation corporate ${input.settlementRef}`,
      at: input.at,
      expectedClass: 'CORPORATE',
    });
    if (!corporate.ok) return corporate;
    const customer = this.#postSameClass(authorization, {
      intentId: input.intentId,
      debitId: input.customerWalletId,
      creditId: input.customerEarningsContraId,
      amount: input.amount,
      memo: `pyr compensation customer ${input.settlementRef}`,
      at: input.at,
      expectedClass: 'CUSTOMER',
    });
    if (!customer.ok) return customer;
    const wallet = this.getAccount(input.customerWalletId);
    if (wallet) {
      this.custody.hold(
        { accountId: String(wallet.id), holderClass: 'CUSTOMER' },
        input.amount.minorUnits,
      );
    }
    return ok({ corporate: corporate.value, customer: customer.value });
  }

  /**
   * Customer-to-customer transfer. Registry-gated: refused unless
   * TRANSFER is CONFIRMED_BY_COUNSEL and PERMITTED.
   * @kernelGated
   */
  transfer(
    authorization: KernelAuthorization,
    input: {
      readonly intentId: ActionIntentId;
      readonly fromWalletId: AccountId;
      readonly toWalletId: AccountId;
      readonly amount: PyrAmount;
      readonly at: UtcInstant;
      readonly jurisdiction: string;
    },
  ): Result<Journal, PyrBooksError> {
    assertKernelAuthorization(authorization, 'TRANSFER_PYR');
    if (!isPyrCapabilityEnabled(input.jurisdiction, 'TRANSFER')) {
      return err({ code: 'TRANSFER_DISABLED', jurisdiction: input.jurisdiction });
    }
    const from = this.getAccount(input.fromWalletId);
    const to = this.getAccount(input.toWalletId);
    if (!from || !to) return err({ code: 'NOT_FOUND' });
    if (from.holderClass !== 'CUSTOMER' || to.holderClass !== 'CUSTOMER') {
      return err({ code: 'COMMINGLED' });
    }
    if (this.position(from.id).minorUnits < input.amount.minorUnits) {
      return err({ code: 'INSUFFICIENT' });
    }
    return this.#postSameClass(authorization, {
      intentId: input.intentId,
      debitId: to.id,
      creditId: from.id,
      amount: input.amount,
      memo: 'pyr customer transfer',
      at: input.at,
      expectedClass: 'CUSTOMER',
    });
  }

  #postSameClass(
    authorization: KernelAuthorization,
    input: {
      readonly intentId: ActionIntentId;
      readonly debitId: AccountId;
      readonly creditId: AccountId;
      readonly amount: PyrAmount;
      readonly memo: string;
      readonly at: UtcInstant;
      readonly expectedClass: PyrHolderClass;
    },
  ): Result<Journal, PyrBooksError> {
    assertKernelAuthorizationAny(authorization, PYR_JOURNAL_KINDS);
    const debitAcct = this.#accounts.get(String(input.debitId));
    const creditAcct = this.#accounts.get(String(input.creditId));
    if (!debitAcct || !creditAcct) return err({ code: 'NOT_FOUND' });
    if (debitAcct.holderClass !== input.expectedClass || creditAcct.holderClass !== input.expectedClass) {
      return err({ code: 'COMMINGLED' });
    }
    if (debitAcct.holderClass !== creditAcct.holderClass) {
      return err({ code: 'COMMINGLED' });
    }
    const money = input.amount.toLedgerMoney();
    const lines = [
      { accountId: input.debitId, direction: 'DEBIT' as const, amount: money },
      { accountId: input.creditId, direction: 'CREDIT' as const, amount: money },
    ];
    const balanced = journalBalances(lines);
    if (!balanced.ok) return err({ code: 'UNBALANCED' });
    const posted = commitJournal(this.journals, authorization, {
      intentId: input.intentId,
      lines,
      memo: input.memo,
      postedAt: input.at,
    });
    if (!posted.ok) return err({ code: 'UNBALANCED' });
    return ok(posted.value);
  }
}

export function corporateAccountId(role: string): AccountId {
  return asAccountId(`pyr_corp_${role}`);
}

export function customerAccountId(customerId: CustomerId, role: string): AccountId {
  return asAccountId(`pyr_cust_${String(customerId)}_${role}`);
}
