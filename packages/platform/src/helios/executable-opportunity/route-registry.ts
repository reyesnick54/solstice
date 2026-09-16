import type { Jurisdiction } from '../../../../domain/src/jurisdiction.ts';
import type { ExecutionRouteDescriptor, ExecutionRouteRegistryPort } from './types.ts';

export const SIMULATION_EXECUTION_ROUTES: readonly ExecutionRouteDescriptor[] = Object.freeze([
  Object.freeze({
    routeId: 'route_sim_investments_sandbox',
    providerId: 'sunrey-investments-paper',
    executorId: 'sunrey-investments-sandbox',
    productId: 'prod_paper_investment_review',
    instrumentId: 'SIM-ETF-1',
    providerSymbol: 'SIMETF1',
    venueId: 'SIM_EXCHANGE',
    availability: 'SANDBOX_AVAILABLE',
    providerEnvironment: 'sandbox',
    supportedOrderActions: Object.freeze(['BUY', 'SELL']),
    minimumNotional: Object.freeze({ minorUnits: '10000', currency: 'USD' }),
    accountClassRequired: 'BROKERAGE',
    feeMetadata: Object.freeze([
      Object.freeze({ code: 'COMMISSION', basisPoints: 0, description: 'simulation commission' }),
    ]),
  }),
  Object.freeze({
    routeId: 'route_sim_investments_configured',
    providerId: 'sunrey-investments-paper',
    executorId: 'sunrey-investments-configured',
    productId: 'prod_paper_rebalance_review',
    instrumentId: 'SIM-ETF-1',
    providerSymbol: 'SIMETF1',
    venueId: 'SIM_EXCHANGE',
    availability: 'CONFIGURED',
    providerEnvironment: 'simulation',
    supportedOrderActions: Object.freeze(['BUY', 'SELL']),
    minimumNotional: Object.freeze({ minorUnits: '10000', currency: 'USD' }),
    accountClassRequired: 'BROKERAGE',
  }),
  Object.freeze({
    routeId: 'route_sim_ledger_available',
    providerId: 'sunrey-ledger',
    executorId: 'sunrey-ledger-sim',
    productId: 'prod_internal_transfer',
    instrumentId: 'USD',
    providerSymbol: 'USD',
    venueId: 'SUNREY_LEDGER',
    availability: 'AVAILABLE',
    providerEnvironment: 'simulation',
    supportedOrderActions: Object.freeze(['TRANSFER']),
    minimumNotional: Object.freeze({ minorUnits: '100', currency: 'USD' }),
    accountClassRequired: 'DEMAND_DEPOSIT',
  }),
  Object.freeze({
    routeId: 'route_certification_only',
    providerId: 'sunrey-investments-paper',
    executorId: 'sunrey-investments-cert',
    productId: 'prod_paper_diversification_review',
    instrumentId: 'SIM-EQ-1',
    providerSymbol: 'SIMEQ1',
    venueId: 'SIM_EXCHANGE',
    availability: 'CERTIFICATION_ONLY',
    providerEnvironment: 'production_candidate',
    supportedOrderActions: Object.freeze(['BUY']),
    minimumNotional: Object.freeze({ minorUnits: '25000', currency: 'USD' }),
    accountClassRequired: 'BROKERAGE',
  }),
  Object.freeze({
    routeId: 'route_unavailable_provider',
    providerId: 'sunrey-investments-paper',
    executorId: 'sunrey-investments-offline',
    productId: 'prod_paper_investment_review',
    instrumentId: 'SIM-EQ-1',
    providerSymbol: 'SIMEQ1',
    venueId: 'SIM_EXCHANGE',
    availability: 'UNAVAILABLE',
    providerEnvironment: 'simulation',
    supportedOrderActions: Object.freeze(['BUY']),
    minimumNotional: Object.freeze({ minorUnits: '10000', currency: 'USD' }),
    accountClassRequired: 'BROKERAGE',
  }),
  Object.freeze({
    routeId: 'route_live_authorized_fixture',
    providerId: 'sunrey-investments-live-fixture',
    executorId: 'sunrey-investments-live',
    productId: 'prod_paper_investment_review',
    instrumentId: 'SIM-ETF-1',
    providerSymbol: 'SIMETF1',
    venueId: 'SIM_EXCHANGE',
    availability: 'LIVE_AUTHORIZED',
    providerEnvironment: 'production_candidate',
    supportedOrderActions: Object.freeze(['BUY', 'SELL']),
    minimumNotional: Object.freeze({ minorUnits: '10000', currency: 'USD' }),
    accountClassRequired: 'BROKERAGE',
  }),
]);

export function createExecutionRouteRegistry(
  routes: readonly ExecutionRouteDescriptor[] = SIMULATION_EXECUTION_ROUTES,
): ExecutionRouteRegistryPort {
  return Object.freeze({
    routeFor(input: {
      readonly productId: string;
      readonly instrumentId: string;
      readonly jurisdiction: Jurisdiction;
    }): ExecutionRouteDescriptor | null {
      void input.jurisdiction;
      return (
        routes.find(
          (row) => row.productId === input.productId && row.instrumentId === input.instrumentId,
        ) ?? null
      );
    },
  });
}
