import { createHash } from 'node:crypto';

import {
  asAccountId,
  asCurrencyCode,
  asLegalEntityId,
  asProductId,
  asJurisdiction,
} from '@solstice/domain';
import { LedgerInvariantError } from '@solstice/ledger';
import { Money } from '@solstice/money';
import {
  ACTION_TYPES,
  asIntentId,
  type OpenAccountIntent,
  type PostDepositIntent,
} from '@solstice/permissions';

import type { DurableSimulationRuntime } from '../../../accounts/src/product-durable-adapters.ts';
import type { BffPrincipal } from './ports.ts';

const CASH_PRODUCT_BY_CURRENCY = Object.freeze({
  USD: 'prod_demand_usd_gb',
  GBP: 'prod_demand_gbp_gb',
  EUR: 'prod_demand_eur_gb',
  SAR: 'prod_demand_sar_gb',
} as const);

type SupportedCashCurrency = keyof typeof CASH_PRODUCT_BY_CURRENCY;

export type DurableAccountCreateInput = {
  readonly accountType?: string;
  readonly currency: string;
  readonly idempotencyKey: string;
};

export type DurableSandboxFundingInput = {
  readonly accountId: string;
  readonly amountMinorUnits: string;
  readonly currency: string;
  readonly idempotencyKey: string;
};

export type DurableMoneyMutationOutcome =
  | {
      readonly outcome: 'OK';
      readonly value: Readonly<Record<string, unknown>>;
      readonly replay: boolean;
    }
  | {
      readonly outcome: 'REJECTED';
      readonly code: string;
      readonly message: string;
    };

/**
 * Hosted internal-sandbox mutations for customer cash-account opening and
 * explicit simulated funding.
 *
 * Account opening uses the authenticated customer's actor through the
 * canonical Compliance Kernel and Execution Authority path. Sandbox funding is
 * deliberately service-sponsored and uses operator_1 so a customer is never
 * granted a generic POST_DEPOSIT capability merely to operate the faucet.
 * Both paths commit through DurableSimulationRuntime and PostgreSQL; neither
 * maintains a shadow balance.
 */
export class DurableMoneyAccountMutations {
  private readonly durable: DurableSimulationRuntime;

  constructor(durable: DurableSimulationRuntime) {
    this.durable = durable;
  }

  async openCashAccount(
    principal: BffPrincipal,
    input: DurableAccountCreateInput,
  ): Promise<DurableMoneyMutationOutcome> {
    const idempotencyKey = input.idempotencyKey.trim();
    if (!idempotencyKey) {
      return rejected('IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key is required');
    }

    const currency = input.currency.trim().toUpperCase();
    if (!(currency in CASH_PRODUCT_BY_CURRENCY)) {
      return rejected('UNSUPPORTED_CURRENCY', 'cash account currency is not supported in this sandbox');
    }
    if (input.accountType && input.accountType.trim().toUpperCase() !== 'CASH') {
      return rejected('UNSUPPORTED_ACCOUNT_TYPE', 'only CASH accounts can be opened through this sandbox route');
    }

    const productId = CASH_PRODUCT_BY_CURRENCY[currency as SupportedCashCurrency];
    const stableSuffix = stableIdSuffix(idempotencyKey);
    const accountId = asAccountId(`acct_${safeIdPart(principal.customerId)}_${currency.toLowerCase()}_${stableSuffix}`);

    const existing = this.durable.runtime.accounts.get(accountId);
    if (existing) {
      if (
        existing.ownerId !== principal.customerId ||
        existing.currency !== currency ||
        existing.productId !== productId
      ) {
        return rejected('IDEMPOTENCY_CONFLICT', 'idempotency key is already bound to a different account request');
      }
      return {
        outcome: 'OK',
        replay: true,
        value: accountOpenedBody(existing.id, existing.currency, existing.productId, true),
      };
    }

    const requestedAt = this.durable.runtime.clock.now();
    const intent: OpenAccountIntent = Object.freeze({
      id: asIntentId(`consumer_open_${stableSuffix}`),
      actionType: ACTION_TYPES.OPEN_ACCOUNT,
      idempotencyKey,
      actorId: principal.actorId,
      requestedAt,
      purpose: 'CUSTOMER_ONBOARDING',
      payload: Object.freeze({
        accountId,
        ownerId: principal.customerId as never,
        productId: asProductId(productId),
        accountClass: 'DEMAND_DEPOSIT',
        legalEntityId: asLegalEntityId('le_solstice_uk_ltd'),
        jurisdiction: asJurisdiction('GB'),
        currency: asCurrencyCode(currency),
      }),
    });

    const opened = await this.durable.open(intent);
    if (opened.outcome !== 'OPENED') {
      return rejected(
        opened.outcome === 'REJECTED' ? opened.code : 'KERNEL_REFUSED',
        opened.outcome === 'REJECTED' ? opened.message : 'Compliance Kernel refused account opening',
      );
    }

    return {
      outcome: 'OK',
      replay: opened.replay,
      value: accountOpenedBody(opened.account.id, opened.account.currency, opened.account.productId, opened.replay),
    };
  }

