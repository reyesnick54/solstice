/**
 * HELIOS M06 — crypto spot market reference service.
 *
 * Reuses capital-market route semantics with crypto-specific provider wiring.
 * No hidden fixture fallback. Research-only execution posture preserved.
 */

import { asUtcInstant, type UtcInstant } from '@solstice/domain';
import { createCapitalMarketBarStore, latestBarForInstrument, type CapitalMarketBarStore } from '../../capital-market/bar-store.ts';
import {
  CapitalMarketHistoricalIngestor,
  type CapitalMarketHistoricalIngestRequest,
  type CapitalMarketHistoricalIngestResult,
} from '../../capital-market/historical-ingestion.ts';
import type { CapitalMarketProvider } from '../../capital-market/provider.ts';
import type {
  CapitalMarketBar,
  CapitalMarketObservation,
  CapitalMarketResult,
  CapitalMarketRouteDiagnostics,
  CapitalMarketRouteStatus,
  CapitalMarketSessionObservation,
} from '../../capital-market/types.ts';
import type { CapitalMarketHistoricalRange, CapitalMarketTimeframe } from '../../capital-market/timeframes.ts';
import { createCoingeckoCryptoSpotAdapter, COINGECKO_PROVIDER_ID } from './adapters/coingecko-adapter.ts';
import { buildHeliosCryptoSpotMarketState } from './market-state.ts';
import type { HeliosCryptoSpotMarketState } from '../../capital-market/types.ts';

export type CryptoSpotMarketServiceOptions = {
  readonly provider?: CapitalMarketProvider;
  readonly providerId?: string;
  readonly externalQualificationPassed?: boolean;
  readonly barStore?: CapitalMarketBarStore;
};

export class CryptoSpotMarketService {
  readonly #provider: CapitalMarketProvider;
  readonly #externalQualificationPassed: boolean;
  readonly #barStore: CapitalMarketBarStore;
  readonly #ingestor: CapitalMarketHistoricalIngestor;
  readonly #cache = new Map<string, { readonly value: CapitalMarketObservation; readonly expiresAtMs: number }>();
  readonly #cacheMaxEntries = 128;

