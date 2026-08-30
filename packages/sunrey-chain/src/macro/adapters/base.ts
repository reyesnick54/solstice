/**
 * Shared macro adapter infrastructure — HttpProviderTransport only, no direct fetch.
 */

import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { asUtcInstant } from '../../../../domain/src/time.ts';
import type { ProviderAuthResolver } from '../../../../provider-sdk/src/auth.ts';
import {
  buildExternalObservation,
  MACRO_STATISTIC_FRESHNESS_POLICY,
  parseUntrustedJson,
  runNormalizationPipeline,
  type NormalizationPipeline,
  type RawProviderResponse,
} from '../../../../provider-sdk/src/index.ts';
import { ProviderReliabilityControlPlane } from '../../../../provider-sdk/src/reliability.ts';
import type {
  AuthorityClass,
  ExternalObservation,
  HttpProviderTransport,
  HttpProviderTransportResult,
  HttpProviderRequestContext,
  ProviderCategory,
  ProviderHealthStatus,
  ProviderHttpMethod,
  ProviderResult,
} from '../../../../provider-sdk/src/types.ts';
import type {
  ReliabilityTransport,
  ReliabilityTransportRequest,
  ReliabilityTransportResponse,
} from '../../../../provider-sdk/src/reliability-types.ts';
import type { MacroCatalogProviderId } from '../catalog-entries.ts';
import { normalizeCountryCode } from '../country.ts';
import { resolveCanonicalIndicatorId } from '../indicator-mapping.ts';
import type {
  MacroIndicator,
  MacroIndicatorFrequency,
  MacroRevisionStatus,
  MacroSeasonalAdjustment,
  MacroTimeSeries,
  MacroTimeSeriesPoint,
} from '../types.ts';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

export type MacroAdapterContext = {
  readonly transport: HttpProviderTransport;
  readonly authResolver: ProviderAuthResolver;
  readonly reliability: ProviderReliabilityControlPlane;
  readonly nowUtc: () => string;
  readonly simulationOnly: boolean;
};

export type MacroAdapter = {
  readonly providerId: MacroCatalogProviderId;
  fetchIndicator(
    nativeId: string,
    country?: string,
  ): Promise<ProviderResult<ExternalObservation<MacroIndicator>>>;
  fetchTimeSeries(
    nativeId: string,
    country?: string,
    limit?: number,
  ): Promise<ProviderResult<ExternalObservation<MacroTimeSeries>>>;
  healthCheck(): Promise<ProviderHealthStatus>;
};

export type MacroAdapterConfig = {
  readonly providerId: MacroCatalogProviderId;
  readonly baseUrl: string;
  readonly authorityClass: AuthorityClass;
  readonly providerCategory: ProviderCategory;
  readonly capability?: string;
  readonly fixtureFile: string;
  readonly indicatorPath: string;
  readonly seriesPath?: string;
  readonly defaultCountry?: string;
  readonly providerSchemaVersion: string;
};

export type MacroAdapterDeps = {
  readonly context: MacroAdapterContext;
  readonly config: MacroAdapterConfig;
};

type FixtureRoute = {
  readonly method: string;
  readonly pathPattern: RegExp;
  readonly fixture: unknown;
};

export class HttpTransportReliabilityBridge implements ReliabilityTransport {
  readonly providerId: string;
  readonly #transport: HttpProviderTransport;

  constructor(providerId: string, transport: HttpProviderTransport) {
    this.providerId = providerId;
    this.#transport = transport;
    Object.freeze(this);
  }

  async execute(
    request: ReliabilityTransportRequest,
    _options?: { readonly signal?: AbortSignal; readonly deadlineMs?: number },
  ): Promise<ReliabilityTransportResponse> {
    const result = await this.#transport.request({
      providerId: this.providerId,
      requestId: randomUUID(),
      method: request.method as ProviderHttpMethod,
      path: request.path,
      headers: request.headers,
      body: request.body !== undefined ? JSON.stringify(request.body) : undefined,
    });
    if (!result.ok) {
      throw new Error(result.error.message);
    }
    return Object.freeze({
      status: result.value.metadata.httpStatus,
      headers: Object.freeze({}),
      body: result.value.parsed ?? result.value.body,
    });
  }
}

