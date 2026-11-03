/**
 * Kraken venue capability manifest — declared from public API surface, fail-closed elsewhere.
 */

import {
  availableField,
  unavailableField,
  type VenueAccountCapability,
  type VenueAssetClass,
  type VenueCapabilityManifest,
  type VenueMarketDataCapability,
  type VenueMarketDataType,
  type VenueOrderCapability,
  type VenueOrderType,
  type VenueReconciliationCapability,
  type VenueTimeInForce,
} from '@solstice/provider-sdk';

const KRAKEN_ASSET_CLASSES: readonly VenueAssetClass[] = Object.freeze(['crypto_spot']);
const KRAKEN_INSTRUMENTS: readonly string[] = Object.freeze(['BTC/USD', 'ETH/USD']);
const KRAKEN_VENUES: readonly string[] = Object.freeze(['kraken_spot']);
const KRAKEN_MARKET_DATA_TYPES: readonly VenueMarketDataType[] = Object.freeze([
  'ticker',
  'order_book',
  'trades',
  'candles',
]);
const KRAKEN_ORDER_TYPES: readonly VenueOrderType[] = Object.freeze([
  'MARKET',
  'LIMIT',
  'STOP_LOSS',
  'STOP_LOSS_LIMIT',
  'TAKE_PROFIT',
]);
const KRAKEN_TIF_TYPES: readonly VenueTimeInForce[] = Object.freeze(['GTC', 'IOC', 'GTD']);

const KRAKEN_MARKET_DATA: VenueMarketDataCapability = {
  marketDataTypes: availableField(KRAKEN_MARKET_DATA_TYPES),
  websocketAvailable: availableField(true),
  restAvailable: availableField(true),
  historicalDataSupport: availableField(true),
  timestampSemantics: availableField('exchange_event_time_utc'),
  rateLimits: availableField({
    restRequestsPerSecond: 1,
    websocketSubscriptionsMax: 100,
    notes: 'Public REST/WebSocket tiers; authenticated tiers not qualified in OS04.',
  }),
};

const KRAKEN_ORDERS: VenueOrderCapability = {
  orderTypes: availableField(KRAKEN_ORDER_TYPES),
  tifTypes: availableField(KRAKEN_TIF_TYPES),
  precision: availableField({
    priceDecimals: 8,
    quantityDecimals: 8,
    notionalDecimals: 2,
  }),
  minimumQuantity: availableField({
    value: '0.0001',
    unit: 'BTC',
  }),
  minimumNotional: availableField({
    valueMinor: '100',
    currency: 'USD',
  }),
  makerTakerFees: availableField({
    makerBps: 16,
    takerBps: 26,
    currency: 'USD',
  }),
  reduceOnlySupport: unavailableField<boolean>(),
  postOnlySupport: availableField(true),
  fundingSupport: unavailableField<boolean>(),
};

const KRAKEN_ACCOUNT: VenueAccountCapability = {
  sandboxAvailability: unavailableField<boolean>(),
  subAccountSupport: availableField(true),
  portfolioMarginSupport: unavailableField<boolean>(),
};

const KRAKEN_RECON: VenueReconciliationCapability = {
  reconciliationSupport: availableField(true),
  fillHistoryAvailable: availableField(true),
  ledgerExportAvailable: unavailableField<boolean>(),
};

export const KRAKEN_VENUE_MANIFEST: VenueCapabilityManifest = {
  venueId: 'kraken',
  displayName: 'Kraken',
  assetClasses: availableField(KRAKEN_ASSET_CLASSES),
  instruments: availableField(KRAKEN_INSTRUMENTS),
  venues: availableField(KRAKEN_VENUES),
  marketData: KRAKEN_MARKET_DATA,
  orders: KRAKEN_ORDERS,
  account: KRAKEN_ACCOUNT,
  reconciliation: KRAKEN_RECON,
  healthState: 'HEALTHY',
  liveOrderPlacementEnabled: false,
  qualificationNotes: [
    'OS04 Kraken integration — read-only market-data probes in CI via fixtures',
    'Order placement remains disabled; signing/authentication not ported from reference stacks',
  ],
};