  constructor(options: CryptoSpotMarketServiceOptions = {}) {
    this.#provider =
      options.provider ??
      createCoingeckoCryptoSpotAdapter(
        options.providerId && options.providerId !== COINGECKO_PROVIDER_ID
          ? { credentialEnvVar: `${options.providerId.toUpperCase()}_API_KEY` }
          : {},
      );
    this.#externalQualificationPassed = options.externalQualificationPassed ?? false;
    this.#barStore = options.barStore ?? createCapitalMarketBarStore();
    this.#ingestor = new CapitalMarketHistoricalIngestor({
      provider: this.#provider,
      store: this.#barStore,
    });
  }

  get provider(): CapitalMarketProvider {
    return this.#provider;
  }

  get barStore(): CapitalMarketBarStore {
    return this.#barStore;
  }

  diagnostics(nowUtc: UtcInstant): CapitalMarketRouteDiagnostics {
    const health = this.#provider.health(nowUtc);
    const credentialConfigured = this.#provider.credentialConfigured();
    return Object.freeze({
      routeStatus: this.#routeStatus(health, credentialConfigured),
      providerId: this.#provider.providerId,
      credentialConfigured,
      credentialResolved: credentialConfigured,
      externalQualificationStatus: this.#externalQualificationPassed
        ? 'QUALIFIED'
        : 'ADAPTER_READY_EXTERNAL_QUALIFICATION_PENDING',
      health,
      message: health.message,
    });
  }

  async getObservation(instrumentId: string, nowUtc: UtcInstant): Promise<CapitalMarketResult<CapitalMarketObservation>> {
    const blocked = this.#blockedRouteResult(nowUtc);
    if (blocked) {
      return blocked;
    }

    const cacheKey = `${this.#provider.providerId}:${instrumentId}`;
    const cached = this.#cache.get(cacheKey);
    if (cached && cached.expiresAtMs > Date.now()) {
      return Object.freeze({ ok: true, value: cached.value, fromCache: true });
    }

    const result = await this.#provider.getQuote(instrumentId, nowUtc);
    if (result.ok) {
      this.#writeCache(cacheKey, result.value);
    }
    return result;
  }

  async getHistoricalBars(
    instrumentId: string,
    timeframe: CapitalMarketTimeframe,
    range: CapitalMarketHistoricalRange,
    nowUtc: UtcInstant,
  ): Promise<CapitalMarketResult<readonly CapitalMarketBar[]>> {
    const blocked = this.#blockedRouteResult(nowUtc);
    if (blocked) {
      return blocked;
    }
    return this.#provider.getHistoricalBars(instrumentId, timeframe, range, nowUtc);
  }

  async ingestHistoricalBars(
    request: CapitalMarketHistoricalIngestRequest,
  ): Promise<CapitalMarketHistoricalIngestResult> {
    const blocked = this.#blockedRouteResult(request.nowUtc);
    if (blocked) {
      return Object.freeze({
        ok: false,
        code: blocked.code,
        message: blocked.message,
        providerId: blocked.providerId,
        qualityReport: null,
      });
    }
    return this.#ingestor.ingest(request);
  }

  async getVenueStatus(exchange: string, nowUtc: UtcInstant): Promise<CapitalMarketResult<CapitalMarketSessionObservation>> {
    const blocked = this.#blockedRouteResult(nowUtc);
    if (blocked) {
      return blocked;
    }
    return this.#provider.getMarketStatus(exchange, nowUtc);
  }

  async buildMarketState(
    instrumentId: string,
    nowUtc: UtcInstant,
    options: { readonly barTimeframe?: CapitalMarketTimeframe; readonly staleQuote?: boolean } = {},
  ): Promise<HeliosCryptoSpotMarketState | null> {
    const quoteResult = await this.getObservation(instrumentId, nowUtc);
    const sessionResult = await this.getVenueStatus('CRYPTO_GLOBAL', nowUtc);
    const timeframe = options.barTimeframe ?? '1h';
    const latestBar = latestBarForInstrument(this.#barStore.list(), instrumentId, timeframe) ?? null;
    return buildHeliosCryptoSpotMarketState({
      instrumentId,
      quote: quoteResult.ok ? quoteResult.value : null,
      session: sessionResult.ok ? sessionResult.value : null,
      latestBar,
      barStore: this.#barStore,
      barTimeframe: timeframe,
      evaluatedAt: nowUtc,
      ...(options.staleQuote ? { staleQuote: true } : {}),
    });
  }

  #blockedRouteResult(nowUtc: UtcInstant): CapitalMarketResult<never> | null {
    const diagnostics = this.diagnostics(nowUtc);
    if (diagnostics.routeStatus === 'NOT_CONFIGURED' || diagnostics.routeStatus === 'NOT_QUALIFIED') {
      return Object.freeze({
        ok: false,
        code: diagnostics.routeStatus,
        message:
          diagnostics.routeStatus === 'NOT_CONFIGURED'
            ? 'crypto spot market data route is not configured'
            : 'crypto spot market data route has not passed external qualification',
        providerId: this.#provider.providerId,
      });
    }
    return null;
  }

  #routeStatus(
    health: ReturnType<CapitalMarketProvider['health']>,
    credentialConfigured: boolean,
  ): CapitalMarketRouteStatus {
    if (!credentialConfigured) {
      return 'NOT_CONFIGURED';
    }
    if (!this.#externalQualificationPassed) {
      return 'NOT_QUALIFIED';
    }
    if (health.status === 'unavailable') {
      return 'UNAVAILABLE';
    }
    if (health.status === 'degraded') {
      return 'DEGRADED';
    }
    return 'QUALIFIED';
  }

  #writeCache(key: string, value: CapitalMarketObservation): void {
    if (this.#cache.size >= this.#cacheMaxEntries) {
      const oldest = this.#cache.keys().next().value;
      if (oldest) {
        this.#cache.delete(oldest);
      }
    }
    this.#cache.set(key, { value, expiresAtMs: Date.now() + 30_000 });
  }
}

export function createCryptoSpotMarketService(options?: CryptoSpotMarketServiceOptions): CryptoSpotMarketService {
  return new CryptoSpotMarketService(options);
}

export function cryptoSpotQualificationNowUtc(): UtcInstant {
  return asUtcInstant(new Date().toISOString());
}
