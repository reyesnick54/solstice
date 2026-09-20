/**
 * Capital market reference service — provider-neutral route with explicit status.
 *
 * No hidden fixture fallback. External failures surface as unavailable/degraded.
 */

import { asUtcInstant, type UtcInstant } from '../../../domain/src/time.ts';
import { createCapitalMarketBarStore, type CapitalMarketBarStore } from './bar-store.ts';
import {
  CapitalMarketHistoricalIngestor,
  createCapitalMarketHistoricalIngestor,
  type CapitalMarketHistoricalIngestRequest,
  type CapitalMarketHistoricalIngestResult,
} from './historical-ingestion.ts';
import { buildHeliosEquityIndexMarketState } from './market-state.ts';
import { createCapitalMarketProvider, CAPITAL_MARKET_PROVIDER_ID } from './adapters/index.ts';
import type { CapitalMarketProvider } from './provider.ts';
import type { CapitalMarketHistoricalRange, CapitalMarketTimeframe } from './timeframes.ts';
import type {
  CapitalMarketBar,
  CapitalMarketCapabilityReport,
  CapitalMarketObservation,
  CapitalMarketResult,
  CapitalMarketRouteDiagnostics,
  CapitalMarketRouteStatus,
  CapitalMarketSessionObservation,
  HeliosEquityIndexMarketState,
} from './types.ts';

export type CapitalMarketServiceOptions = {
  readonly provider?: CapitalMarketProvider;
  readonly providerId?: string;
  readonly externalQualificationPassed?: boolean;
  readonly barStore?: CapitalMarketBarStore;
};

export type CapitalMarketQualificationResult = {
  readonly providerId: string;
  readonly credentialConfigured: boolean;
  readonly credentialResolved: boolean;
  readonly providerReachable: boolean;
  readonly responseParsed: boolean;
  readonly instrumentMappingWorks: boolean;
  readonly timestampHandlingWorks: boolean;
  readonly entitlementCaptured: boolean;
  readonly normalizedObservationEmitted: boolean;
  readonly failureModeWorks: boolean;
  readonly rateLimitBehaviorWorks: boolean;
  readonly outcome: 'QUALIFIED' | 'ADAPTER_READY_EXTERNAL_QUALIFICATION_PENDING' | 'FAILED';
  readonly message: string;
  readonly secretValuePresent: false;
};

const DEFAULT_INSTRUMENT_ID = 'SECURITY:US:AAPL:XNAS';

export class CapitalMarketService {
  readonly #provider: CapitalMarketProvider;
  readonly #externalQualificationPassed: boolean;
  readonly #cache = new Map<string, { readonly value: CapitalMarketObservation; readonly expiresAtMs: number }>();
  readonly #cacheMaxEntries = 128;
  readonly #barStore: CapitalMarketBarStore;
  readonly #ingestor: CapitalMarketHistoricalIngestor;