  async fundSandboxAccount(
    principal: BffPrincipal,
    input: DurableSandboxFundingInput,
  ): Promise<DurableMoneyMutationOutcome> {
    const idempotencyKey = input.idempotencyKey.trim();
    if (!idempotencyKey) {
      return rejected('IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key is required');
    }

    const account = this.durable.runtime.accounts.get(asAccountId(input.accountId));
    if (!account) {
      return rejected('ACCOUNT_NOT_FOUND', 'account does not exist');
    }
    if (account.ownerId !== principal.customerId) {
      return rejected('RESOURCE_NOT_OWNED', 'account is not owned by the authenticated customer');
    }

    const currency = input.currency.trim().toUpperCase();
    if (account.currency !== currency) {
      return rejected('CURRENCY_MISMATCH', 'funding currency must match the destination account currency');
    }

    let amount: Money;
    try {
      amount = Money.fromMinorUnitsString(input.amountMinorUnits, currency);
    } catch {
      return rejected('INVALID_AMOUNT', 'amount must be integer minor units in a valid currency');
    }
    if (!amount.isPositive()) {
      return rejected('INVALID_AMOUNT', 'sandbox funding amount must be positive');
    }

    const requestedAt = this.durable.runtime.clock.now();
    const stableSuffix = stableIdSuffix(idempotencyKey);
    const intent: PostDepositIntent = Object.freeze({
      id: asIntentId(`consumer_sandbox_funding_${stableSuffix}`),
      actionType: ACTION_TYPES.POST_DEPOSIT,
      idempotencyKey,
      actorId: 'operator_1',
      requestedAt,
      purpose: 'CUSTOMER_FUNDING',
      payload: Object.freeze({
        accountId: account.id,
        amount,
      }),
    });

    try {
      const posted = await this.durable.postDeposit(intent);
      if (posted.outcome !== 'POSTED') {
        return rejected(
          posted.outcome === 'REJECTED' ? posted.code : 'KERNEL_REFUSED',
          posted.outcome === 'REJECTED' ? posted.message : 'Compliance Kernel refused sandbox funding',
        );
      }

      return {
        outcome: 'OK',
        replay: posted.replay,
        value: Object.freeze({
          schema: 'sunrey.sandbox-funding.v1',
          accountId: account.id,
          amount: Object.freeze({ minorUnits: input.amountMinorUnits, currency }),
          journalId: posted.journal.id,
          status: 'POSTED',
          simulation: true,
          productionMoneyMovement: false,
          replay: posted.replay,
        }),
      };
    } catch (error) {
      if (error instanceof LedgerInvariantError) {
        return rejected('IDEMPOTENCY_CONFLICT', 'idempotency key is already bound to different funding details');
      }
      throw error;
    }
  }
}

function accountOpenedBody(accountId: string, currency: string, productId: string, replay: boolean) {
  return Object.freeze({
    schema: 'sunrey.consumer.account-created.v1',
    accountId,
    accountType: 'CASH',
    currency,
    productId,
    status: 'ACTIVE',
    simulation: true,
    productionBanking: false,
    replay,
  });
}

function stableIdSuffix(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 16);
}

function safeIdPart(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 48);
}

function rejected(code: string, message: string): DurableMoneyMutationOutcome {
  return Object.freeze({ outcome: 'REJECTED', code, message });
}
