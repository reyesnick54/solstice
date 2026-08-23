import type { OpportunityCategory, OpportunityRiskLevel } from './taxonomy.ts';
import type { ProductCapability, RateCatalogReference } from './types.ts';

/**
 * Server-owned simulation catalog of products the Growth Orchestrator
 * may mention. Unavailable or unimplemented products must not be
 * recommended as immediately executable.
 */
export const SIMULATION_GROWTH_PRODUCTS: readonly ProductCapability[] = Object.freeze([
  {
    productId: 'prod_internal_transfer',
    category: 'CASH_OPTIMIZATION',
    available: true,
    immediatelyExecutable: false,
    minimumAmount: { minorUnits: '100', currency: 'USD' },
    jurisdictions: Object.freeze(['US', 'GB']),
    providerId: 'sunrey-ledger',
    providerAvailable: true,
    requiresKyc: true,
    maxRiskLevel: 'LOW',
  },
  {
    productId: 'prod_savings_deposit',
    category: 'EMERGENCY_RESERVE',
    available: true,
    immediatelyExecutable: false,
    minimumAmount: { minorUnits: '100', currency: 'USD' },
    jurisdictions: Object.freeze(['US', 'GB']),
    providerId: 'sunrey-ledger',
    providerAvailable: true,
    requiresKyc: true,
    maxRiskLevel: 'LOW',
  },
  {
    productId: 'prod_recurring_savings',
    category: 'RECURRING_SAVING',
    available: true,
    immediatelyExecutable: false,
    jurisdictions: Object.freeze(['US', 'GB']),
    providerId: 'sunrey-ledger',
    providerAvailable: true,
    requiresKyc: true,
    maxRiskLevel: 'LOW',
  },
  {
    productId: 'prod_fx_conversion',
    category: 'CURRENCY_OPTIMIZATION',
    available: true,
    immediatelyExecutable: false,
    minimumAmount: { minorUnits: '100', currency: 'USD' },
    jurisdictions: Object.freeze(['US', 'GB']),
    providerId: 'sunrey-fx-simulation',
    providerAvailable: true,
    requiresKyc: true,
    maxRiskLevel: 'MODERATE',
  },
  {
    productId: 'prod_paper_investment_review',
    category: 'INVESTMENT_ALLOCATION',
    available: true,
    immediatelyExecutable: false,
    jurisdictions: Object.freeze(['US', 'GB']),
    providerId: 'sunrey-investments-paper',
    providerAvailable: true,
    requiresKyc: true,
    maxRiskLevel: 'UNCERTAIN_MARKET',
  },
  {
    productId: 'prod_paper_rebalance_review',
    category: 'PORTFOLIO_REBALANCE',
    available: true,
    immediatelyExecutable: false,
    jurisdictions: Object.freeze(['US', 'GB']),
    providerId: 'sunrey-investments-paper',
    providerAvailable: true,
    requiresKyc: true,
    maxRiskLevel: 'UNCERTAIN_MARKET',
  },
  {
    productId: 'prod_paper_diversification_review',
    category: 'DIVERSIFICATION',
    available: true,
    immediatelyExecutable: false,
    jurisdictions: Object.freeze(['US', 'GB']),
    providerId: 'sunrey-investments-paper',
    providerAvailable: true,
    requiresKyc: true,
    maxRiskLevel: 'UNCERTAIN_MARKET',
  },
  {
    productId: 'prod_debt_payment_proposal',
    category: 'DEBT_OPTIMIZATION',
    available: true,
    immediatelyExecutable: false,
    jurisdictions: Object.freeze(['US', 'GB']),
    providerId: 'sunrey-payments-simulation',
    providerAvailable: true,
    requiresKyc: true,
    maxRiskLevel: 'MODERATE',
  },
  {
    productId: 'prod_goal_funding_plan',
    category: 'GOAL_FUNDING',
    available: true,
    immediatelyExecutable: false,
    jurisdictions: Object.freeze(['US', 'GB']),
    providerId: 'sunrey-ledger',
    providerAvailable: true,
    requiresKyc: false,
    maxRiskLevel: 'LOW',
  },
  {
    productId: 'prod_expense_review',
    category: 'EXPENSE_OPTIMIZATION',
    available: true,
    immediatelyExecutable: false,
    jurisdictions: Object.freeze(['US', 'GB']),
    providerId: 'sunrey-information',
    providerAvailable: true,
    requiresKyc: false,
    maxRiskLevel: 'LOW',
  },
]);

export const SIMULATION_RATE_CATALOG: readonly RateCatalogReference[] = Object.freeze([
  {
    catalogId: 'sim_savings_rate_usd',
    asOf: '2026-08-22T00:00:00.000Z' as RateCatalogReference['asOf'],
    basisPoints: 250,
    currency: 'USD',
    authority: 'SIMULATION_CATALOG_NOT_A_PROMISE',
  },
  {
    catalogId: 'sim_savings_rate_gbp',
    asOf: '2026-08-22T00:00:00.000Z' as RateCatalogReference['asOf'],
    basisPoints: 200,
    currency: 'GBP',
    authority: 'SIMULATION_CATALOG_NOT_A_PROMISE',
  },
]);

export function productsFor(
  category: OpportunityCategory,
  catalog: readonly ProductCapability[] = SIMULATION_GROWTH_PRODUCTS,
): readonly ProductCapability[] {
  return Object.freeze(catalog.filter((item) => item.category === category));
}

export function rateFor(
  currency: string,
  catalog: readonly RateCatalogReference[] = SIMULATION_RATE_CATALOG,
): RateCatalogReference | undefined {
  return catalog.find((item) => item.currency === currency);
}

export function riskRank(level: OpportunityRiskLevel): number {
  if (level === 'LOW') return 0;
  if (level === 'MODERATE') return 1;
  if (level === 'HIGH') return 2;
  return 3;
}
