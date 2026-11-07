/**
 * MD01 — canonical institutional market-data event contract (provider-sdk owner).
 *
 * Observation-only: never grants Execution Authority.
 * Prices and quantities are decimal strings (no floating-point).
 */

export const MARKET_DATA_EVENT_SCHEMA_VERSION = 'sunrey.market-data-event.v1' as const;

export const MARKET_DATA_EVENT_AUTHORITY = 'MARKET_OBSERVATION_ONLY' as const;

export const MARKET_DATA_EVENT_GRANTS_EXECUTION_AUTHORITY = false as const;

export const CANONICAL_MARKET_DATA_EVENT_KINDS = [
  'MarketTradeEvent',
  'MarketQuoteEvent',
  'MarketBookUpdate',
  'MarketBookSnapshot',
  'MarketStatusEvent',
  'AuctionEvent',
  'ImbalanceEvent',
  'ReferencePriceEvent',
  'SettlementPriceEvent',
  'OpenInterestEvent',
  'FundingRateEvent',
  'IndexPriceEvent',
  'MarkPriceEvent',
] as const;

export type CanonicalMarketDataEventKind = (typeof CANONICAL_MARKET_DATA_EVENT_KINDS)[number];

export const MARKET_EVENT_QUALITY_STATES = [
  'VALID',
  'DEGRADED_STALE',
  'DEGRADED_GAP',
  'DEGRADED_OUTLIER',
  'DEGRADED_CONTRADICTORY',
  'DEGRADED_ENTITLEMENT',
  'DEGRADED_MALFORMED',
  'DEGRADED_DUPLICATE',
  'DEGRADED_SEQUENCE',
  'UNAVAILABLE',
] as const;

export type MarketEventQualityState = (typeof MARKET_EVENT_QUALITY_STATES)[number];

export type MarketDataEventTemporal = Readonly<{
  readonly eventTime: string;
  readonly exchangeTime: string | null;
  readonly providerPublishTime: string | null;
  readonly sunreyReceiveTime: string;
  readonly normalizedTime: string;
  readonly knowableAt: string;
}>;

export type MarketDataEventProvenance = Readonly<{
  readonly instrumentId: string;
  readonly venueId: string;
  readonly providerId: string;
  readonly sourceFeedId: string;
  readonly sourceSequence: bigint | null;
  readonly sourceRef: string;
  readonly entitlementRef: string;
  readonly qualityState: MarketEventQualityState;
}>;

export type MarketDataEventEnvelopeBase = MarketDataEventTemporal &
  MarketDataEventProvenance &
  Readonly<{
    readonly schemaVersion: typeof MARKET_DATA_EVENT_SCHEMA_VERSION;
    readonly eventKind: CanonicalMarketDataEventKind;
    readonly authority: typeof MARKET_DATA_EVENT_AUTHORITY;
    readonly grantsExecutionAuthority: false;
    readonly eventId: string;
  }>;

export type DecimalPriceQuantity = Readonly<{
  readonly price: string;
  readonly quantity: string;
}>;

export type MarketTradeEvent = MarketDataEventEnvelopeBase &
  Readonly<{
    readonly eventKind: 'MarketTradeEvent';
    readonly tradeId: string;
    readonly price: string;
    readonly quantity: string;
    readonly aggressorSide: 'buy' | 'sell' | 'unknown';
  }>;

export type MarketQuoteEvent = MarketDataEventEnvelopeBase &
  Readonly<{
    readonly eventKind: 'MarketQuoteEvent';
    readonly bidPrice: string | null;
    readonly bidQuantity: string | null;
    readonly askPrice: string | null;
    readonly askQuantity: string | null;
  }>;

export type MarketBookLevel = Readonly<{
  readonly price: string;
  readonly quantity: string;
}>;

export type MarketBookUpdate = MarketDataEventEnvelopeBase &
  Readonly<{
    readonly eventKind: 'MarketBookUpdate';
    readonly side: 'bid' | 'ask';
    readonly levels: readonly MarketBookLevel[];
    readonly bookSequence: bigint | null;
  }>;

export type MarketBookSnapshot = MarketDataEventEnvelopeBase &
  Readonly<{
    readonly eventKind: 'MarketBookSnapshot';
    readonly bids: readonly MarketBookLevel[];
    readonly asks: readonly MarketBookLevel[];
    readonly bookSequence: bigint | null;
  }>;

