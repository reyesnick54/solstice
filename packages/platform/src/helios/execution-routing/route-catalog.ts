import type { ProviderRouteCatalogEntry } from './types.ts';

/**
 * Canonical documentation of provider route implementation posture for M23.
 * Production remains disabled for all routes in this milestone.
 */
export const EXECUTION_PROVIDER_ROUTE_CATALOG: readonly ProviderRouteCatalogEntry[] = Object.freeze([
  Object.freeze({
    routeId: 'route_equity_paper_sandbox',
    providerId: 'sunrey-investments-paper',
    assetClasses: Object.freeze(['etf', 'equity', 'index']),
    implementationStatus: 'SANDBOX_QUALIFIED',
    sandboxQualified: true,
    credentialDependent: false,
    productionDisabled: true,
    externallyRequired: false,
    notes: 'Extends H09/H23 paper investment sandbox route. Simulated execution only.',
  }),
  Object.freeze({
    routeId: 'route_crypto_sandbox_execution',
    providerId: 'sandbox_helios_investment_v1',
    assetClasses: Object.freeze(['crypto']),
    implementationStatus: 'SANDBOX_QUALIFIED',
    sandboxQualified: true,
    credentialDependent: false,
    productionDisabled: true,
    externallyRequired: false,
    notes: 'Extends H23 SandboxHeliosProviderPort. Deterministic sandbox crypto execution.',
  }),
  Object.freeze({
    routeId: 'route_equity_finnhub_market_data_only',
    providerId: 'finnhub',
    assetClasses: Object.freeze(['etf', 'equity', 'index']),
    implementationStatus: 'CREDENTIAL_DEPENDENT',
    sandboxQualified: false,
    credentialDependent: true,
    productionDisabled: true,
    externallyRequired: false,
    notes: 'M05 market data adapter only. FINNHUB_API_KEY optional for rate limits. Not an execution route.',
  }),
  Object.freeze({
    routeId: 'route_crypto_coingecko_market_data_only',
    providerId: 'coingecko',
    assetClasses: Object.freeze(['crypto']),
    implementationStatus: 'CREDENTIAL_DEPENDENT',
    sandboxQualified: false,
    credentialDependent: true,
    productionDisabled: true,
    externallyRequired: false,
    notes: 'M06 market data adapter only. COINGECKO_API_KEY optional. Not an execution route.',
  }),
  Object.freeze({
    routeId: 'route_futures_cme_external',
    providerId: 'cme_futures_external',
    assetClasses: Object.freeze(['future', 'commodity']),
    implementationStatus: 'EXTERNALLY_REQUIRED',
    sandboxQualified: false,
    credentialDependent: false,
    productionDisabled: true,
    externallyRequired: true,
    notes: 'No licensed futures broker integrated. EXTERNAL_PROVIDER_REQUIRED.',
  }),
  Object.freeze({
    routeId: 'route_equity_degraded_failover',
    providerId: 'sunrey-investments-paper-failover',
    assetClasses: Object.freeze(['etf', 'equity', 'index']),
    implementationStatus: 'SANDBOX_QUALIFIED',
    sandboxQualified: true,
    credentialDependent: false,
    productionDisabled: true,
    externallyRequired: false,
    notes: 'Secondary sandbox equity route for deterministic failover qualification.',
  }),
]);
