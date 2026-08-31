/**
 * Wave 2 provider adapter registry with simulation fixtures.
 */

import { ProviderDataDeliveryService } from '../../sunrey-chain/src/provider-runtime/data-delivery/service.ts';
import {
  buildExternalObservation,
  canonicalJsonStringify,
  type ExternalObservation,
} from '../../provider-sdk/src/index.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import {
  FIXTURE_COMMODITIES,
  FIXTURE_FILINGS,
  FIXTURE_FISCAL,
  FIXTURE_FX,
  FIXTURE_MACRO,
  FIXTURE_MARKETS,
  FIXTURE_REGULATORY,
  FIXTURE_TREASURY,
  FIXTURE_COMPANIES,
  FIXTURE_DISCLOSURES,
  MALFORMED_JSON_FIXTURE,
  RATE_LIMIT_FIXTURE,
  TIMEOUT_PROVIDER,
} from './fixtures.ts';
import type {
  CommodityReference,
  CompanyFiling,
  CompanyIdentifier,
  FinancialDisclosure,
  FiscalBalance,
  FxReferenceRate,
  MacroIndicator,
  MarketQuote,
  RegulatoryPublication,
  TreasuryYield,
} from './models.ts';

export const WAVE2_IMPLEMENTED_PROVIDER_IDS = Object.freeze([
  'fred',
  'world-bank',
  'bls',
  'imf-data',
  'frankfurter',
  'exchangerate-host',
  'alpha-vantage',
  'finnhub',
  'sec-edgar',
  'us-treasury-fiscal',
  'federal-register',
  'fred-commodity',
]);

export type ProviderAdapterState = {
  readonly enabled: boolean;
  readonly down: boolean;
  readonly rateLimited: boolean;
  readonly malformed: boolean;
  readonly lastSuccess: string | null;
  readonly lastError: string | null;
  readonly circuitState: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
};

export type Wave2AdapterContext = {
  readonly nowUtc: string;
  readonly states: Map<string, ProviderAdapterState>;
};

function stateFor(ctx: Wave2AdapterContext, providerId: string): ProviderAdapterState {
  return (
    ctx.states.get(providerId) ?? {
      enabled: true,
      down: false,
      rateLimited: false,
      malformed: false,
      lastSuccess: null,
      lastError: null,
      circuitState: 'CLOSED',
    }
  );
}

function guardProvider(ctx: Wave2AdapterContext, providerId: string): string | null {
  const state = stateFor(ctx, providerId);
  if (!state.enabled) {
    return 'PROVIDER_DISABLED';
  }
  if (state.down || providerId === TIMEOUT_PROVIDER) {
    return 'PROVIDER_UNAVAILABLE';
  }
  if (state.rateLimited) {
    return 'RATE_LIMITED';
  }
  if (state.malformed) {
    return 'INVALID_PAYLOAD';
  }
  return null;
}

function observe<T>(
  ctx: Wave2AdapterContext,
  input: {
    readonly providerId: string;
    readonly category: 'macroeconomics' | 'foreign_exchange' | 'markets' | 'commodities' | 'corporate_filings' | 'government_open_data';
    readonly capability: string;
    readonly dataset: string;
    readonly data: T;
    readonly rawPayload: string;
  },
): ExternalObservation<T> | null {
  const failure = guardProvider(ctx, input.providerId);
  if (failure) {
    const state = ctx.states.get(input.providerId);
    if (state) {
      ctx.states.set(input.providerId, { ...state, lastError: failure });
    }
    return null;
  }
  const built = buildExternalObservation({
    providerId: input.providerId,
    providerCategory: input.category,
    capability: input.capability,
    data: input.data,
    source: {
      provider: input.providerId,
      dataset: input.dataset,
      sourceUrl: null,
    },
    time: { retrievedAt: asUtcInstant(ctx.nowUtc), sourceTimestamp: asUtcInstant(ctx.nowUtc) },
    authorityClass: input.category === 'corporate_filings' ? 'authoritative_official' : 'reference_data',
    provenance: {
      requestId: `wave2-${input.providerId}`,
      rawPayload: input.rawPayload,
      providerSchemaVersion: 'fixture/1',
    },
  });
  if (!built.ok) {
    return null;
  }
  const state = ctx.states.get(input.providerId);
  if (state) {
    ctx.states.set(input.providerId, { ...state, lastSuccess: ctx.nowUtc, lastError: null });
  }
  return built.value;
}

