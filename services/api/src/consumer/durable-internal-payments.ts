import { asAccountId } from '@solstice/domain';
import { Money } from '@solstice/money';
import { ACTION_TYPES, asIntentId, type InternalTransferIntent } from '@solstice/permissions';

import type { DurableSimulationRuntime } from '../../../accounts/src/product-durable-adapters.ts';
import {
  listProductInternalPayments,
  loadProductInternalPayment,
  loadProductInternalPaymentByIdempotency,
  persistProductInternalPayment,
} from '../../../accounts/src/product-durable-adapters.ts';
import type { BffPrincipal } from './ports.ts';

export type DurableInternalTransferInput = {
  readonly sourceAccountId: string;
  readonly destinationAccountId: string;
  readonly amountMinorUnits: string;
  readonly currency: string;
  readonly idempotencyKey: string;
  readonly paymentId?: string;
  readonly purpose?: string;
  readonly reference?: string;
};

export type DurableInternalTransferOutcome =
  | { readonly outcome: 'OK'; readonly value: Readonly<Record<string, unknown>>; readonly replay: boolean }
  | { readonly outcome: 'REJECTED'; readonly code: string; readonly message: string };

/**
 * Hosted internal-sandbox payment surface for same-owner account transfers.
 *
 * The canonical Ledger remains the balance/amount authority. This adapter only
 * persists the customer-facing payment resource after DurableSimulationRuntime
 * has accepted and durably posted the INTERNAL_TRANSFER journal.
 */
export class DurableInternalPaymentSurface {
  private readonly durable: DurableSimulationRuntime;

  constructor(durable: DurableSimulationRuntime) {
    this.durable = durable;
  }

  async create(
    principal: BffPrincipal,
    input: DurableInternalTransferInput,
  ): Promise<DurableInternalTransferOutcome> {
    const prior = await loadProductInternalPaymentByIdempotency(
      this.durable.session.pools.customer,
      input.idempotencyKey,
    );
    if (prior) {
      if (
        prior.customerId !== principal.customerId ||
        prior.sourceAccountId !== input.sourceAccountId ||
        prior.destinationAccountId !== input.destinationAccountId ||
        String(prior.body.amountMinorUnits ?? '') !== input.amountMinorUnits ||
        String(prior.body.currency ?? '') !== input.currency
      ) {
        return {
          outcome: 'REJECTED',
          code: 'IDEMPOTENCY_CONFLICT',
          message: 'idempotency key is already bound to a different transfer',
        };
      }
      return { outcome: 'OK', value: prior.body, replay: true };
    }

    const source = this.durable.runtime.accounts.get(asAccountId(input.sourceAccountId));
    const destination = this.durable.runtime.accounts.get(asAccountId(input.destinationAccountId));
    if (!source || !destination) {
      return { outcome: 'REJECTED', code: 'ACCOUNT_NOT_FOUND', message: 'account does not exist' };
    }
    if (source.ownerId !== principal.customerId || destination.ownerId !== principal.customerId) {
      return { outcome: 'REJECTED', code: 'RESOURCE_NOT_OWNED', message: 'transfer accounts must belong to the authenticated customer' };
    }
    if (source.currency !== input.currency || destination.currency !== input.currency) {
      return { outcome: 'REJECTED', code: 'CURRENCY_MISMATCH', message: 'internal transfer requires matching account and request currency' };
    }

    let amount: Money;
    try {
      amount = Money.fromMinorUnitsString(input.amountMinorUnits, input.currency);
    } catch {
      return { outcome: 'REJECTED', code: 'INVALID_AMOUNT', message: 'amount must be integer minor units in a valid currency' };
    }
    if (!amount.isPositive()) {
      return { outcome: 'REJECTED', code: 'INVALID_AMOUNT', message: 'transfer amount must be positive' };
    }

    const requestedAt = this.durable.runtime.clock.now();
    const intent: InternalTransferIntent = Object.freeze({
      id: asIntentId(`consumer_transfer_${input.idempotencyKey}`),
      actionType: ACTION_TYPES.INTERNAL_TRANSFER,
      idempotencyKey: input.idempotencyKey,
      actorId: principal.actorId,
      requestedAt,
      purpose: 'CUSTOMER_TRANSFER',
      payload: Object.freeze({
        sourceAccountId: source.id,
        destinationAccountId: destination.id,
        amount,
      }),
    });

    const posted = await this.durable.postTransfer(intent);
    if (posted.outcome !== 'POSTED') {
      return {
        outcome: 'REJECTED',
        code: posted.outcome === 'REJECTED' ? posted.code : 'KERNEL_REFUSED',
        message: posted.outcome === 'REJECTED' ? posted.message : 'Compliance Kernel refused the transfer',
      };
    }

    const paymentId = input.paymentId?.trim() || `pay_${posted.journal.id}`;
    const body = Object.freeze({
      paymentId,
      payerId: principal.customerId,
      sourceAccountId: source.id,
      beneficiaryId: null,
      destination: Object.freeze({
        type: 'OWN_ACCOUNT',
        accountId: destination.id,
        displayHint: destination.id,
      }),
      amount: Object.freeze({ minorUnits: input.amountMinorUnits, currency: input.currency }),
      amountMinorUnits: input.amountMinorUnits,
      destinationAmount: Object.freeze({ minorUnits: input.amountMinorUnits, currency: input.currency }),
      currency: input.currency,
      paymentType: 'ACCOUNT_TO_ACCOUNT',
      railPreference: 'LEDGER_INTERNAL',
      purpose: input.purpose ?? 'Internal transfer',
      reference: input.reference ?? '',
      fees: Object.freeze([]),
      fx: null,
      status: 'SETTLED',
      createdAt: requestedAt,
      expiresAt: null,
      providerReference: null,
      idempotencyKey: input.idempotencyKey,
      approvalId: null,
      workflowId: null,
      journalId: posted.journal.id,
      productionMoneyMovement: false,
    });

    await persistProductInternalPayment(this.durable.session.pools.customer, {
      paymentId,
      customerId: principal.customerId,
      sourceAccountId: source.id,
      destinationAccountId: destination.id,
      idempotencyKey: input.idempotencyKey,
      journalId: posted.journal.id,
      status: 'SETTLED',
      body,
      createdAt: requestedAt,
      updatedAt: requestedAt,
    });

    return { outcome: 'OK', value: body, replay: posted.replay };
  }

  async list(principal: BffPrincipal): Promise<readonly Readonly<Record<string, unknown>>[]> {
    const rows = await listProductInternalPayments(
      this.durable.session.pools.customer,
      principal.customerId,
    );
    return Object.freeze(rows.map((row) => row.body));
  }

  async get(
    principal: BffPrincipal,
    paymentId: string,
  ): Promise<Readonly<Record<string, unknown>> | null> {
    const row = await loadProductInternalPayment(
      this.durable.session.pools.customer,
      principal.customerId,
      paymentId,
    );
    return row?.body ?? null;
  }
}
