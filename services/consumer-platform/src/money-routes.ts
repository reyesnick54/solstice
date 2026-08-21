import type { IncomingMessage, ServerResponse } from 'node:http';

import { asAccountId } from '../../../packages/domain/src/account.ts';
import { asCurrencyCode } from '../../../packages/domain/src/currency.ts';
import { asCustomerId } from '../../../packages/domain/src/customer.ts';
import { Money } from '../../../packages/money/src/money.ts';
import { asIntentId } from '../../../packages/permissions/src/action-intent.ts';
import { ACTION_TYPES } from '../../../packages/permissions/src/action-types.ts';
import { newSecurityToken } from '../../../packages/security/src/random.ts';
import { SIMULATION_US_VIRTUAL_PROGRAM } from '../../../packages/cards/src/program.ts';
import type { ConsumerErrorCode } from '../../../packages/sunrey-sdk/src/consumer-platform/index.ts';
import type { SimulationRuntime } from '../../accounts/src/runtime.ts';
import type { ConsumerMoneySurface } from './money-surface.ts';

export const MONEY_ROUTES = [
  'POST /v1/consumer/transfers',
  'GET /v1/consumer/recipients',
  'POST /v1/consumer/recipients',
  'POST /v1/consumer/payments/quotes',
  'POST /v1/consumer/payments',
  'GET /v1/consumer/payments/{paymentId}',
  'POST /v1/consumer/fx/quotes',
  'POST /v1/consumer/fx/quotes/{quoteId}/accept',
  'POST /v1/consumer/fx/quotes/{quoteId}/execute',
  'GET /v1/consumer/cards',
  'POST /v1/consumer/cards',
  'POST /v1/consumer/cards/{cardId}/freeze',
  'POST /v1/consumer/cards/{cardId}/unfreeze',
] as const;

type MoneyRouteDeps = {
  readonly runtime: SimulationRuntime;
  readonly money: ConsumerMoneySurface;
  readonly sendJson: (res: ServerResponse, status: number, body: unknown, requestId: string) => void;
  readonly fail: (
    res: ServerResponse,
    status: number,
    requestId: string,
    code: ConsumerErrorCode,
    message: string,
    extras?: {
      readonly retryable?: boolean;
      readonly user_action_required?: boolean;
      readonly details?: Readonly<Record<string, string>>;
    },
  ) => void;
  readonly readBody: (req: IncomingMessage, limit: number) => Promise<string>;
  readonly parseJsonBody: (raw: string) => Record<string, unknown>;
  readonly asString: (value: unknown) => string | undefined;
  readonly recordActivity: (actorId: string, eventType: string, summary: string) => void;
};

function moneyFromBody(body: Record<string, unknown>, fallbackCurrency: string): Money | null {
  const raw = body.amount as Record<string, unknown> | undefined;
  const minor = typeof raw?.minor_units === 'string' ? raw.minor_units : typeof body.minor_units === 'string' ? body.minor_units : undefined;
  const currency = typeof raw?.currency === 'string' ? raw.currency : typeof body.currency === 'string' ? body.currency : fallbackCurrency;
  if (!minor) {
    return null;
  }
  return Money.fromMinorUnits(BigInt(minor), currency);
}