export class FixtureTransport implements HttpProviderTransport {
  readonly transportId = 'macro.fixture-transport';
  readonly #providerId: string;
  readonly #routes: readonly FixtureRoute[];
  readonly #defaultFixture: unknown;

  constructor(
    providerId: string,
    fixtureFile: string,
    routes: readonly FixtureRoute[] = [],
  ) {
    this.#providerId = providerId;
    this.#defaultFixture = loadFixture(fixtureFile);
    this.#routes = routes;
    Object.freeze(this);
  }

  async request<T = unknown>(context: HttpProviderRequestContext): Promise<HttpProviderTransportResult<T>> {
    const startedAt = new Date().toISOString();
    const route = this.#routes.find(
      (entry) => entry.method === context.method && entry.pathPattern.test(context.path),
    );
    const body = route?.fixture ?? this.#defaultFixture;
    const rawText = JSON.stringify(body);
    return Object.freeze({
      ok: true,
      value: Object.freeze({
        metadata: Object.freeze({
          providerId: context.providerId,
          requestId: context.requestId,
          traceId: context.traceId ?? context.requestId,
          httpStatus: 200,
          durationMs: 1,
          contentType: 'application/json',
          providerRequestId: null,
          startedAtUtc: startedAt,
          finalUrl: `${this.#providerId}:${context.path}`,
        }),
        body: Object.freeze({ format: 'json' as const, value: body }),
        parsed: body as T,
      }),
    });
  }
}

export function loadFixture(fileName: string): unknown {
  const text = readFileSync(join(FIXTURES_DIR, fileName), 'utf8');
  return JSON.parse(text) as unknown;
}