export function fetchMacroIndicators(ctx: Wave2AdapterContext): readonly ExternalObservation<MacroIndicator>[] {
  const results: ExternalObservation<MacroIndicator>[] = [];
  for (const indicator of FIXTURE_MACRO) {
    const obs = observe(ctx, {
      providerId: indicator.sourceProvider,
      category: 'macroeconomics',
      capability: 'macroeconomic_indicators',
      dataset: indicator.seriesId,
      data: indicator,
      rawPayload: canonicalJsonStringify(indicator),
    });
    if (obs) {
      results.push(obs);
    }
  }
  return Object.freeze(results);
}

export function fetchFxRates(ctx: Wave2AdapterContext): readonly ExternalObservation<FxReferenceRate>[] {
  return Object.freeze(
    FIXTURE_FX.map((rate) =>
      observe(ctx, {
        providerId: rate.sourceProvider,
        category: 'foreign_exchange',
        capability: 'fx_rates',
        dataset: `${rate.baseCurrency}-${rate.quoteCurrency}`,
        data: rate,
        rawPayload: canonicalJsonStringify(rate),
      }),
    ).filter((obs): obs is ExternalObservation<FxReferenceRate> => obs !== null),
  );
}

export function fetchMarketQuotes(ctx: Wave2AdapterContext): readonly ExternalObservation<MarketQuote>[] {
  return Object.freeze(
    FIXTURE_MARKETS.map((quote) =>
      observe(ctx, {
        providerId: quote.sourceProvider,
        category: 'markets',
        capability: 'market_prices',
        dataset: quote.symbol,
        data: quote,
        rawPayload: canonicalJsonStringify(quote),
      }),
    ).filter((obs): obs is ExternalObservation<MarketQuote> => obs !== null),
  );
}

export function fetchCommodities(ctx: Wave2AdapterContext): readonly ExternalObservation<CommodityReference>[] {
  return Object.freeze(
    FIXTURE_COMMODITIES.map((item) =>
      observe(ctx, {
        providerId: item.sourceProvider,
        category: 'commodities',
        capability: 'commodity_prices',
        dataset: item.commodityId,
        data: item,
        rawPayload: canonicalJsonStringify(item),
      }),
    ).filter((obs): obs is ExternalObservation<CommodityReference> => obs !== null),
  );
}

export function fetchFilings(ctx: Wave2AdapterContext, entityId?: string): readonly ExternalObservation<CompanyFiling>[] {
  const filings = entityId ? FIXTURE_FILINGS.filter((f) => f.entityId === entityId) : FIXTURE_FILINGS;
  return Object.freeze(
    filings
      .map((filing) =>
        observe(ctx, {
          providerId: filing.sourceProvider,
          category: 'corporate_filings',
          capability: 'company_filings',
          dataset: filing.accessionNumber,
          data: filing,
          rawPayload: canonicalJsonStringify(filing),
        }),
      )
      .filter((obs): obs is ExternalObservation<CompanyFiling> => obs !== null),
  );
}

export function fetchFiscal(ctx: Wave2AdapterContext): readonly ExternalObservation<FiscalBalance>[] {
  return Object.freeze(
    FIXTURE_FISCAL.map((item) =>
      observe(ctx, {
        providerId: item.sourceProvider,
        category: 'government_open_data',
        capability: 'fiscal_data',
        dataset: item.period,
        data: item,
        rawPayload: canonicalJsonStringify(item),
      }),
    ).filter((obs): obs is ExternalObservation<FiscalBalance> => obs !== null),
  );
}