export type MarketStatusEvent = MarketDataEventEnvelopeBase &
  Readonly<{
    readonly eventKind: 'MarketStatusEvent';
    readonly sessionStatus: 'OPEN' | 'CLOSED' | 'HALTED' | 'PRE_MARKET' | 'AFTER_HOURS' | 'UNKNOWN';
    readonly reason: string | null;
  }>;

export type AuctionEvent = MarketDataEventEnvelopeBase &
  Readonly<{
    readonly eventKind: 'AuctionEvent';
    readonly auctionType: 'opening' | 'closing' | 'intraday' | 'unknown';
    readonly indicativePrice: string | null;
    readonly indicativeQuantity: string | null;
  }>;

export type ImbalanceEvent = MarketDataEventEnvelopeBase &
  Readonly<{
    readonly eventKind: 'ImbalanceEvent';
    readonly imbalanceSide: 'buy' | 'sell' | 'none' | 'unknown';
    readonly imbalanceQuantity: string;
    readonly referencePrice: string | null;
  }>;

export type ReferencePriceEvent = MarketDataEventEnvelopeBase &
  Readonly<{
    readonly eventKind: 'ReferencePriceEvent';
    readonly referencePrice: string;
    readonly priceType: 'last' | 'mid' | 'official' | 'vwap' | 'other';
  }>;

export type SettlementPriceEvent = MarketDataEventEnvelopeBase &
  Readonly<{
    readonly eventKind: 'SettlementPriceEvent';
    readonly settlementPrice: string;
    readonly settlementDate: string;
  }>;

export type OpenInterestEvent = MarketDataEventEnvelopeBase &
  Readonly<{
    readonly eventKind: 'OpenInterestEvent';
    readonly openInterest: string;
  }>;

export type FundingRateEvent = MarketDataEventEnvelopeBase &
  Readonly<{
    readonly eventKind: 'FundingRateEvent';
    readonly fundingRateNumerator: string;
    readonly fundingRateDenominator: string;
    readonly fundingInterval: string | null;
  }>;

export type IndexPriceEvent = MarketDataEventEnvelopeBase &
  Readonly<{
    readonly eventKind: 'IndexPriceEvent';
    readonly indexPrice: string;
    readonly indexId: string;
  }>;

export type MarkPriceEvent = MarketDataEventEnvelopeBase &
  Readonly<{
    readonly eventKind: 'MarkPriceEvent';
    readonly markPrice: string;
  }>;

export type CanonicalMarketDataEvent =
  | MarketTradeEvent
  | MarketQuoteEvent
  | MarketBookUpdate
  | MarketBookSnapshot
  | MarketStatusEvent
  | AuctionEvent
  | ImbalanceEvent
  | ReferencePriceEvent
  | SettlementPriceEvent
  | OpenInterestEvent
  | FundingRateEvent
  | IndexPriceEvent
  | MarkPriceEvent;

const DECIMAL_PATTERN = /^-?\d+(\.\d+)?$/;

export function isDecimalString(value: string): boolean {
  return DECIMAL_PATTERN.test(value.trim());
}

export function validateMarketDataEventEnvelope(event: CanonicalMarketDataEvent): readonly string[] {
  const errors: string[] = [];
  if (event.schemaVersion !== MARKET_DATA_EVENT_SCHEMA_VERSION) {
    errors.push('schema_version');
  }
  if (event.authority !== MARKET_DATA_EVENT_AUTHORITY) {
    errors.push('authority');
  }
  if (event.grantsExecutionAuthority !== false) {
    errors.push('grants_execution_authority');
  }
  const requiredStrings: Array<keyof MarketDataEventProvenance & keyof MarketDataEventTemporal> = [
    'instrumentId',
    'venueId',
    'providerId',
    'sourceFeedId',
    'sourceRef',
    'entitlementRef',
    'eventTime',
    'sunreyReceiveTime',
    'normalizedTime',
    'knowableAt',
  ];
  for (const key of requiredStrings) {
    const value = event[key];
    if (typeof value !== 'string' || !value.trim()) {
      errors.push(`missing_${key}`);
    }
  }
  if (!MARKET_EVENT_QUALITY_STATES.includes(event.qualityState)) {
    errors.push('quality_state');
  }
  if (!CANONICAL_MARKET_DATA_EVENT_KINDS.includes(event.eventKind)) {
    errors.push('event_kind');
  }
  return Object.freeze(errors);
}
