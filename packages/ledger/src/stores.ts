import {
  err,
  ok,
  type LedgerAccount,
  type AccountId,
  type Beneficiary,
  type BeneficiaryId,
  type CurrencyCode,
  type Customer,
  type CustomerId,
  type CustomerStatus,
  type Result,
  type UtcInstant,
  freezeBeneficiary,
  Money,
  transitionCustomerStatus,
} from '@solstice/domain';
import {
  assertKernelAuthorization,
  assertKernelAuthorizationAny,
  type KernelAuthorization,
} from '@solstice/kernel';
import { signedEffect, type JournalStore } from './journal.ts';

export type MixedCurrencyWithoutConversion = {
  readonly type: 'MixedCurrencyWithoutConversion';
  readonly currencies: readonly string[];
  readonly message: string;
};

export type CostAvoidedRecord = {
  readonly customerId: CustomerId;
  readonly paymentId: string;
  readonly baselineCost: Money;
  readonly actualCost: Money;
  readonly saved: Money;
  readonly kind: 'COST_AVOIDED';
  readonly recordedAt: UtcInstant;
  readonly authorizationHash: string;
};

export const PAYMENT_STATES = [
  'INITIATED',
  'SCREENING',
  'ROUTED',
  'SETTLING',
  'SETTLED',
  'FAILED',
  'RETURNED',
] as const;

export type PaymentState = (typeof PAYMENT_STATES)[number];

export type PaymentRecord = {
  readonly id: string;
  readonly intentId: string;
  readonly customerId: CustomerId;
  readonly beneficiaryId: BeneficiaryId;
  readonly state: PaymentState;
  readonly version: number;
  readonly instructedAmount: Money;
  readonly sourceAmount?: Money;
  readonly destinationAmount?: Money;
  readonly railId?: string;
  readonly routeId?: string;
  readonly idempotencyKey: string;
  readonly events: readonly PaymentEvent[];
};

export type PaymentEvent = {
  readonly version: number;
  readonly from: PaymentState | 'NONE';
  readonly to: PaymentState;
  readonly at: UtcInstant;
  readonly evidenceId: string;
};

const PAYMENT_TRANSITIONS: { readonly [S in PaymentState]: readonly PaymentState[] } = {
  INITIATED: ['SCREENING', 'FAILED'],
  SCREENING: ['ROUTED', 'FAILED'],
  ROUTED: ['SETTLING', 'FAILED'],
  SETTLING: ['SETTLED', 'FAILED'],
  SETTLED: [],
  FAILED: ['RETURNED'],
  RETURNED: [],
};

export class LedgerBooks {
  readonly journals: JournalStore;
  readonly #customers = new Map<CustomerId, Customer>();
  readonly #accounts = new Map<AccountId, LedgerAccount>();
  readonly #beneficiaries = new Map<BeneficiaryId, Beneficiary>();
  readonly #payments = new Map<string, PaymentRecord>();
  readonly #costAvoided: CostAvoidedRecord[] = [];
  readonly #idempotency = new Map<string, string>();

  constructor(journals: JournalStore) {
    this.journals = journals;
  }

  getCustomer(id: CustomerId): Customer | undefined {
    return this.#customers.get(id);
  }

  getAccount(id: AccountId): LedgerAccount | undefined {
    return this.#accounts.get(id);
  }

