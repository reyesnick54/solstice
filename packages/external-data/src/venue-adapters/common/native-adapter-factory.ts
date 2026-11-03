/**
 * Factory for HELIOS NATIVE05 venue adapters (BYTEX reference, clean-room TypeScript).
 */

import {
  assertHeliosVenueAdapter,
  createVenueAdapterContract,
  DEFAULT_RECONCILIATION_SEMANTICS,
  DEFAULT_VENUE_HEARTBEAT_POLICY,
  DEFAULT_VENUE_RETRY_POLICY,
  DEFAULT_VENUE_SEQUENCE_POLICY,
  HELIOS_VENUE_ADAPTER_SCHEMA_VERSION,
  HELIOS_VENUE_NORMALIZATION_SCHEMA_VERSION,
  runNativeVenueAdapterConformance,
  type HeliosCanonicalSymbol,
  type HeliosInstrumentMetadata,
  type HeliosNormalizedBook,
  type HeliosNormalizedCandle,
  type HeliosNormalizedOrder,
  type HeliosNormalizedQuote,
  type HeliosNormalizedTrade,
  type HeliosOs04VenueId,
  type HeliosVenueAdapter,
  type HeliosVenueNormalizationFixture,
  type VenueCapabilityManifest,
  type VenueConnectivityProfile,
  type VenueMarketDataProbeRequest,
  type VenueMarketDataProbeResult,
  type VenueReconciliationSemantics,
  type VenueWebSocketLifecycleState,
} from '@solstice/provider-sdk';

const DEFAULT_WEBSOCKET_LIFECYCLE: readonly VenueWebSocketLifecycleState[] = Object.freeze([
  'disconnected',
  'connecting',
  'connected',
  'reconnecting',
  'paused',
  'closed',
]);

export type VenueSymbolCodec = Readonly<{
  resolve(input: { kind: 'canonical'; value: string } | { kind: 'raw'; value: string }): HeliosCanonicalSymbol;
  describe(symbol: HeliosCanonicalSymbol): HeliosInstrumentMetadata;
}>;

export type VenueNormalizerBundle = Readonly<{
  normalizeQuote(raw: unknown, symbol: HeliosCanonicalSymbol): HeliosNormalizedQuote;
  normalizeTrade(raw: unknown, symbol: HeliosCanonicalSymbol): HeliosNormalizedTrade;
  normalizeBook(raw: unknown, symbol: HeliosCanonicalSymbol): HeliosNormalizedBook;
  normalizeCandle(raw: unknown, symbol: HeliosCanonicalSymbol): HeliosNormalizedCandle;
  normalizeOrderState(raw: unknown, symbol: HeliosCanonicalSymbol): HeliosNormalizedOrder;
}>;

export type NativeVenueModule = Readonly<{
  readonly venueId: HeliosOs04VenueId;
  readonly displayName: string;
  readonly manifest: VenueCapabilityManifest;
  readonly symbols: VenueSymbolCodec;
  readonly normalizers: VenueNormalizerBundle;
  readonly normalizationFixtures: readonly HeliosVenueNormalizationFixture[];
  readonly fixtureLastPrice: (symbol: string) => string | null;
  readonly connectivity?: VenueConnectivityProfile;
  readonly reconciliation?: VenueReconciliationSemantics;
}>;

function defaultConnectivity(manifest: VenueCapabilityManifest): VenueConnectivityProfile {
  const rate =
    manifest.marketData.rateLimits.availability === 'AVAILABLE'
      ? manifest.marketData.rateLimits.value
      : { restRequestsPerSecond: null, websocketSubscriptionsMax: null, notes: null };
  return Object.freeze({
    websocketLifecycle: DEFAULT_WEBSOCKET_LIFECYCLE,
    sequence: DEFAULT_VENUE_SEQUENCE_POLICY,
    heartbeat: DEFAULT_VENUE_HEARTBEAT_POLICY,
    rateLimits: Object.freeze({
      restRequestsPerSecond: rate.restRequestsPerSecond,
      websocketSubscriptionsMax: rate.websocketSubscriptionsMax,
      orderRequestsPerSecond: null,
      notes: rate.notes,
    }),
    retry: DEFAULT_VENUE_RETRY_POLICY,
  });
}

export function createNativeVenueAdapter(module: NativeVenueModule): HeliosVenueAdapter {
  const adapter: HeliosVenueAdapter = {
    venueId: module.venueId,
    adapterSchemaVersion: HELIOS_VENUE_ADAPTER_SCHEMA_VERSION,
    liveOrderPlacementEnabled: false,
    liveExecutionEnabled: false,
    assimilationSource: 'bytex-reference-clean-room',
    normalizationFixtures: module.normalizationFixtures,
    manifest() {
      return module.manifest;
    },
    resolveSymbol(input) {
      return module.symbols.resolve(input);
    },
    describeInstrument(symbol) {
      return module.symbols.describe(symbol);
    },
    normalizeQuote(raw, symbol) {
      const quote = module.normalizers.normalizeQuote(raw, symbol);
      if (quote.schemaVersion !== HELIOS_VENUE_NORMALIZATION_SCHEMA_VERSION) {
        throw new Error('invalid quote schema version');
      }
      return quote;
    },
    normalizeTrade(raw, symbol) {
      return module.normalizers.normalizeTrade(raw, symbol);
    },
    normalizeBook(raw, symbol) {
      return module.normalizers.normalizeBook(raw, symbol);
    },
    normalizeCandle(raw, symbol) {
      return module.normalizers.normalizeCandle(raw, symbol);
    },
    normalizeOrderState(raw, symbol) {
      return module.normalizers.normalizeOrderState(raw, symbol);
    },
    describeConnectivity() {
      return module.connectivity ?? defaultConnectivity(module.manifest);
    },
    describeReconciliation() {
      return module.reconciliation ?? DEFAULT_RECONCILIATION_SEMANTICS;
    },
    async runConformance(runInput) {
      return runNativeVenueAdapterConformance(adapter, runInput);
    },
    async runNativeConformance(runInput) {
      return runNativeVenueAdapterConformance(adapter, runInput);
    },
    async probeMarketData(request: VenueMarketDataProbeRequest): Promise<VenueMarketDataProbeResult> {
      if (request.qualificationMode === 'readonly_live') {
        return Object.freeze({
          ok: false,
          reason: 'readonly_live probes disabled for NATIVE05 assimilation adapters in CI posture',
        });
      }
      const price = module.fixtureLastPrice(request.symbol);
      if (!price) {
        return Object.freeze({ ok: false, reason: `no fixture for symbol ${request.symbol}` });
      }
      return Object.freeze({
        ok: true,
        symbol: request.symbol,
        lastPrice: price,
        observedAt: '2026-09-21T12:00:00.000Z',
      });
    },
  };

  const contracted = createVenueAdapterContract(adapter);
  return assertHeliosVenueAdapter({ ...adapter, ...contracted });
}