export function createFixtureTransport(config: MacroAdapterConfig): FixtureTransport {
  return new FixtureTransport(config.providerId, config.fixtureFile, [
    Object.freeze({
      method: 'GET',
      pathPattern: new RegExp(`^${escapeRegex(config.indicatorPath)}`),
      fixture: loadFixture(config.fixtureFile),
    }),
    ...(config.seriesPath
      ? [
          Object.freeze({
            method: 'GET',
            pathPattern: new RegExp(`^${escapeRegex(config.seriesPath)}`),
            fixture: loadFixture(config.fixtureFile),
          }),
        ]
      : []),
  ]);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function createMacroAdapterHelpers(
  ctx: MacroAdapterContext,
  options: {
    readonly providerId: MacroCatalogProviderId;
    readonly authorityClass: AuthorityClass;
    readonly providerCategory: ProviderCategory;
    readonly capability?: string;
    readonly providerSchemaVersion: string;
  },
) {
  const capability = options.capability ?? 'macroeconomic_indicators';

  const reliabilityBridge = new HttpTransportReliabilityBridge(options.providerId, ctx.transport);

  async function fetchJson(path: string, query?: Readonly<Record<string, string | number | boolean>>) {
    const requestId = randomUUID();
    const queryString =
      query && Object.keys(query).length > 0
        ? `?${new URLSearchParams(
            Object.fromEntries(Object.entries(query).map(([key, value]) => [key, String(value)])),
          ).toString()}`
        : '';
    const result = await ctx.reliability.execute(reliabilityBridge, {
      method: 'GET',
      path: `${path}${queryString}`,
    });
    if (!result.ok) {
      return { ok: false as const, code: result.error.code, message: result.error.message };
    }
    const body = result.value.body;
    const transportResult: HttpProviderTransportResult<unknown> = Object.freeze({
      ok: true,
      value: Object.freeze({
        metadata: Object.freeze({
          providerId: options.providerId,
          requestId,
          traceId: requestId,
          httpStatus: result.value.status,
          durationMs: result.durationMs,
          contentType: 'application/json',
          providerRequestId: null,
          startedAtUtc: ctx.nowUtc(),
          finalUrl: `${options.providerId}:${path}`,
        }),
        body: Object.freeze({ format: 'json' as const, value: body }),
        parsed: body,
      }),
    });
    if (!transportResult.ok) {
      return { ok: false as const, code: 'TRANSPORT_ERROR', message: 'transport failed' };
    }
    return { ok: true as const, value: transportResult.value, requestId };
  }

  function normalizeToObservation<TDomain>(
    input: {
      readonly rawPayload: string;
      readonly requestId: string;
      readonly domainData: TDomain;
      readonly dataset: string;
      readonly sourceUrl?: string | null;
      readonly sourceTimestamp?: string | null;
      readonly effectiveAt?: string | null;
    },
    pipeline?: NormalizationPipeline<unknown, TDomain>,
  ): ProviderResult<ExternalObservation<TDomain>> {
    const raw: RawProviderResponse = Object.freeze({
      providerId: options.providerId,
      capability,
      requestId: input.requestId,
      retrievedAt: ctx.nowUtc(),
      rawPayload: input.rawPayload,
      sourceUrl: input.sourceUrl ?? null,
      providerSchemaVersion: options.providerSchemaVersion,
    });

    if (pipeline) {
      return runNormalizationPipeline(pipeline, raw);
    }

    return buildExternalObservation({
      providerId: options.providerId,
      providerCategory: options.providerCategory,
      capability,
      data: input.domainData,
      source: {
        provider: options.providerId,
        dataset: input.dataset,
        sourceUrl: input.sourceUrl ?? null,
      },
      time: {
        retrievedAt: asUtcInstant(ctx.nowUtc()),
        sourceTimestamp: input.sourceTimestamp ? asUtcInstant(input.sourceTimestamp) : null,
        effectiveAt: input.effectiveAt ? asUtcInstant(input.effectiveAt) : null,
      },
      authorityClass: options.authorityClass,
      provenance: {
        requestId: input.requestId,
        rawPayload: input.rawPayload,
        providerSchemaVersion: options.providerSchemaVersion,
      },
      freshnessPolicy: MACRO_STATISTIC_FRESHNESS_POLICY,
    });
  }

  async function healthCheck(): Promise<ProviderHealthStatus> {
    const started = Date.now();
    const requestId = randomUUID();
    const result = await ctx.transport.request({
      providerId: options.providerId,
      requestId,
      method: 'GET',
      path: '/health',
    });
    const latencyMs = Date.now() - started;
    if (result.ok) {
      return Object.freeze({
        providerId: options.providerId,
        state: 'healthy',
        status: 'ready',
        checkedAt: ctx.nowUtc(),
        message: ctx.simulationOnly ? 'fixture transport healthy' : 'provider reachable',
        latencyMs,
      });
    }
    return Object.freeze({
      providerId: options.providerId,
      state: 'unhealthy',
      status: 'unhealthy',
      checkedAt: ctx.nowUtc(),
      message: result.error.message,
      latencyMs,
    });
  }

  return Object.freeze({ fetchJson, normalizeToObservation, healthCheck, capability });
}

export function mapFrequency(input: string | null | undefined): MacroIndicatorFrequency {
  if (!input) {
    return 'unknown';
  }
  const normalized = input.toLowerCase();
  if (normalized.includes('annual') || normalized === 'a' || normalized === 'y') {
    return 'annual';
  }
  if (normalized.includes('quarter') || normalized === 'q') {
    return 'quarterly';
  }
  if (normalized.includes('month') || normalized === 'm') {
    return 'monthly';
  }
  if (normalized.includes('week') || normalized === 'w') {
    return 'weekly';
  }
  if (normalized.includes('day') || normalized === 'd') {
    return 'daily';
  }
  if (normalized.includes('intra')) {
    return 'intraday';
  }
  return 'unknown';
}

export function mapRevisionStatus(input: string | null | undefined): MacroRevisionStatus {
  if (!input) {
    return 'unknown';
  }
  const normalized = input.toLowerCase();
  if (normalized.includes('prelim')) {
    return 'preliminary';
  }
  if (normalized.includes('revis')) {
    return 'revised';
  }
  if (normalized.includes('final')) {
    return 'final';
  }
  return 'unknown';
}

export function mapSeasonalAdjustment(input: string | null | undefined): MacroSeasonalAdjustment {
  if (!input) {
    return 'unknown';
  }
  const normalized = input.toLowerCase();
  if (normalized.includes('seasonally') || normalized.includes('adjusted')) {
    return 'seasonally_adjusted';
  }
  if (normalized.includes('not') || normalized.includes('unadjusted')) {
    return 'not_adjusted';
  }
  return 'unknown';
}

export function parseNumericValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value !== '.' && value.length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function createStandardMacroAdapter(deps: MacroAdapterDeps): MacroAdapter {
  const { context, config } = deps;
  const helpers = createMacroAdapterHelpers(context, {
    providerId: config.providerId,
    authorityClass: config.authorityClass,
    providerCategory: config.providerCategory,
    providerSchemaVersion: config.providerSchemaVersion,
  });

  return Object.freeze({
    providerId: config.providerId,
    async fetchIndicator(nativeId, country) {
      const countryCode = country ? normalizeCountryCode(country) : config.defaultCountry ?? null;
      const path = config.indicatorPath.replace('{series_id}', nativeId).replace('{indicator}', nativeId);
      const query: Record<string, string> = {};
      if (countryCode && countryCode !== 'GLOBAL') {
        query.country = countryCode;
      }
      const fetched = await helpers.fetchJson(path, query);
      if (!fetched.ok) {
        return { ok: false, code: fetched.code, message: fetched.message };
      }
      const rawText = JSON.stringify(fetched.value.parsed ?? fetched.value.body);
      const indicatorResult = mapProviderPayloadToIndicator(config, fetched.value.parsed ?? JSON.parse(rawText));
      if (!indicatorResult.ok) {
        return indicatorResult;
      }
      const canonicalId = resolveCanonicalIndicatorId(config.providerId, nativeId);
      const indicator = Object.freeze({
        ...indicatorResult.value,
        indicatorId: canonicalId ?? indicatorResult.value.indicatorId,
        country: countryCode ?? indicatorResult.value.country,
        sourceObservation: null,
      });
      return helpers.normalizeToObservation({
        rawPayload: rawText,
        requestId: fetched.requestId,
        domainData: indicator,
        dataset: nativeId,
        sourceTimestamp: indicator.effectiveDate,
        effectiveAt: indicator.effectiveDate,
      });
    },
    async fetchTimeSeries(nativeId, country, limit = 100) {
      const countryCode = country ? normalizeCountryCode(country) : config.defaultCountry ?? null;
      const path = (config.seriesPath ?? config.indicatorPath)
        .replace('{series_id}', nativeId)
        .replace('{indicator}', nativeId);
      const query: Record<string, string | number> = { limit };
      if (countryCode && countryCode !== 'GLOBAL') {
        query.country = countryCode;
      }
      const fetched = await helpers.fetchJson(path, query);
      if (!fetched.ok) {
        return { ok: false, code: fetched.code, message: fetched.message };
      }
      const rawText = JSON.stringify(fetched.value.parsed ?? fetched.value.body);
      const seriesResult = mapProviderPayloadToTimeSeries(config, fetched.value.parsed ?? JSON.parse(rawText), limit);
      if (!seriesResult.ok) {
        return seriesResult;
      }
      const canonicalId = resolveCanonicalIndicatorId(config.providerId, nativeId);
      const series = Object.freeze({
        ...seriesResult.value,
        indicatorId: canonicalId ?? seriesResult.value.indicatorId,
        country: countryCode ?? seriesResult.value.country,
        sourceObservation: null,
      });
      return helpers.normalizeToObservation({
        rawPayload: rawText,
        requestId: fetched.requestId,
        domainData: series,
        dataset: `${nativeId}/series`,
        sourceTimestamp: series.points.at(-1)?.effectiveDate ?? null,
        effectiveAt: series.points.at(-1)?.effectiveDate ?? null,
      });
    },
    healthCheck: () => helpers.healthCheck(),
  });
}

function mapProviderPayloadToIndicator(
  config: MacroAdapterConfig,
  payload: unknown,
): ProviderResult<MacroIndicator> {
  switch (config.providerId) {
    case 'fred':
      return mapFredIndicator(payload);
    case 'world-bank':
      return mapWorldBankIndicator(payload);
    case 'econdb':
      return mapEcondbIndicator(payload);
    case 'us-treasury-fiscaldata':
      return mapTreasuryIndicator(payload);
    case 'data-usa':
      return mapDataUsaIndicator(payload);
    case 'census-gov':
      return mapCensusIndicator(payload);
    case 'saudi-open-data':
      return mapSaudiIndicator(payload);
    case 'usaspending':
      return mapUsaSpendingIndicator(payload);
    case 'federal-register':
      return mapFederalRegisterIndicator(payload);
    default:
      return { ok: false, code: 'UNSUPPORTED_PROVIDER', message: `unsupported provider ${config.providerId}` };
  }
}

function mapProviderPayloadToTimeSeries(
  config: MacroAdapterConfig,
  payload: unknown,
  limit = 100,
): ProviderResult<MacroTimeSeries> {
  const indicator = mapProviderPayloadToIndicator(config, payload);
  if (!indicator.ok) {
    return indicator;
  }
  const points = extractTimeSeriesPoints(config.providerId, payload, limit);
  return {
    ok: true,
    value: Object.freeze({
      indicatorId: indicator.value.indicatorId,
      name: indicator.value.name,
      country: indicator.value.country,
      frequency: indicator.value.frequency,
      unit: indicator.value.unit,
      points,
      sourceObservation: null,
    }),
  };
}

function extractTimeSeriesPoints(
  providerId: MacroCatalogProviderId,
  payload: unknown,
  limit: number,
): readonly MacroTimeSeriesPoint[] {
  const points: MacroTimeSeriesPoint[] = [];
  if (providerId === 'fred' && typeof payload === 'object' && payload !== null && 'observations' in payload) {
    const observations = (payload as { observations: Array<{ date: string; value: string }> }).observations;
    for (const obs of observations.slice(-limit)) {
      points.push(
        Object.freeze({
          period: obs.date,
          effectiveDate: `${obs.date}T00:00:00.000Z`,
          value: parseNumericValue(obs.value),
          revisionStatus: 'final',
        }),
      );
    }
  } else if (providerId === 'world-bank' && Array.isArray(payload)) {
    for (const row of payload.slice(-limit)) {
      const record = row as { date: string; value: number };
      points.push(
        Object.freeze({
          period: record.date,
          effectiveDate: `${record.date}-01-01T00:00:00.000Z`,
          value: parseNumericValue(record.value),
          revisionStatus: 'final',
        }),
      );
    }
  } else if (providerId === 'econdb' && typeof payload === 'object' && payload !== null && 'results' in payload) {
    const results = (payload as { results: Array<{ values: Array<{ date: string; value: number }> }> }).results;
    const values = results[0]?.values ?? [];
    for (const obs of values.slice(-limit)) {
      points.push(
        Object.freeze({
          period: obs.date,
          effectiveDate: `${obs.date}T00:00:00.000Z`,
          value: parseNumericValue(obs.value),
          revisionStatus: 'final',
        }),
      );
    }
  } else if (
    providerId === 'us-treasury-fiscaldata' &&
    typeof payload === 'object' &&
    payload !== null &&
    'data' in payload
  ) {
    const data = (payload as { data: Array<{ record_date: string; avg_interest_rate_amt: string }> }).data;
    for (const row of data.slice(-limit)) {
      points.push(
        Object.freeze({
          period: row.record_date,
          effectiveDate: `${row.record_date}T00:00:00.000Z`,
          value: parseNumericValue(row.avg_interest_rate_amt),
          revisionStatus: 'final',
        }),
      );
    }
  }
  if (points.length === 0 && typeof payload === 'object' && payload !== null) {
    const indicator = mapProviderPayloadToIndicator({ providerId } as MacroAdapterConfig, payload);
    if (indicator.ok && indicator.value.value !== null) {
      points.push(
        Object.freeze({
          period: indicator.value.period ?? 'latest',
          effectiveDate: indicator.value.effectiveDate,
          value: indicator.value.value,
          revisionStatus: indicator.value.revisionStatus,
        }),
      );
    }
  }
  return Object.freeze(points);
}

function mapFredIndicator(payload: unknown): ProviderResult<MacroIndicator> {
  const record = payload as {
    seriess?: Array<{
      id: string;
      title: string;
      units: string;
      frequency: string;
      seasonal_adjustment: string;
      last_updated: string;
    }>;
    observations?: Array<{ date: string; value: string }>;
  };
  const series = record.seriess?.[0];
  const latest = record.observations?.at(-1);
  return {
    ok: true,
    value: Object.freeze({
      indicatorId: series?.id ?? 'unknown',
      name: series?.title ?? 'FRED Series',
      description: series?.title ?? null,
      value: parseNumericValue(latest?.value),
      unit: series?.units ?? null,
      frequency: mapFrequency(series?.frequency ?? null),
      country: 'US',
      region: null,
      currency: null,
      period: latest?.date ?? null,
      effectiveDate: latest?.date ? `${latest.date}T00:00:00.000Z` : null,
      releaseDate: series?.last_updated ? `${series.last_updated}T00:00:00.000Z` : null,
      revisionStatus: 'final',
      seasonalAdjustment: mapSeasonalAdjustment(series?.seasonal_adjustment ?? null),
      sourceObservation: null,
    }),
  };
}

function mapWorldBankIndicator(payload: unknown): ProviderResult<MacroIndicator> {
  const rows = Array.isArray(payload) ? payload : [];
  const latest = rows.at(-1) as
    | { indicator: { id: string; value: string }; country: { id: string }; date: string; value: number }
    | undefined;
  if (!latest) {
    return { ok: false, code: 'SCHEMA_INVALID', message: 'missing world bank rows' };
  }
  return {
    ok: true,
    value: Object.freeze({
      indicatorId: latest.indicator.id,
      name: latest.indicator.value,
      description: latest.indicator.value,
      value: parseNumericValue(latest.value),
      unit: 'USD',
      frequency: 'annual',
      country: latest.country.id,
      region: null,
      currency: 'USD',
      period: latest.date,
      effectiveDate: `${latest.date}-01-01T00:00:00.000Z`,
      releaseDate: null,
      revisionStatus: 'final',
      seasonalAdjustment: 'unknown',
      sourceObservation: null,
    }),
  };
}

function mapEcondbIndicator(payload: unknown): ProviderResult<MacroIndicator> {
  const record = payload as {
    results?: Array<{
      series: string;
      name: string;
      country: string;
      frequency: string;
      unit: string;
      values: Array<{ date: string; value: number }>;
    }>;
  };
  const series = record.results?.[0];
  const latest = series?.values?.at(-1);
  return {
    ok: true,
    value: Object.freeze({
      indicatorId: series?.series ?? 'unknown',
      name: series?.name ?? 'Econdb Series',
      description: series?.name ?? null,
      value: parseNumericValue(latest?.value),
      unit: series?.unit ?? null,
      frequency: mapFrequency(series?.frequency ?? null),
      country: series?.country ?? null,
      region: null,
      currency: null,
      period: latest?.date ?? null,
      effectiveDate: latest?.date ? `${latest.date}T00:00:00.000Z` : null,
      releaseDate: null,
      revisionStatus: 'final',
      seasonalAdjustment: 'unknown',
      sourceObservation: null,
    }),
  };
}

function mapTreasuryIndicator(payload: unknown): ProviderResult<MacroIndicator> {
  const record = payload as {
    data?: Array<{ record_date: string; security_desc: string; avg_interest_rate_amt: string }>;
  };
  const latest = record.data?.at(-1);
  return {
    ok: true,
    value: Object.freeze({
      indicatorId: 'avg_interest_rates',
      name: latest?.security_desc ?? 'Treasury Interest Rate',
      description: 'U.S. Treasury average interest rate',
      value: parseNumericValue(latest?.avg_interest_rate_amt),
      unit: 'percent',
      frequency: 'monthly',
      country: 'US',
      region: null,
      currency: 'USD',
      period: latest?.record_date ?? null,
      effectiveDate: latest?.record_date ? `${latest.record_date}T00:00:00.000Z` : null,
      releaseDate: null,
      revisionStatus: 'final',
      seasonalAdjustment: 'not_adjusted',
      sourceObservation: null,
    }),
  };
}

function mapDataUsaIndicator(payload: unknown): ProviderResult<MacroIndicator> {
  const record = payload as { data?: Array<Record<string, unknown>> };
  const row = record.data?.[0];
  const population = row ? parseNumericValue(row['Total Population']) : null;
  return {
    ok: true,
    value: Object.freeze({
      indicatorId: 'acs_yg_total_population_1',
      name: 'Total Population',
      description: 'U.S. total population from ACS',
      value: population,
      unit: 'persons',
      frequency: 'annual',
      country: 'US',
      region: null,
      currency: null,
      period: row?.Year ? String(row.Year) : null,
      effectiveDate: row?.Year ? `${row.Year}-01-01T00:00:00.000Z` : null,
      releaseDate: null,
      revisionStatus: 'final',
      seasonalAdjustment: 'not_adjusted',
      sourceObservation: null,
    }),
  };
}

function mapCensusIndicator(payload: unknown): ProviderResult<MacroIndicator> {
  const rows = Array.isArray(payload) ? payload : [];
  const header = rows[0] as string[] | undefined;
  const data = rows[1] as string[] | undefined;
  const populationIndex = header?.indexOf('B01003_001E') ?? 1;
  return {
    ok: true,
    value: Object.freeze({
      indicatorId: 'B01003_001E',
      name: 'Total Population',
      description: 'U.S. Census total population estimate',
      value: parseNumericValue(data?.[populationIndex]),
      unit: 'persons',
      frequency: 'annual',
      country: 'US',
      region: null,
      currency: null,
      period: null,
      effectiveDate: null,
      releaseDate: null,
      revisionStatus: 'final',
      seasonalAdjustment: 'not_adjusted',
      sourceObservation: null,
    }),
  };
}

function mapSaudiIndicator(payload: unknown): ProviderResult<MacroIndicator> {
  const record = payload as {
    result?: { records?: Array<{ indicator_name_en: string; value: number; unit: string; year: number }> };
  };
  const latest = record.result?.records?.[0];
  return {
    ok: true,
    value: Object.freeze({
      indicatorId: 'sa-gdp-current',
      name: latest?.indicator_name_en ?? 'Saudi Economic Indicator',
      description: latest?.indicator_name_en ?? null,
      value: parseNumericValue(latest?.value),
      unit: latest?.unit ?? null,
      frequency: 'annual',
      country: 'SA',
      region: null,
      currency: 'SAR',
      period: latest?.year ? String(latest.year) : null,
      effectiveDate: latest?.year ? `${latest.year}-01-01T00:00:00.000Z` : null,
      releaseDate: null,
      revisionStatus: 'final',
      seasonalAdjustment: 'unknown',
      sourceObservation: null,
    }),
  };
}

function mapUsaSpendingIndicator(payload: unknown): ProviderResult<MacroIndicator> {
  const record = payload as { results?: Array<{ aggregated_amount: number; category: string }> };
  const total = (record.results ?? []).reduce((sum, row) => sum + (row.aggregated_amount ?? 0), 0);
  return {
    ok: true,
    value: Object.freeze({
      indicatorId: 'spending_by_category',
      name: 'Federal Spending by Category',
      description: 'Aggregated U.S. federal spending',
      value: total > 0 ? total : null,
      unit: 'USD',
      frequency: 'quarterly',
      country: 'US',
      region: null,
      currency: 'USD',
      period: null,
      effectiveDate: null,
      releaseDate: null,
      revisionStatus: 'preliminary',
      seasonalAdjustment: 'not_adjusted',
      sourceObservation: null,
    }),
  };
}

function mapFederalRegisterIndicator(payload: unknown): ProviderResult<MacroIndicator> {
  const record = payload as { results?: Array<{ title: string; publication_date: string }> };
  const count = record.results?.length ?? 0;
  const latest = record.results?.[0];
  return {
    ok: true,
    value: Object.freeze({
      indicatorId: 'economic_policy_documents',
      name: 'Economic Policy Documents',
      description: 'Count of economically relevant federal register documents',
      value: count,
      unit: 'documents',
      frequency: 'daily',
      country: 'US',
      region: null,
      currency: null,
      period: latest?.publication_date ?? null,
      effectiveDate: latest?.publication_date ? `${latest.publication_date}T00:00:00.000Z` : null,
      releaseDate: latest?.publication_date ? `${latest.publication_date}T00:00:00.000Z` : null,
      revisionStatus: 'final',
      seasonalAdjustment: 'not_adjusted',
      sourceObservation: null,
    }),
  };
}

export function createMacroAdapterContext(input: {
  readonly transport: HttpProviderTransport;
  readonly authResolver: ProviderAuthResolver;
  readonly simulationOnly?: boolean;
  readonly nowUtc?: () => string;
}): MacroAdapterContext {
  return Object.freeze({
    transport: input.transport,
    authResolver: input.authResolver,
    reliability: new ProviderReliabilityControlPlane(),
    nowUtc: input.nowUtc ?? (() => new Date().toISOString()),
    simulationOnly: input.simulationOnly !== false,
  });
}