export async function handleConsumerMoneyRoute(
  deps: MoneyRouteDeps,
  input: {
    readonly method: string;
    readonly path: string;
    readonly actorId: string;
    readonly requestId: string;
    readonly req: IncomingMessage;
    readonly res: ServerResponse;
  },
): Promise<boolean> {
  const { runtime, money, sendJson, fail, readBody, parseJsonBody, asString, recordActivity } = deps;
  const facts = runtime.identity.service.identityFactsFor(input.actorId);
  const customerId = facts.customerId;
  const accounts = runtime.accountsService.listAccounts().filter((account) => customerId && account.ownerId === customerId);
  const primary = accounts[0];

  if (input.path === '/v1/consumer/transfers' && input.method === 'POST') {
    if (!facts.authorizedCapabilities.includes('TRANSFER_REQUEST')) {
      fail(input.res, 403, input.requestId, 'CAPABILITY_DENIED', 'TRANSFER_REQUEST is not granted', { user_action_required: true });
      return true;
    }
    const body = parseJsonBody(await readBody(input.req, 32_768));
    const amount = moneyFromBody(body, primary?.currency ?? 'USD');
    const source = asString(body.source_account_id);
    const destination = asString(body.destination_account_id);
    const idempotencyKey = asString(body.idempotency_key) ?? `xfer_${newSecurityToken()}`;
    if (!amount || !source || !destination) {
      fail(input.res, 400, input.requestId, 'VALIDATION_FAILED', 'source, destination, and amount are required', { user_action_required: true });
      return true;
    }
    const outcome = runtime.money.transfer({
      id: asIntentId(`xfer_${idempotencyKey}`),
      actionType: ACTION_TYPES.INTERNAL_TRANSFER,
      idempotencyKey,
      actorId: input.actorId,
      requestedAt: runtime.clock.now(),
      purpose: 'CUSTOMER_TRANSFER',
      payload: {
        sourceAccountId: asAccountId(source),
        destinationAccountId: asAccountId(destination),
        amount,
      },
    });
    if (outcome.outcome === 'KERNEL_REFUSED') {
      fail(input.res, 403, input.requestId, 'KERNEL_REFUSED', `Kernel ${outcome.decision.status}`);
      return true;
    }
    if (outcome.outcome !== 'POSTED') {
      fail(input.res, 409, input.requestId, 'RESOURCE_CONFLICT', outcome.message);
      return true;
    }
    recordActivity(input.actorId, 'InternalTransferPosted', 'Internal transfer posted');
    sendJson(input.res, 200, {
      transfer_id: outcome.journal.id,
      state: 'ALLOW',
      source_account_id: source,
      destination_account_id: destination,
      amount: { minor_units: amount.minorUnits.toString(), currency: amount.currency },
      message: 'Transfer posted after Kernel ALLOW',
    }, input.requestId);
    return true;
  }

  if (input.path === '/v1/consumer/recipients' && input.method === 'GET') {
    if (!customerId) {
      sendJson(input.res, 200, { items: [] }, input.requestId);
      return true;
    }
    const items = money.payments.getStore().listBeneficiaries(asCustomerId(customerId)).map((row) => ({
      recipient_id: row.beneficiaryId,
      legal_name: row.legalName,
      currency: row.currency,
      destination_country: row.destinationCountry,
      status: row.status,
    }));
    sendJson(input.res, 200, { items }, input.requestId);
    return true;
  }

  if (input.path === '/v1/consumer/recipients' && input.method === 'POST') {
    if (!facts.authorizedCapabilities.includes('MANAGE_BENEFICIARY') || !customerId || !primary) {
      fail(input.res, 403, input.requestId, 'CAPABILITY_DENIED', 'MANAGE_BENEFICIARY is not granted', { user_action_required: true });
      return true;
    }
    const body = parseJsonBody(await readBody(input.req, 32_768));
    const idempotencyKey = asString(body.idempotency_key) ?? `ben_${newSecurityToken()}`;
    const outcome = money.payments.createBeneficiary({
      id: asIntentId(`ben_${idempotencyKey}`),
      actionType: ACTION_TYPES.CREATE_BENEFICIARY,
      idempotencyKey,
      actorId: input.actorId,
      requestedAt: runtime.clock.now(),
      purpose: 'CUSTOMER_CROSS_BORDER_PAYMENT',
      payload: {
        beneficiaryId: asString(body.recipient_id) ?? `ben_${newSecurityToken()}`,
        ownerId: asCustomerId(customerId),
        accountId: primary.id,
        kind: 'PERSON',
        destinationCountry: asString(body.destination_country) ?? 'SA',
        currency: asCurrencyCode(asString(body.currency) ?? 'SAR'),
        legalName: asString(body.legal_name) ?? 'Sandbox Recipient',
        accountCoordinate: {
          scheme: asString(body.scheme) ?? 'SA_IBAN',
          value: asString(body.account_coordinate) ?? 'SA0380000000608010167519',
        },
      },
    });
    if (outcome.outcome !== 'OK') {
      fail(input.res, outcome.outcome === 'KERNEL_REFUSED' ? 403 : 409, input.requestId, outcome.outcome === 'KERNEL_REFUSED' ? 'KERNEL_REFUSED' : 'RESOURCE_CONFLICT', outcome.outcome === 'KERNEL_REFUSED' ? `Kernel ${outcome.decision.status}` : outcome.message);
      return true;
    }
    recordActivity(input.actorId, 'RecipientCreated', 'Recipient created');
    sendJson(input.res, 200, {
      recipient_id: outcome.value.beneficiaryId,
      legal_name: outcome.value.legalName,
      currency: outcome.value.currency,
      destination_country: outcome.value.destinationCountry,
      status: outcome.value.status,
    }, input.requestId);
    return true;
  }

  if (input.path === '/v1/consumer/payments/quotes' && input.method === 'POST') {
    if (!facts.authorizedCapabilities.includes('FX_QUOTE_REQUEST') || !primary) {
      fail(input.res, 403, input.requestId, 'CAPABILITY_DENIED', 'FX_QUOTE_REQUEST is not granted', { user_action_required: true });
      return true;
    }
    const body = parseJsonBody(await readBody(input.req, 32_768));
    const amount = moneyFromBody(body, 'USD') ?? Money.fromMinorUnits(100_000n, 'USD');
    const idempotencyKey = asString(body.idempotency_key) ?? `pq_${newSecurityToken()}`;
    const outcome = money.payments.createQuote({
      id: asIntentId(`pq_${idempotencyKey}`),
      actionType: ACTION_TYPES.CREATE_FX_QUOTE,
      idempotencyKey,
      actorId: input.actorId,
      requestedAt: runtime.clock.now(),
      purpose: 'CUSTOMER_CROSS_BORDER_PAYMENT',
      payload: {
        quoteId: asString(body.quote_id) ?? `quote_${newSecurityToken()}`,
        accountId: asAccountId(asString(body.account_id) ?? primary.id),
        baseCurrency: asCurrencyCode(asString(body.source_currency) ?? 'USD'),
        quoteCurrency: asCurrencyCode(asString(body.destination_currency) ?? 'SAR'),
        sourceAmount: amount,
        corridorId: asString(body.corridor_id) ?? 'US-SA-USD-SAR',
      },
    });
    if (outcome.outcome !== 'OK') {
      fail(input.res, 409, input.requestId, outcome.outcome === 'KERNEL_REFUSED' ? 'KERNEL_REFUSED' : 'RESOURCE_CONFLICT', outcome.outcome === 'REJECTED' ? outcome.message : 'quote refused');
      return true;
    }
    sendJson(input.res, 200, quoteDto(outcome.value), input.requestId);
    return true;
  }

  if (input.path === '/v1/consumer/payments' && input.method === 'POST') {
    if (!facts.authorizedCapabilities.includes('PAYMENT_REQUEST') || !primary) {
      fail(input.res, 403, input.requestId, 'CAPABILITY_DENIED', 'PAYMENT_REQUEST is not granted', { user_action_required: true });
      return true;
    }
    const body = parseJsonBody(await readBody(input.req, 32_768));
    const quoteId = asString(body.quote_id);
    const beneficiaryId = asString(body.recipient_id);
    const idempotencyKey = asString(body.idempotency_key) ?? `pay_${newSecurityToken()}`;
    if (!quoteId || !beneficiaryId) {
      fail(input.res, 400, input.requestId, 'VALIDATION_FAILED', 'quote_id and recipient_id are required', { user_action_required: true });
      return true;
    }
    const quote = money.payments.getStore().getQuote(quoteId);
    if (!quote) {
      fail(input.res, 404, input.requestId, 'RESOURCE_NOT_FOUND', 'quote was not found');
      return true;
    }
    const accepted = money.payments.acceptQuote({
      id: asIntentId(`acc_${idempotencyKey}`),
      actionType: ACTION_TYPES.ACCEPT_FX_QUOTE,
      idempotencyKey: `acc_${idempotencyKey}`,
      actorId: input.actorId,
      requestedAt: runtime.clock.now(),
      purpose: 'CUSTOMER_FX',
      payload: { quoteId, accountId: primary.id },
    });
    if (accepted.outcome !== 'OK') {
      fail(input.res, 409, input.requestId, 'RESOURCE_CONFLICT', accepted.outcome === 'REJECTED' ? accepted.message : 'quote accept refused');
      return true;
    }
    const outcome = money.payments.initiatePayment({
      id: asIntentId(`pay_${idempotencyKey}`),
      actionType: ACTION_TYPES.INITIATE_PAYMENT,
      idempotencyKey,
      actorId: input.actorId,
      requestedAt: runtime.clock.now(),
      purpose: 'CUSTOMER_CROSS_BORDER_PAYMENT',
      payload: {
        paymentId: asString(body.payment_id) ?? `pay_${newSecurityToken()}`,
        accountId: primary.id,
        sourceAccountId: primary.id,
        beneficiaryId,
        quoteId,
        sourceAmount: quote.sourceAmount,
        purposeReference: asString(body.purpose) ?? 'sandbox payment',
      },
    });
    if (outcome.outcome !== 'OK') {
      fail(input.res, outcome.outcome === 'KERNEL_REFUSED' ? 403 : 409, input.requestId, outcome.outcome === 'KERNEL_REFUSED' ? 'KERNEL_REFUSED' : 'RESOURCE_CONFLICT', outcome.outcome === 'REJECTED' ? outcome.message : 'payment refused');
      return true;
    }
    recordActivity(input.actorId, 'PaymentSubmitted', `Payment ${outcome.value.status}`);
    sendJson(input.res, 200, paymentDto(outcome.value), input.requestId);
    return true;
  }

  const paymentMatch = /^\/v1\/consumer\/payments\/([^/]+)$/.exec(input.path);
  if (paymentMatch && input.method === 'GET') {
    const payment = money.payments.getStore().getPayment(decodeURIComponent(paymentMatch[1] ?? ''));
    if (!payment) {
      fail(input.res, 404, input.requestId, 'RESOURCE_NOT_FOUND', 'payment was not found');
      return true;
    }
    sendJson(input.res, 200, paymentDto(payment), input.requestId);
    return true;
  }

  if (input.path === '/v1/consumer/fx/quotes' && input.method === 'POST') {
    if (!facts.authorizedCapabilities.includes('FX_QUOTE_REQUEST') || !primary) {
      fail(input.res, 403, input.requestId, 'CAPABILITY_DENIED', 'FX_QUOTE_REQUEST is not granted', { user_action_required: true });
      return true;
    }
    const body = parseJsonBody(await readBody(input.req, 32_768));
    const amount = moneyFromBody(body, 'USD') ?? Money.fromMinorUnits(100_000n, 'USD');
    const idempotencyKey = asString(body.idempotency_key) ?? `fxq_${newSecurityToken()}`;
    const outcome = money.payments.createQuote({
      id: asIntentId(`fxq_${idempotencyKey}`),
      actionType: ACTION_TYPES.CREATE_FX_QUOTE,
      idempotencyKey,
      actorId: input.actorId,
      requestedAt: runtime.clock.now(),
      purpose: 'CUSTOMER_FX',
      payload: {
        quoteId: asString(body.quote_id) ?? `quote_${newSecurityToken()}`,
        accountId: asAccountId(asString(body.account_id) ?? primary.id),
        baseCurrency: asCurrencyCode(asString(body.source_currency) ?? 'USD'),
        quoteCurrency: asCurrencyCode(asString(body.destination_currency) ?? 'SAR'),
        sourceAmount: amount,
        corridorId: asString(body.corridor_id) ?? 'US-SA-USD-SAR',
      },
    });
    if (outcome.outcome !== 'OK') {
      fail(input.res, 409, input.requestId, outcome.outcome === 'KERNEL_REFUSED' ? 'KERNEL_REFUSED' : 'RESOURCE_CONFLICT', outcome.outcome === 'REJECTED' ? outcome.message : 'fx quote refused');
      return true;
    }
    sendJson(input.res, 200, quoteDto(outcome.value), input.requestId);
    return true;
  }

  const acceptMatch = /^\/v1\/consumer\/fx\/quotes\/([^/]+)\/accept$/.exec(input.path);
  if (acceptMatch && input.method === 'POST') {
    if (!primary) {
      fail(input.res, 409, input.requestId, 'RESOURCE_CONFLICT', 'no account');
      return true;
    }
    const quoteId = decodeURIComponent(acceptMatch[1] ?? '');
    const outcome = money.payments.acceptQuote({
      id: asIntentId(`fxa_${quoteId}`),
      actionType: ACTION_TYPES.ACCEPT_FX_QUOTE,
      idempotencyKey: `fxa_${quoteId}`,
      actorId: input.actorId,
      requestedAt: runtime.clock.now(),
      purpose: 'CUSTOMER_FX',
      payload: { quoteId, accountId: primary.id },
    });
    if (outcome.outcome !== 'OK') {
      fail(input.res, 409, input.requestId, 'RESOURCE_CONFLICT', outcome.outcome === 'REJECTED' ? outcome.message : 'accept refused');
      return true;
    }
    sendJson(input.res, 200, quoteDto(outcome.value), input.requestId);
    return true;
  }

  const execMatch = /^\/v1\/consumer\/fx\/quotes\/([^/]+)\/execute$/.exec(input.path);
  if (execMatch && input.method === 'POST') {
    if (!primary) {
      fail(input.res, 409, input.requestId, 'RESOURCE_CONFLICT', 'no account');
      return true;
    }
    const body = parseJsonBody(await readBody(input.req, 32_768));
    const quoteId = decodeURIComponent(execMatch[1] ?? '');
    const destination = asString(body.destination_account_id) ?? accounts.find((row) => row.currency === 'SAR')?.id;
    if (!destination) {
      fail(input.res, 400, input.requestId, 'VALIDATION_FAILED', 'destination_account_id is required', { user_action_required: true });
      return true;
    }
    const outcome = money.payments.executeInternalConversion(
      {
        id: asIntentId(`fxe_${quoteId}`),
        actionType: ACTION_TYPES.ACCEPT_FX_QUOTE,
        idempotencyKey: `fxe_${quoteId}`,
        actorId: input.actorId,
        requestedAt: runtime.clock.now(),
        purpose: 'CUSTOMER_FX',
        payload: { quoteId, accountId: primary.id },
      },
      asAccountId(destination),
    );
    if (outcome.outcome !== 'OK') {
      fail(input.res, 409, input.requestId, 'RESOURCE_CONFLICT', outcome.outcome === 'REJECTED' ? outcome.message : 'execute refused');
      return true;
    }
    recordActivity(input.actorId, 'FxConversionExecuted', 'USD to SAR conversion executed');
    sendJson(input.res, 200, { ...quoteDto(outcome.value.quote), journal_ids: outcome.value.journalIds }, input.requestId);
    return true;
  }

  if (input.path === '/v1/consumer/cards' && input.method === 'GET') {
    const items = (customerId ? money.cards.store.listCardsByCustomer(customerId) : []).map(cardDto);
    sendJson(input.res, 200, { items }, input.requestId);
    return true;
  }

  if (input.path === '/v1/consumer/cards' && input.method === 'POST') {
    if (!facts.authorizedCapabilities.includes('CARD_MANAGE_REQUEST') || !customerId || !primary) {
      fail(input.res, 403, input.requestId, 'CAPABILITY_DENIED', 'CARD_MANAGE_REQUEST is not granted', { user_action_required: true });
      return true;
    }
    const body = parseJsonBody(await readBody(input.req, 32_768));
    const idempotencyKey = asString(body.idempotency_key) ?? `card_${newSecurityToken()}`;
    const requested = money.cards.requestCard({
      id: asIntentId(`card_${idempotencyKey}`),
      actionType: ACTION_TYPES.REQUEST_CARD,
      idempotencyKey,
      actorId: input.actorId,
      requestedAt: runtime.clock.now(),
      purpose: 'CUSTOMER_CARD',
      payload: {
        cardId: asString(body.card_id) ?? `card_${newSecurityToken()}`,
        accountId: primary.id,
        ownerId: asCustomerId(customerId),
        programId: SIMULATION_US_VIRTUAL_PROGRAM.programId,
        formFactor: 'VIRTUAL',
      },
    });
    if (requested.outcome !== 'OK') {
      fail(input.res, 409, input.requestId, 'RESOURCE_CONFLICT', requested.outcome === 'REJECTED' ? requested.message : 'card request refused');
      return true;
    }
    const activated = money.cards.activateCard({
      id: asIntentId(`card_act_${idempotencyKey}`),
      actionType: ACTION_TYPES.ACTIVATE_CARD,
      idempotencyKey: `act_${idempotencyKey}`,
      actorId: input.actorId,
      requestedAt: runtime.clock.now(),
      purpose: 'CUSTOMER_CARD',
      payload: { cardId: requested.value.cardId, accountId: primary.id },
    });
    if (activated.outcome !== 'OK') {
      fail(input.res, 409, input.requestId, 'RESOURCE_CONFLICT', 'card activate refused');
      return true;
    }
    recordActivity(input.actorId, 'CardIssued', 'Virtual card issued');
    sendJson(input.res, 200, cardDto(activated.value), input.requestId);
    return true;
  }

  const freezeMatch = /^\/v1\/consumer\/cards\/([^/]+)\/(freeze|unfreeze)$/.exec(input.path);
  if (freezeMatch && input.method === 'POST') {
    if (!primary) {
      fail(input.res, 409, input.requestId, 'RESOURCE_CONFLICT', 'no account');
      return true;
    }
    const cardId = decodeURIComponent(freezeMatch[1] ?? '');
    const action = freezeMatch[2] === 'freeze' ? ACTION_TYPES.FREEZE_CARD : ACTION_TYPES.UNFREEZE_CARD;
    const outcome = freezeMatch[2] === 'freeze'
      ? money.cards.freezeCard({
          id: asIntentId(`${action}_${cardId}`),
          actionType: action,
          idempotencyKey: `${action}_${cardId}`,
          actorId: input.actorId,
          requestedAt: runtime.clock.now(),
          purpose: 'CUSTOMER_CARD',
          payload: { cardId, accountId: primary.id },
        })
      : money.cards.unfreezeCard({
          id: asIntentId(`${action}_${cardId}`),
          actionType: action,
          idempotencyKey: `${action}_${cardId}`,
          actorId: input.actorId,
          requestedAt: runtime.clock.now(),
          purpose: 'CUSTOMER_CARD',
          payload: { cardId, accountId: primary.id },
        });
    if (outcome.outcome !== 'OK') {
      fail(input.res, 409, input.requestId, 'RESOURCE_CONFLICT', outcome.outcome === 'REJECTED' ? outcome.message : 'card action refused');
      return true;
    }
    recordActivity(input.actorId, freezeMatch[2] === 'freeze' ? 'CardFrozen' : 'CardUnfrozen', `Card ${freezeMatch[2]}`);
    sendJson(input.res, 200, cardDto(outcome.value), input.requestId);
    return true;
  }

  return false;
}

