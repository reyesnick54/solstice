/**
 * Canonical Wave 2 external reference data models.
 *
 * Observations only — no execution authority, balances, or compliance decisions.
 */

import type { ExternalObservation } from '../../provider-sdk/src/index.ts';

export type CompanyIdentifier = {
  readonly entityId: string;
  readonly cik?: string | null;
  readonly ticker?: string | null;
  readonly legalName: string;
  readonly jurisdiction: string;
  readonly exchange?: string | null;
  readonly isin?: string | null;
  readonly figi?: string | null;
  readonly providerCompanyId?: string | null;
  readonly sourceProvider: string;
};

export type CompanyFiling = {
  readonly entityId: string;
  readonly companyName: string;
  readonly jurisdiction: string;
  readonly filingType: string;
  readonly formType: string;
  readonly filingDate: string;
  readonly reportingPeriod: string | null;
  readonly accessionNumber: string;
  readonly documentUrl: string;
  readonly sourceProvider: string;
  readonly retrievedAt: string;
  readonly sourceTimestamp: string | null;
  readonly provenance: string;
};

export type FilingDocument = {
  readonly accessionNumber: string;
  readonly documentType: string;
  readonly sequence: number;
  readonly documentUrl: string;
  readonly description: string | null;
};

export type FinancialDisclosure = {
  readonly entityId: string;
  readonly reportingPeriod: string;
  readonly currency: string;
  readonly revenueMinor: bigint | null;
  readonly netIncomeMinor: bigint | null;
  readonly totalAssetsMinor: bigint | null;
  readonly totalLiabilitiesMinor: bigint | null;
  readonly operatingCashFlowMinor: bigint | null;
  readonly sharesOutstanding: number | null;
  readonly taxonomyRefs: readonly string[];
  readonly sourceProvider: string;
  readonly provenance: string;
};

export type InsiderDisclosure = {
  readonly entityId: string;
  readonly insiderName: string;
  readonly formType: string;
  readonly transactionDate: string;
  readonly shares: number | null;
  readonly sourceProvider: string;
  readonly documentUrl: string;
};

export type InstitutionalHoldingDisclosure = {
  readonly entityId: string;
  readonly institutionName: string;
  readonly reportingPeriod: string;
  readonly holdings: readonly { readonly cusip: string; readonly valueMinor: bigint }[];
  readonly sourceProvider: string;
};

export type MacroIndicator = {
  readonly seriesId: string;
  readonly name: string;
  readonly value: number;
  readonly unit: string;
  readonly geography: string;
  readonly observationDate: string;
  readonly sourceProvider: string;
};

export type FxReferenceRate = {
  readonly baseCurrency: string;
  readonly quoteCurrency: string;
  readonly rate: string;
  readonly asOf: string;
  readonly sourceProvider: string;
};

export type MarketQuote = {
  readonly symbol: string;
  readonly exchange: string | null;
  readonly priceMinor: bigint;
  readonly currency: string;
  readonly asOf: string;
  readonly sourceProvider: string;
};

export type CommodityReference = {
  readonly commodityId: string;
  readonly name: string;
  readonly priceMinor: bigint;
  readonly currency: string;
  readonly unit: string;
  readonly asOf: string;
  readonly sourceProvider: string;
};

export type TreasuryYield = {
  readonly maturity: string;
  readonly yieldPercent: string;
  readonly asOf: string;
  readonly sourceProvider: string;
};

export type GovernmentDebt = {
  readonly jurisdiction: string;
  readonly instrument: string;
  readonly outstandingMinor: bigint;
  readonly currency: string;
  readonly asOf: string;
  readonly sourceProvider: string;
};

export type FiscalBalance = {
  readonly jurisdiction: string;
  readonly period: string;
  readonly revenueMinor: bigint | null;
  readonly spendingMinor: bigint | null;
  readonly balanceMinor: bigint | null;
  readonly currency: string;
  readonly sourceProvider: string;
};

export type RegulatoryPublication = {
  readonly jurisdiction: string;
  readonly agency: string;
  readonly title: string;
  readonly publicationDate: string;
  readonly effectiveDate: string | null;
  readonly documentType: string;
  readonly topics: readonly string[];
  readonly sourceUrl: string;
  readonly providerId: string;
  readonly provenance: string;
};

export type ExternalDataHealth = {
  readonly providerId: string;
  readonly enabled: boolean;
  readonly health: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  readonly lastSuccess: string | null;
  readonly lastError: string | null;
  readonly cacheFreshness: 'fresh' | 'stale' | 'expired' | 'none';
  readonly circuitState: string;
  readonly credentialReady: boolean;
};

export type Wave2CoverageStatus =
  | 'IMPLEMENTED'
  | 'BLOCKED'
  | 'DEPRECATED'
  | 'UNAVAILABLE'
  | 'NOT_WAVE_2';

export type Wave2ProviderCoverage = {
  readonly providerId: string;
  readonly category: string;
  readonly status: Wave2CoverageStatus;
  readonly notes: string;
};

export type SearchableEntity = {
  readonly entityId: string;
  readonly companyName: string;
  readonly ticker: string | null;
  readonly jurisdiction: string;
  readonly filingTypes: readonly string[];
  readonly topics: readonly string[];
};

export type ExternalDataObservation<T> = ExternalObservation<T>;
