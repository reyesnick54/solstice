import type { UtcInstant } from '../../../domain/src/time.ts';
import type { ConsumerExchangeEngine } from './engine.ts';
import type { ConsumerAuthorization, ConsumerConversionRequest, ConsumerOrderRequest } from './types.ts';
import type { ConsumerFlow, ConsumerOrderType } from './taxonomy.ts';

export function getConsumerPortfolio(
  engine: ConsumerExchangeEngine,
  input: { readonly participantId: string; readonly authenticated: boolean; readonly now: UtcInstant },
) {
  return engine.getConsumerPortfolio(input);
}

export function getConsumerMarket(engine: ConsumerExchangeEngine, now: UtcInstant) {
  return engine.getConsumerMarket(now);
}

export function getConsumerQuote(
  engine: ConsumerExchangeEngine,
  input: Parameters<ConsumerExchangeEngine['getConsumerQuote']>[0],
) {
  return engine.getConsumerQuote(input);
}

export function previewConsumerTrade(
  engine: ConsumerExchangeEngine,
  input: Parameters<ConsumerExchangeEngine['previewConsumerTrade']>[0],
) {
  return engine.previewConsumerTrade(input);
}

export function submitConsumerTrade(
  engine: ConsumerExchangeEngine,
  input: {
    readonly participantId: string;
    readonly request: ConsumerOrderRequest;
    readonly authorization: ConsumerAuthorization;
    readonly now: UtcInstant;
  },
) {
  return engine.submitConsumerTrade(input);
}

export function cancelConsumerOrder(
  engine: ConsumerExchangeEngine,
  input: Parameters<ConsumerExchangeEngine['cancelConsumerOrder']>[0],
) {
  return engine.cancelConsumerOrder(input);
}

export function getConsumerOrder(engine: ConsumerExchangeEngine, participantId: string, clientOrderId: string) {
  return engine.getConsumerOrder(participantId, clientOrderId);
}

export function getConsumerTradeReceipt(engine: ConsumerExchangeEngine, orderId: string) {
  return engine.getConsumerTradeReceipt(orderId);
}

export function createPriceAlert(
  engine: ConsumerExchangeEngine,
  input: Parameters<ConsumerExchangeEngine['createPriceAlert']>[0],
) {
  return engine.createPriceAlert(input);
}

export function submitConsumerConversion(
  engine: ConsumerExchangeEngine,
  input: {
    readonly participantId: string;
    readonly request: ConsumerConversionRequest;
    readonly authorization: ConsumerAuthorization;
    readonly now: UtcInstant;
  },
) {
  return engine.submitConsumerConversion(input);
}

export type ConsumerApiSurface = {
  readonly getConsumerPortfolio: typeof getConsumerPortfolio;
  readonly getConsumerMarket: typeof getConsumerMarket;
  readonly getConsumerQuote: typeof getConsumerQuote;
  readonly previewConsumerTrade: typeof previewConsumerTrade;
  readonly submitConsumerTrade: typeof submitConsumerTrade;
  readonly cancelConsumerOrder: typeof cancelConsumerOrder;
  readonly getConsumerOrder: typeof getConsumerOrder;
  readonly getConsumerTradeReceipt: typeof getConsumerTradeReceipt;
  readonly createPriceAlert: typeof createPriceAlert;
};

export const consumerApi: ConsumerApiSurface = Object.freeze({
  getConsumerPortfolio,
  getConsumerMarket,
  getConsumerQuote,
  previewConsumerTrade,
  submitConsumerTrade,
  cancelConsumerOrder,
  getConsumerOrder,
  getConsumerTradeReceipt,
  createPriceAlert,
});

export type ConsumerPreviewInput = {
  readonly flow: ConsumerFlow;
  readonly orderType: ConsumerOrderType;
};