export function fetchTreasuryYields(ctx: Wave2AdapterContext): readonly ExternalObservation<TreasuryYield>[] {
  return Object.freeze(
    FIXTURE_TREASURY.map((item) =>
      observe(ctx, {
        providerId: item.sourceProvider,
        category: 'macroeconomics',
        capability: 'treasury_yields',
        dataset: item.maturity,
        data: item,
        rawPayload: canonicalJsonStringify(item),
      }),
    ).filter((obs): obs is ExternalObservation<TreasuryYield> => obs !== null),
  );
}

export function fetchRegulatoryPublications(
  ctx: Wave2AdapterContext,
): readonly ExternalObservation<RegulatoryPublication>[] {
  return Object.freeze(
    FIXTURE_REGULATORY.map((item) =>
      observe(ctx, {
        providerId: item.providerId,
        category: 'government_open_data',
        capability: 'regulatory_publications',
        dataset: item.title,
        data: item,
        rawPayload: canonicalJsonStringify(item),
      }),
    ).filter((obs): obs is ExternalObservation<RegulatoryPublication> => obs !== null),
  );
}

export function searchCompanies(ctx: Wave2AdapterContext, query: string): readonly CompanyIdentifier[] {
  if (guardProvider(ctx, 'sec-edgar')) {
    return Object.freeze([]);
  }
  const normalized = query.trim().toLowerCase();
  return Object.freeze(
    FIXTURE_COMPANIES.filter(
      (company) =>
        company.legalName.toLowerCase().includes(normalized) ||
        company.ticker?.toLowerCase() === normalized ||
        company.cik?.includes(normalized),
    ),
  );
}

export function getFinancialDisclosures(
  ctx: Wave2AdapterContext,
  entityId: string,
): readonly ExternalObservation<FinancialDisclosure>[] {
  return Object.freeze(
    FIXTURE_DISCLOSURES.filter((d) => d.entityId === entityId)
      .map((disclosure) =>
        observe(ctx, {
          providerId: disclosure.sourceProvider,
          category: 'corporate_filings',
          capability: 'financial_disclosures',
          dataset: disclosure.reportingPeriod,
          data: disclosure,
          rawPayload: canonicalJsonStringify(disclosure),
        }),
      )
      .filter((obs): obs is ExternalObservation<FinancialDisclosure> => obs !== null),
  );
}

export function createDefaultAdapterStates(): Map<string, ProviderAdapterState> {
  const states = new Map<string, ProviderAdapterState>();
  for (const providerId of WAVE2_IMPLEMENTED_PROVIDER_IDS) {
    states.set(providerId, {
      enabled: true,
      down: false,
      rateLimited: false,
      malformed: false,
      lastSuccess: null,
      lastError: null,
      circuitState: 'CLOSED',
    });
  }
  states.set('fred', { ...states.get('fred')!, rateLimited: false });
  return states;
}

export function createDataDelivery(clockMs: number) {
  const clock = {
    nowMs: () => clockMs,
    nowUtc: () => new Date(clockMs).toISOString(),
  };
  return new ProviderDataDeliveryService({
    clock,
    fetchFn: async ({ providerId, capability, resourceId }) => {
      const nowUtc = clock.nowUtc();
      return {
        ok: true,
        observation: {
          schema: 'sunrey.external-data.observation.v1',
          observationId: `obs-${providerId}-${resourceId}`,
          providerId,
          capability,
          resourceId,
          schemaVersion: '1.0.0',
          normalizedValue: Object.freeze({ rate: '0.92' }),
          provenance: {
            sourceId: providerId,
            collectedAtUtc: nowUtc,
            providerTimestampUtc: nowUtc,
            deduplicationKey: `${providerId}:${resourceId}`,
            contentHash: 'fixture',
          },
          simulation: true,
        },
      };
    },
  });
}

export { MALFORMED_JSON_FIXTURE, RATE_LIMIT_FIXTURE, TIMEOUT_PROVIDER };
