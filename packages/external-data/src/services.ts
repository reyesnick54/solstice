/**
 * Wave 2 canonical domain services.
 */

import type { ExternalObservation } from '../../provider-sdk/src/index.ts';
import {
  createDefaultAdapterStates,
  fetchCommodities,
  fetchFilings,
  fetchFiscal,
  fetchFxRates,
  fetchMacroIndicators,
  fetchMarketQuotes,
  fetchRegulatoryPublications,
  fetchTreasuryYields,
  getFinancialDisclosures,
  searchCompanies,
  type Wave2AdapterContext,
} from './adapters.ts';
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

export type ServiceResult<T> = {
  readonly observations: readonly ExternalObservation<T>[];
  readonly degraded: boolean;
  readonly stale: boolean;
  readonly providersUsed: readonly string[];
};

function summarize<T>(observations: readonly ExternalObservation<T>[]): ServiceResult<T> {
  return Object.freeze({
    observations,
    degraded: observations.length === 0,
    stale: false,
    providersUsed: Object.freeze([...new Set(observations.map((o) => o.providerId))]),
  });
}

export class MacroDataService {
  readonly #ctx: Wave2AdapterContext;

  constructor(ctx?: Wave2AdapterContext) {
    this.#ctx = ctx ?? { nowUtc: new Date().toISOString(), states: createDefaultAdapterStates() };
  }

  getIndicators(): ServiceResult<MacroIndicator> {
    return summarize(fetchMacroIndicators(this.#ctx));
  }

  getTreasuryYields(): ServiceResult<TreasuryYield> {
    return summarize(fetchTreasuryYields(this.#ctx));
  }

  getFiscalBalances(): ServiceResult<FiscalBalance> {
    return summarize(fetchFiscal(this.#ctx));
  }
}

export class FxReferenceService {
  readonly #ctx: Wave2AdapterContext;

  constructor(ctx?: Wave2AdapterContext) {
    this.#ctx = ctx ?? { nowUtc: new Date().toISOString(), states: createDefaultAdapterStates() };
  }

  getRates(base = 'USD'): ServiceResult<FxReferenceRate> {
    const rates = fetchFxRates(this.#ctx).filter((o) => o.data.baseCurrency === base);
    return summarize(rates);
  }
}

export class MarketReferenceService {
  readonly #ctx: Wave2AdapterContext;

  constructor(ctx?: Wave2AdapterContext) {
    this.#ctx = ctx ?? { nowUtc: new Date().toISOString(), states: createDefaultAdapterStates() };
  }

  getQuotes(symbols?: readonly string[]): ServiceResult<MarketQuote> {
    const quotes = fetchMarketQuotes(this.#ctx).filter(
      (o) => !symbols || symbols.includes(o.data.symbol),
    );
    return summarize(quotes);
  }

  getCommodities(): ServiceResult<CommodityReference> {
    return summarize(fetchCommodities(this.#ctx));
  }
}

export class CompanyIntelligenceService {
  readonly #ctx: Wave2AdapterContext;

  constructor(ctx?: Wave2AdapterContext) {
    this.#ctx = ctx ?? { nowUtc: new Date().toISOString(), states: createDefaultAdapterStates() };
  }

  getCompany(entityId: string): CompanyIdentifier | null {
    return searchCompanies(this.#ctx, entityId).find((c) => c.entityId === entityId) ?? null;
  }

  getFilings(entityId?: string): ServiceResult<CompanyFiling> {
    return summarize(fetchFilings(this.#ctx, entityId));
  }

  getLatestFilings(limit = 10): ServiceResult<CompanyFiling> {
    const filings = fetchFilings(this.#ctx).slice(0, limit);
    return summarize(filings);
  }

  getFinancialDisclosures(entityId: string): ServiceResult<FinancialDisclosure> {
    return summarize(getFinancialDisclosures(this.#ctx, entityId));
  }

  searchCompanies(query: string): readonly CompanyIdentifier[] {
    return searchCompanies(this.#ctx, query);
  }

  getRegulatoryPublications(): ServiceResult<RegulatoryPublication> {
    return summarize(fetchRegulatoryPublications(this.#ctx));
  }
}

export function createWave2Services(ctx?: Wave2AdapterContext) {
  return Object.freeze({
    macro: new MacroDataService(ctx),
    fx: new FxReferenceService(ctx),
    markets: new MarketReferenceService(ctx),
    company: new CompanyIntelligenceService(ctx),
  });
}
