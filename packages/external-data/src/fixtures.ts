/**
 * Deterministic Wave 2 provider fixtures — no live network in CI.
 */

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

export const FIXTURE_COMPANIES: readonly CompanyIdentifier[] = Object.freeze([
  {
    entityId: 'sunrey:company:us:0000320193',
    cik: '0000320193',
    ticker: 'AAPL',
    legalName: 'Apple Inc.',
    jurisdiction: 'US',
    exchange: 'NASDAQ',
    isin: 'US0378331005',
    figi: null,
    providerCompanyId: '320193',
    sourceProvider: 'sec-edgar',
  },
]);

export const FIXTURE_FILINGS: readonly CompanyFiling[] = Object.freeze([
  {
    entityId: 'sunrey:company:us:0000320193',
    companyName: 'Apple Inc.',
    jurisdiction: 'US',
    filingType: 'annual_report',
    formType: '10-K',
    filingDate: '2025-11-01',
    reportingPeriod: '2025-09-27',
    accessionNumber: '0000320193-25-000079',
    documentUrl: 'https://www.sec.gov/Archives/edgar/data/320193/000032019325000079/aapl-20250927.htm',
    sourceProvider: 'sec-edgar',
    retrievedAt: '2026-08-30T12:00:00.000Z',
    sourceTimestamp: '2025-11-01T16:30:00.000Z',
    provenance: 'fixture:sec-edgar:10-K',
  },
]);

export const FIXTURE_DISCLOSURES: readonly FinancialDisclosure[] = Object.freeze([
  {
    entityId: 'sunrey:company:us:0000320193',
    reportingPeriod: '2025-09-27',
    currency: 'USD',
    revenueMinor: 416_161_000_000_00n,
    netIncomeMinor: 112_010_000_000_00n,
    totalAssetsMinor: 364_980_000_000_00n,
    totalLiabilitiesMinor: 308_030_000_000_00n,
    operatingCashFlowMinor: 118_254_000_000_00n,
    sharesOutstanding: 14_840_390_000,
    taxonomyRefs: Object.freeze(['us-gaap:Revenues', 'us-gaap:NetIncomeLoss']),
    sourceProvider: 'sec-edgar',
    provenance: 'fixture:sec-edgar:xbrl-summary',
  },
]);

export const FIXTURE_MACRO: readonly MacroIndicator[] = Object.freeze([
  {
    seriesId: 'UNRATE',
    name: 'Unemployment Rate',
    value: 4.2,
    unit: 'percent',
    geography: 'US',
    observationDate: '2026-07-01',
    sourceProvider: 'fred',
  },
  {
    seriesId: 'CPIAUCSL',
    name: 'CPI All Urban Consumers',
    value: 323.4,
    unit: 'index',
    geography: 'US',
    observationDate: '2026-07-01',
    sourceProvider: 'fred',
  },
]);

export const FIXTURE_FX: readonly FxReferenceRate[] = Object.freeze([
  {
    baseCurrency: 'USD',
    quoteCurrency: 'EUR',
    rate: '0.92145',
    asOf: '2026-08-30T12:00:00.000Z',
    sourceProvider: 'frankfurter',
  },
  {
    baseCurrency: 'USD',
    quoteCurrency: 'GBP',
    rate: '0.78412',
    asOf: '2026-08-30T12:00:00.000Z',
    sourceProvider: 'frankfurter',
  },
]);

export const FIXTURE_MARKETS: readonly MarketQuote[] = Object.freeze([
  {
    symbol: 'AAPL',
    exchange: 'NASDAQ',
    priceMinor: 227_50n,
    currency: 'USD',
    asOf: '2026-08-30T12:00:00.000Z',
    sourceProvider: 'alpha-vantage',
  },
]);

export const FIXTURE_COMMODITIES: readonly CommodityReference[] = Object.freeze([
  {
    commodityId: 'WTI_CRUDE',
    name: 'WTI Crude Oil',
    priceMinor: 7850n,
    currency: 'USD',
    unit: 'barrel',
    asOf: '2026-08-30T12:00:00.000Z',
    sourceProvider: 'fred-commodity',
  },
]);

export const FIXTURE_TREASURY: readonly TreasuryYield[] = Object.freeze([
  {
    maturity: '10Y',
    yieldPercent: '4.12',
    asOf: '2026-08-30T12:00:00.000Z',
    sourceProvider: 'fred',
  },
]);

export const FIXTURE_FISCAL: readonly FiscalBalance[] = Object.freeze([
  {
    jurisdiction: 'US',
    period: '2025-FY',
    revenueMinor: 4_900_000_000_000_00n,
    spendingMinor: 6_100_000_000_000_00n,
    balanceMinor: -1_200_000_000_000_00n,
    currency: 'USD',
    sourceProvider: 'us-treasury-fiscal',
  },
]);

export const FIXTURE_REGULATORY: readonly RegulatoryPublication[] = Object.freeze([
  {
    jurisdiction: 'US',
    agency: 'SEC',
    title: 'Disclosure of Cybersecurity Incidents',
    publicationDate: '2026-03-15',
    effectiveDate: '2026-06-15',
    documentType: 'final_rule',
    topics: Object.freeze(['securities', 'cybersecurity', 'disclosure']),
    sourceUrl: 'https://www.federalregister.gov/documents/2026/03/15/example',
    providerId: 'federal-register',
    provenance: 'fixture:federal-register',
  },
]);

export const MALFORMED_JSON_FIXTURE = '{ "series": [ invalid }';

export const RATE_LIMIT_FIXTURE = { status: 429, retryAfterMs: 60_000 };

export const TIMEOUT_PROVIDER = 'fixture-timeout-market';