  listAccountsForCustomer(customerId: CustomerId): readonly Account[] {
    return [...this.#accounts.values()].filter((account) => account.ownerCustomerId === customerId);
  }

  listHouseAccounts(): readonly Account[] {
    return [...this.#accounts.values()].filter((account) => account.ownerCustomerId === 'HOUSE');
  }

  getBeneficiary(id: BeneficiaryId): Beneficiary | undefined {
    return this.#beneficiaries.get(id);
  }

  listBeneficiaries(owner: CustomerId): readonly Beneficiary[] {
    return [...this.#beneficiaries.values()].filter((row) => row.ownerCustomerId === owner);
  }

  getPayment(id: string): PaymentRecord | undefined {
    return this.#payments.get(id);
  }

  findPaymentByIdempotency(key: string): PaymentRecord | undefined {
    const id = this.#idempotency.get(key);
    return id === undefined ? undefined : this.#payments.get(id);
  }

  listCostAvoided(): readonly CostAvoidedRecord[] {
    return this.#costAvoided.slice();
  }

  /** @kernelGated */
  putCustomer(authorization: KernelAuthorization, customer: Customer): Customer {
    assertKernelAuthorization(authorization, 'CREATE_CUSTOMER');
    this.#customers.set(customer.id, customer);
    return customer;
  }

  /** @kernelGated */
  commitCustomerStatus(
    authorization: KernelAuthorization,
    customerId: CustomerId,
    to: CustomerStatus,
    occurredAt: UtcInstant,
  ): Result<Customer, { code: 'ILLEGAL_CUSTOMER_STATUS_TRANSITION' } | { code: 'NOT_FOUND' }> {
    assertKernelAuthorization(authorization, 'TRANSITION_CUSTOMER_STATUS');
    const current = this.#customers.get(customerId);
    if (!current) {
      return err({ code: 'NOT_FOUND' });
    }
    const next = transitionCustomerStatus(current, to, occurredAt);
    if (!next.ok) {
      return err({ code: 'ILLEGAL_CUSTOMER_STATUS_TRANSITION' });
    }
    this.#customers.set(customerId, next.value.customer);
    return ok(next.value.customer);
  }

  /** @kernelGated */
  putAccount(authorization: KernelAuthorization, account: LedgerAccount): LedgerAccount {
    assertKernelAuthorization(authorization, 'OPEN_ACCOUNT');
    this.#accounts.set(account.id, account);
    return account;
  }

  /** @kernelGated */
  putBeneficiary(authorization: KernelAuthorization, beneficiary: Beneficiary): Beneficiary {
    assertKernelAuthorization(authorization, 'ADD_BENEFICIARY');
    const frozen = freezeBeneficiary(beneficiary);
    this.#beneficiaries.set(frozen.id, frozen);
    return frozen;
  }

  /** @kernelGated */
  updateBeneficiary(authorization: KernelAuthorization, next: Beneficiary): Beneficiary {
    assertKernelAuthorization(authorization, 'UPDATE_BENEFICIARY');
    const frozen = freezeBeneficiary(next);
    this.#beneficiaries.set(frozen.id, frozen);
    return frozen;
  }

  /** @kernelGated */
  putPayment(authorization: KernelAuthorization, payment: PaymentRecord): PaymentRecord {
    assertKernelAuthorizationAny(authorization, ['SEND_PAYMENT']);
    const frozen = Object.freeze({
      ...payment,
      events: Object.freeze(payment.events.slice()),
    });
    this.#payments.set(frozen.id, frozen);
    this.#idempotency.set(frozen.idempotencyKey, frozen.id);
    return frozen;
  }

  /** @kernelGated */
  transitionPayment(
    authorization: KernelAuthorization,
    paymentId: string,
    to: PaymentState,
    at: UtcInstant,
    evidenceId: string,
  ): Result<PaymentRecord, { code: 'ILLEGAL_PAYMENT_TRANSITION' | 'NOT_FOUND' }> {
    assertKernelAuthorizationAny(authorization, ['SEND_PAYMENT', 'COMPENSATE_PAYMENT']);
    const current = this.#payments.get(paymentId);
    if (!current) {
      return err({ code: 'NOT_FOUND' });
    }
    if (!PAYMENT_TRANSITIONS[current.state].includes(to)) {
      return err({ code: 'ILLEGAL_PAYMENT_TRANSITION' });
    }
    const next: PaymentRecord = Object.freeze({
      ...current,
      state: to,
      version: current.version + 1,
      events: Object.freeze([
        ...current.events,
        Object.freeze({
          version: current.version + 1,
          from: current.state,
          to,
          at,
          evidenceId,
        }),
      ]),
    });
    this.#payments.set(paymentId, next);
    return ok(next);
  }

  /** @kernelGated */
  recordCostAvoided(authorization: KernelAuthorization, record: CostAvoidedRecord): CostAvoidedRecord {
    assertKernelAuthorization(authorization, 'RECORD_COST_AVOIDED');
    if (record.kind !== 'COST_AVOIDED') {
      throw new Error('Growth attribution must be COST_AVOIDED, never income');
    }
    const frozen = Object.freeze({ ...record, kind: 'COST_AVOIDED' as const });
    this.#costAvoided.push(frozen);
    return frozen;
  }

  positionForAccount(accountId: AccountId): Result<Money, MixedCurrencyWithoutConversion> {
    const account = this.#accounts.get(accountId);
    if (!account) {
      return err({
        type: 'MixedCurrencyWithoutConversion',
        currencies: [],
        message: `unknown account ${accountId}`,
      });
    }
    let total = Money.zero(account.currency);
    for (const line of this.journals.linesForAccount(accountId)) {
      if (line.amount.currency !== account.currency) {
        return err({
          type: 'MixedCurrencyWithoutConversion',
          currencies: [account.currency, line.amount.currency],
          message: 'account position cannot mix currencies',
        });
      }
      total = total.add(signedEffect(line));
    }
    return ok(total);
  }

  /**
   * Multi-currency customer balances. Each currency is a distinct position.
   * Refuses to blend without an explicit rate+timestamp (caller must convert).
   */
  positionsByCurrency(
    customerId: CustomerId,
  ): Readonly<Record<string, Money>> {
    const result: Record<string, Money> = {};
    for (const account of this.listAccountsForCustomer(customerId)) {
      const position = this.positionForAccount(account.id);
      if (!position.ok) {
        continue;
      }
      const current = result[account.currency] ?? Money.zero(account.currency);
      result[account.currency] = current.add(position.value);
    }
    return result;
  }

  blendedTotal(
    customerId: CustomerId,
    _rateAndTimestamp: undefined,
  ): Result<Money, MixedCurrencyWithoutConversion> {
    const positions = this.positionsByCurrency(customerId);
    const currencies = Object.keys(positions).filter((code) => {
      const money = positions[code];
      return money !== undefined && !money.isZero;
    });
    if (currencies.length <= 1) {
      const only = currencies[0];
      if (only === undefined) {
        return ok(Money.zero('USD' as CurrencyCode));
      }
      return ok(positions[only] ?? Money.zero(only as CurrencyCode));
    }
    return err({
      type: 'MixedCurrencyWithoutConversion',
      currencies,
      message:
        'Cannot sum mixed currencies into one figure without an explicit conversion carrying its rate and timestamp',
    });
  }
}
