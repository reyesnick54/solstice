import { Money } from '../../../../packages/money/src/money.ts';
import { asCurrencyCode } from '../../../../packages/domain/src/currency.ts';
import { asUtcInstant } from '../../../../packages/domain/src/time.ts';
import { asIntentId } from '../../../../packages/permissions/src/action-intent.ts';
import { ACTION_TYPES } from '../../../../packages/permissions/src/action-types.ts';
import { fxQuoteDisclosure, type FxQuoteDisclosure } from '../../../../packages/payments/src/responses.ts';
import type { PaymentsService, PaymentsServiceOutcome } from '../../../../packages/payments/src/service.ts';
import type { PresentationValuation, ValuationPosition } from '../../../../packages/payments/src/fx-valuation.ts';
import type { SupportedCurrency } from '../../../../packages/payments/src/fx-currency.ts';
import type { PaymentFxReview } from '../../../../packages/payments/src/fx-payment.ts';
import type { BffPrincipal } from './ports.ts';

export type FxCommandPort = {
  listCurrencies(): readonly SupportedCurrency[];
  valuePositions(positions: readonly ValuationPosition[], targetCurrency: string): PresentationValuation;
  createQuote(
    principal: BffPrincipal,
    input: {
      readonly quoteId: string;
      readonly accountId: string;
      readonly sourceCurrency: string;
      readonly destinationCurrency: string;
      readonly sourceAmountMinorUnits: string;
      readonly corridorId: string;
    },
  ): PaymentsServiceOutcome<FxQuoteDisclosure>;
  getQuote(quoteId: string): FxQuoteDisclosure | undefined;
  acceptQuote(principal: BffPrincipal, quoteId: string, accountId: string): PaymentsServiceOutcome<FxQuoteDisclosure>;
  executeQuote(
    principal: BffPrincipal,
    quoteId: string,
    sourceAccountId: string,
    destinationAccountId: string,
  ): PaymentsServiceOutcome<{
    readonly executionId: string;
    readonly quoteId: string;
    readonly status: string;
    readonly journalIds: readonly string[];
    readonly reconciliationRef: string | null;
    readonly quote: FxQuoteDisclosure;
  }>;
  composePayment(
    principal: BffPrincipal,
    input: {
      readonly compositionId: string;
      readonly quoteId: string;
      readonly sourceAccountId: string;
      readonly beneficiaryId: string;
      readonly purposeReference: string;
    },
  ): PaymentsServiceOutcome<PaymentFxReview>;
};

export function createFxCommandPort(payments: PaymentsService, now: () => string): FxCommandPort {
  return {
    listCurrencies: () => payments.listCurrencies(),
    valuePositions: (positions, target) => payments.valuePositions(positions, target),
    createQuote(principal, input) {
      const outcome = payments.createQuote({
        id: asIntentId(`bff_q_${input.quoteId}`),
        actionType: ACTION_TYPES.CREATE_FX_QUOTE,
        idempotencyKey: `bff_q_${input.quoteId}`,
        actorId: principal.actorId,
        requestedAt: asUtcInstant(now()),
        purpose: 'CUSTOMER_FX',
        payload: {
          quoteId: input.quoteId,
          accountId: input.accountId as never,
          baseCurrency: asCurrencyCode(input.sourceCurrency),
          quoteCurrency: asCurrencyCode(input.destinationCurrency),
          sourceAmount: Money.fromMinorUnitsString(input.sourceAmountMinorUnits, input.sourceCurrency),
          corridorId: input.corridorId,
        },
      });
      if (outcome.outcome !== 'OK') {
        return outcome;
      }
      return { ...outcome, value: fxQuoteDisclosure(outcome.value) };
    },
    getQuote(quoteId) {
      const quote = payments.getQuote(quoteId);
      return quote ? fxQuoteDisclosure(quote) : undefined;
    },
    acceptQuote(principal, quoteId, accountId) {
      const outcome = payments.acceptQuote({
        id: asIntentId(`bff_acc_${quoteId}`),
        actionType: ACTION_TYPES.ACCEPT_FX_QUOTE,
        idempotencyKey: `bff_acc_${quoteId}`,
        actorId: principal.actorId,
        requestedAt: asUtcInstant(now()),
        purpose: 'CUSTOMER_FX',
        payload: { quoteId, accountId: accountId as never },
      });
      if (outcome.outcome !== 'OK') {
        return outcome;
      }
      return { ...outcome, value: fxQuoteDisclosure(outcome.value) };
    },
    executeQuote(principal, quoteId, sourceAccountId, destinationAccountId) {
      const outcome = payments.executeQuote({
        id: asIntentId(`bff_ex_${quoteId}`),
        actionType: ACTION_TYPES.EXECUTE_FX_QUOTE,
        idempotencyKey: `bff_ex_${quoteId}`,
        actorId: principal.actorId,
        requestedAt: asUtcInstant(now()),
        purpose: 'CUSTOMER_FX',
        payload: {
          quoteId,
          accountId: sourceAccountId as never,
          sourceAccountId: sourceAccountId as never,
          destinationAccountId: destinationAccountId as never,
        },
      });
      if (outcome.outcome !== 'OK') {
        return outcome;
      }
      const quote = payments.getQuote(quoteId);
      return {
        ...outcome,
        value: {
          executionId: outcome.value.executionId,
          quoteId: outcome.value.quoteId,
          status: outcome.value.status,
          journalIds: outcome.value.journalIds,
          reconciliationRef: outcome.value.reconciliationRef,
          quote: fxQuoteDisclosure(quote!),
        },
      };
    },
    composePayment(principal, input) {
      void principal;
      return payments.composePaymentFx({
        ...input,
        idempotencyKey: `bff_cmp_${input.compositionId}`,
      });
    },
  };
}
