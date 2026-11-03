/**
 * HELIOS NATIVE05 — single venue adapter interface.
 *
 * Strategies and execution paths must consume market data and routing through this
 * contract (or orchestration built on it). No strategy may talk directly to an exchange.
 */

import type { HeliosVenueAdapterContract, VenueConformanceRunInput } from './contract.ts';
import type { VenueConformanceReport } from './types.ts';
import type { VenueConnectivityProfile } from './connectivity.ts';
import type {
  HeliosCanonicalSymbol,
  HeliosInstrumentMetadata,
  HeliosNormalizedBook,
  HeliosNormalizedCandle,
  HeliosNormalizedQuote,
  HeliosNormalizedTrade,
} from './normalized-market-data.ts';
import type { HeliosNormalizedOrder, VenueReconciliationSemantics } from './order-reconciliation.ts';
import type { HeliosOs04VenueId } from './taxonomy.ts';

export type HeliosVenueSymbolInput =
  | Readonly<{ readonly kind: 'canonical'; readonly value: string }>
  | Readonly<{ readonly kind: 'raw'; readonly value: string }>;

export type HeliosVenueNormalizationFixture = Readonly<{
  readonly fixtureId: string;
  readonly quote?: unknown;
  readonly trade?: unknown;
  readonly book?: unknown;
  readonly candle?: unknown;
  readonly order?: unknown;
}>;

export type HeliosVenueAdapter = HeliosVenueAdapterContract &
  Readonly<{
    readonly assimilationSource: 'bytex-reference-clean-room';
    readonly venueId: HeliosOs04VenueId;
    /** Live order placement and authenticated trading remain disabled in NATIVE05. */
    readonly liveExecutionEnabled: false;
    resolveSymbol(input: HeliosVenueSymbolInput): HeliosCanonicalSymbol;
    describeInstrument(symbol: HeliosCanonicalSymbol): HeliosInstrumentMetadata;
    normalizeQuote(raw: unknown, symbol: HeliosCanonicalSymbol): HeliosNormalizedQuote;
    normalizeTrade(raw: unknown, symbol: HeliosCanonicalSymbol): HeliosNormalizedTrade;
    normalizeBook(raw: unknown, symbol: HeliosCanonicalSymbol): HeliosNormalizedBook;
    normalizeCandle(raw: unknown, symbol: HeliosCanonicalSymbol): HeliosNormalizedCandle;
    normalizeOrderState(raw: unknown, symbol: HeliosCanonicalSymbol): HeliosNormalizedOrder;
    describeConnectivity(): VenueConnectivityProfile;
    describeReconciliation(): VenueReconciliationSemantics;
    /** Fixture-backed normalization checks used in CI qualification. */
    readonly normalizationFixtures: readonly HeliosVenueNormalizationFixture[];
    runNativeConformance(input: VenueConformanceRunInput): Promise<VenueConformanceReport>;
  }>;

export function assertHeliosVenueAdapter(adapter: HeliosVenueAdapter): HeliosVenueAdapter {
  if (adapter.liveOrderPlacementEnabled !== false || adapter.liveExecutionEnabled !== false) {
    throw new Error('HeliosVenueAdapter requires live execution disabled');
  }
  return Object.freeze(adapter);
}