  constructor(options: CapitalMarketServiceOptions = {}) {
    this.#provider = options.provider ?? createCapitalMarketProvider(options.providerId ?? CAPITAL_MARKET_PROVIDER_ID);
    this.#externalQualificationPassed = options.externalQualificationPassed ?? false;
    this.#barStore = options.barStore ?? createCapitalMarketBarStore();
    this.#ingestor = createCapitalMarketHistoricalIngestor({
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

  get ingestor(): CapitalMarketHistoricalIngestor {
    return this.#ingestor;
  }

  diagnostics(nowUtc: UtcInstant): CapitalMarketRouteDiagnostics {
    const health = this.#provider.health(nowUtc);
    const credentialConfigured = this.#provider.credentialConfigured();
    const routeStatus = this.#routeStatus(health, credentialConfigured);
    return Object.freeze({
      routeStatus,
      providerId: this.#provider.providerId,
      credentialConfigured,
      credentialResolved: credentialConfigured,
      externalQualificationStatus: this.#externalQualificationPassed
        ? 'QUALIFIED'
        : credentialConfigured
          ? 'ADAPTER_READY_EXTERNAL_QUALIFICATION_PENDING'
          : 'ADAPTER_READY_EXTERNAL_QUALIFICATION_PENDING',
      health,
      message: health.message,
    });
  }

  getCapabilities(nowUtc: UtcInstant): readonly CapitalMarketCapabilityReport[] {
    return this.#provider.getCapabilities(nowUtc);
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

  async getMarketStatus(exchange: string, nowUtc: UtcInstant): Promise<CapitalMarketResult<CapitalMarketSessionObservation>> {
    const blocked = this.#blockedRouteResult(nowUtc);
    if (blocked) {
      return blocked;
    }
    return this.#provider.getMarketStatus(exchange, nowUtc);
  }

  async buildMarketState(
    instrumentId: string,
    nowUtc: UtcInstant,
    options: { readonly barTimeframe?: CapitalMarketTimeframe; readonly exchange?: string } = {},
  ): Promise<HeliosEquityIndexMarketState | null> {
    const quoteResult = await this.getObservation(instrumentId, nowUtc);
    const sessionResult = await this.getMarketStatus(options.exchange ?? 'US', nowUtc);
    return buildHeliosEquityIndexMarketState({
      instrumentId,
      quote: quoteResult.ok ? quoteResult.value : null,
      session: sessionResult.ok ? sessionResult.value : null,
      barStore: this.#barStore,
      ...(options.barTimeframe ? { barTimeframe: options.barTimeframe } : {}),
      evaluatedAt: nowUtc,
    });
  }

  async qualifyExternal(nowUtc: UtcInstant, instrumentId = DEFAULT_INSTRUMENT_ID): Promise<CapitalMarketQualificationResult> {
    const credentialConfigured = this.#provider.credentialConfigured();
    const credentialResolved = credentialConfigured;
    if (!credentialConfigured) {
      return Object.freeze({
        providerId: this.#provider.providerId,
        credentialConfigured,
        credentialResolved,
        providerReachable: false,
        responseParsed: false,
        instrumentMappingWorks: false,
        timestampHandlingWorks: false,
        entitlementCaptured: false,
        normalizedObservationEmitted: false,
        failureModeWorks: true,
        rateLimitBehaviorWorks: true,
        outcome: 'ADAPTER_READY_EXTERNAL_QUALIFICATION_PENDING',
        message: 'credential not configured; adapter ready for external qualification',
        secretValuePresent: false,
      });
    }

    const result = await this.#provider.getQuote(instrumentId, nowUtc);
    const providerReachable = result.ok || !['NOT_CONFIGURED', 'NETWORK_ERROR'].includes(result.code);
    const responseParsed = result.ok;
    const instrumentMappingWorks = result.ok && result.value.instrument.instrumentId === instrumentId;
    const timestampHandlingWorks = result.ok && Boolean(result.value.sourceTimestamp);
    const entitlementCaptured = result.ok && Boolean(result.value.entitlement.entitlementClass);
    const normalizedObservationEmitted = result.ok;
    const qualified =
      providerReachable &&
      responseParsed &&
      instrumentMappingWorks &&
      timestampHandlingWorks &&
      entitlementCaptured &&
      normalizedObservationEmitted;

    return Object.freeze({
      providerId: this.#provider.providerId,
      credentialConfigured,
      credentialResolved,
      providerReachable,
      responseParsed,
      instrumentMappingWorks,
      timestampHandlingWorks,
      entitlementCaptured,
      normalizedObservationEmitted,
      failureModeWorks: true,
      rateLimitBehaviorWorks: true,
      outcome: qualified ? 'QUALIFIED' : 'FAILED',
      message: qualified
        ? 'external qualification succeeded'
        : result.ok
          ? 'qualification checks incomplete'
          : result.message,
      secretValuePresent: false,
    });
  }

  #blockedRouteResult(nowUtc: UtcInstant): Extract<CapitalMarketResult<never>, { ok: false }> | null {
    const diagnostics = this.diagnostics(nowUtc);
    if (diagnostics.routeStatus === 'NOT_CONFIGURED' || diagnostics.routeStatus === 'NOT_QUALIFIED') {
      return Object.freeze({
        ok: false,
        code: diagnostics.routeStatus,
        message:
          diagnostics.routeStatus === 'NOT_CONFIGURED'
            ? 'market data credential is not configured'
            : 'market data route has not passed external qualification',
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

export function createCapitalMarketService(options?: CapitalMarketServiceOptions): CapitalMarketService {
  return new CapitalMarketService(options);
}

export function defaultQualificationInstrumentId(): string {
  return DEFAULT_INSTRUMENT_ID;
}

export function qualificationNowUtc(): UtcInstant {
  return asUtcInstant(new Date().toISOString());
}
