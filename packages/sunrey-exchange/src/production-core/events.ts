/**
 * Phase B event names for Exchange core. Events are outputs of
 * canonical Exchange state. They do not create Exchange truth.
 */
export const EXCHANGE_CORE_EVENT_NAMES = {
  orderAccepted: 'exchange.order.accepted',
  orderRejected: 'exchange.order.rejected',
  orderCancelled: 'exchange.order.cancelled',
  orderOpened: 'exchange.order.opened',
  orderPartiallyFilled: 'exchange.order.partially_filled',
  orderFilled: 'exchange.order.filled',
  fillCreated: 'exchange.fill.created',
  marketHalted: 'exchange.market.halted',
  marketResumed: 'exchange.market.resumed',
  marketSuspended: 'exchange.market.suspended',
} as const;

export type ExchangeCoreEventName = (typeof EXCHANGE_CORE_EVENT_NAMES)[keyof typeof EXCHANGE_CORE_EVENT_NAMES];

export const EXCHANGE_DOMAIN_EVENT_TYPES = {
  'exchange.order.accepted': 'ExchangeOrderAccepted',
  'exchange.order.rejected': 'ExchangeOrderRejected',
  'exchange.order.cancelled': 'ExchangeOrderCancelled',
  'exchange.order.opened': 'ExchangeOrderOpened',
  'exchange.order.partially_filled': 'ExchangeOrderPartiallyFilled',
  'exchange.order.filled': 'ExchangeOrderFilled',
  'exchange.fill.created': 'ExchangeFillCreated',
  'exchange.market.halted': 'ExchangeMarketHalted',
  'exchange.market.resumed': 'ExchangeMarketResumed',
  'exchange.market.suspended': 'ExchangeMarketHalted',
} as const;

export type ExchangeCoreEvent = {
  readonly name: ExchangeCoreEventName;
  readonly domainType: string;
  readonly correlationId: string;
  readonly aggregateId: string;
  readonly payload: Readonly<Record<string, unknown>>;
};

export function exchangeCoreEvent(
  name: ExchangeCoreEventName,
  aggregateId: string,
  correlationId: string,
  payload: Readonly<Record<string, unknown>>,
): ExchangeCoreEvent {
  return Object.freeze({
    name,
    domainType: EXCHANGE_DOMAIN_EVENT_TYPES[name],
    correlationId,
    aggregateId,
    payload,
  });
}