function quoteDto(quote: { readonly quoteId: string; readonly status: string; readonly sourceAmount: Money; readonly destinationAmount: Money; readonly fee: Money; readonly expiresAt: string }): Record<string, unknown> {
  return {
    quote_id: quote.quoteId,
    status: quote.status,
    source: { minor_units: quote.sourceAmount.minorUnits.toString(), currency: quote.sourceAmount.currency },
    destination: { minor_units: quote.destinationAmount.minorUnits.toString(), currency: quote.destinationAmount.currency },
    fee: { minor_units: quote.fee.minorUnits.toString(), currency: quote.fee.currency },
    expires_at: quote.expiresAt,
    rate_source: 'SIMULATION_REF_NOT_LIVE_MARKET',
  };
}

function paymentDto(payment: { readonly paymentId: string; readonly status: string; readonly sourceAmount: Money; readonly quotedDestinationAmount: Money }): Record<string, unknown> {
  return {
    payment_id: payment.paymentId,
    status: payment.status,
    source: { minor_units: payment.sourceAmount.minorUnits.toString(), currency: payment.sourceAmount.currency },
    destination: { minor_units: payment.quotedDestinationAmount.minorUnits.toString(), currency: payment.quotedDestinationAmount.currency },
  };
}

function cardDto(card: {
  readonly cardId: string;
  readonly status: string;
  readonly formFactor: string;
  readonly displayHint?: string;
}): Record<string, unknown> {
  return {
    card_id: card.cardId,
    status: card.status,
    form_factor: card.formFactor,
    display_hint: card.displayHint ?? 'SIM-CARD',
  };
}
