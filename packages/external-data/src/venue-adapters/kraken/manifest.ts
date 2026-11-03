/**
 * Kraken venue capability manifest — declared from public API surface, fail-closed elsewhere.
 */

import { availableField, unavailableField, type VenueCapabilityManifest } from '@solstice/provider-sdk';

export const KRAKEN_VENUE_MANIFEST: VenueCapabilityManifest = Object.freeze({
  venueId: 'kraken',
  displayName: 'Kraken',
  assetClasses: availableField(Object.freeze(['crypto_spot'] as const)),
  instruments: availableField(Object.freeze(['BTC/USD', 'ETH/USD'])),
  venues: availableField(Object.freeze(['kraken_spot'])),
  marketData: Object.freeze({
    marketDataTypes: availableField(
      Object.freeze(['ticker', 'order_book', 'trades', 'candles'] as const),
    ),
    websocketAvailable: availableField(true),
    restAvailable: availableField(true),
    historicalDataSupport: availableField(true),
    timestampSemantics: availableField('exchange_event_time_utc'),
    rateLimits: availableField(
      Object.freeze({
        restRequestsPerSecond: 1,
        websocketSubscriptionsMax: 100,
        notes: 'Public REST/WebSocket tiers; authenticated tiers not qualified in OS04.',
      }),
    ),
  }),
  orders: Object.freeze({
    orderTypes: availableField(
      Object.freeze(['MARKET', 'LIMIT', 'STOP_LOSS', 'STOP_LOSS_LIMIT', 'TAKE_PROFIT'] as const),
    ),
    tifTypes: availableField(Object.freeze(['GTC', 'IOC', 'GTD'] as const)),
    precision: availableField(
      Object.freeze({
        priceDecimals: 8,
        quantityDecimals: 8,
        notionalDecimals: 2,
      }),
    ),
    minimumQuantity: availableField(
      Object.freeze({
        value: '0.0001',
        unit: 'BTC',
      }),
    ),
    minimumNotional: availableField(
      Object.freeze({
        valueMinor: '100',
        currency: 'USD',
      }),
    ),
    makerTakerFees: availableField(
      Object.freeze({
        makerBps: 16,
        takerBps: 26,
        currency: 'USD',
      }),
    ),
    reduceOnlySupport: unavailableField(),
    postOnlySupport: availableField(true),
    fundingSupport: unavailableField(),
  }),
  account: Object.freeze({
    sandboxAvailability: unavailableField(),
    subAccountSupport: availableField(true),
    portfolioMarginSupport: unavailableField(),
  }),
  reconciliation: Object.freeze({
    reconciliationSupport: availableField(true),
    fillHistoryAvailable: availableField(true),
    ledgerExportAvailable: unavailableField(),
  }),
  healthState: 'HEALTHY',
  liveOrderPlacementEnabled: false,
  qualificationNotes: Object.freeze([
    'OS04 Kraken integration — read-only market-data probes in CI via fixtures',
    'Order placement remains disabled; signing/authentication not ported from reference stacks',
  ]),
});
