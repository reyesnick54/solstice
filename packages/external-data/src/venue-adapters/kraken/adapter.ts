/**
 * Kraken HELIOS venue adapter — fixture-backed conformance, optional readonly live probe.
 *
 * Does not implement private signing or authenticated trading endpoints.
 */

import {
  createVenueAdapterContract,
  KRAKEN_OS04_QUALIFICATION_PROFILE,
  runVenueAdapterConformance,
  type HeliosVenueAdapterContract,
  type VenueConformanceRunInput,
  type VenueMarketDataProbeRequest,
  type VenueMarketDataProbeResult,
} from '../../../../provider-sdk/src/venue/index.ts';
import { HELIOS_VENUE_ADAPTER_SCHEMA_VERSION } from '../../../../provider-sdk/src/venue/taxonomy.ts';
import { KRAKEN_VENUE_MANIFEST } from './manifest.ts';
import { krakenFixtureLastPrice } from './fixtures.ts';

const KRAKEN_PUBLIC_TICKER_URL = 'https://api.kraken.com/0/public/Ticker?pair=XBTUSD';

async function probeKrakenReadonlyLive(symbol: string): Promise<VenueMarketDataProbeResult> {
  try {
    const response = await fetch(KRAKEN_PUBLIC_TICKER_URL, { method: 'GET' });
    if (!response.ok) {
      return Object.freeze({ ok: false, reason: `Kraken HTTP ${response.status}` });
    }
    const payload: unknown = await response.json();
    if (
      typeof payload !== 'object' ||
      payload === null ||
      !('result' in payload) ||
      typeof (payload as { result: unknown }).result !== 'object'
    ) {
      return Object.freeze({ ok: false, reason: 'unexpected Kraken ticker payload' });
    }
    const result = (payload as { result: Record<string, { c?: string[] }> }).result;
    const row = result.XXBTZUSD ?? result.XBTUSD;
    const price = row?.c?.[0];
    if (!price) {
      return Object.freeze({ ok: false, reason: 'Kraken ticker missing last price' });
    }
    return Object.freeze({
      ok: true,
      symbol,
      lastPrice: price,
      observedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Object.freeze({ ok: false, reason: message });
  }
}

export function createKrakenVenueAdapter(): HeliosVenueAdapterContract {
  return createVenueAdapterContract(
    Object.freeze({
      venueId: 'kraken',
      adapterSchemaVersion: HELIOS_VENUE_ADAPTER_SCHEMA_VERSION,
      liveOrderPlacementEnabled: false,
      manifest() {
        return KRAKEN_VENUE_MANIFEST;
      },
      async runConformance(runInput: VenueConformanceRunInput) {
        return runVenueAdapterConformance(this, runInput, KRAKEN_OS04_QUALIFICATION_PROFILE);
      },
      async probeMarketData(request: VenueMarketDataProbeRequest): Promise<VenueMarketDataProbeResult> {
        if (request.qualificationMode === 'readonly_live') {
          return probeKrakenReadonlyLive(request.symbol);
        }
        const price = krakenFixtureLastPrice(request.symbol);
        if (!price) {
          return Object.freeze({
            ok: false,
            reason: `no fixture for symbol ${request.symbol}`,
          });
        }
        return Object.freeze({
          ok: true,
          symbol: request.symbol,
          lastPrice: price,
          observedAt: '2026-09-21T12:00:00.000Z',
        });
      },
    }),
  );
}

export const KRAKEN_VENUE_ADAPTER = createKrakenVenueAdapter();
