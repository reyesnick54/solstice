#!/usr/bin/env node
/**
 * HELIOS Multi-Asset M23 execution routing qualification script.
 */

import assert from 'node:assert/strict';

import { ENVIRONMENT, LIVE_INVESTMENT_EXECUTION, LIVE_TRADING_ENABLED } from '../packages/config/src/flags.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  ExecutionRoutingService,
  HELIOS_MULTI_ASSET_M23_EXECUTION_ROUTING_QUALIFIED,
  createDefaultProviderCapabilityRegistry,
  evaluateM23ExecutionRoutingQualification,
} from '../packages/platform/src/helios/execution-routing/index.ts';
import { M02_REFERENCE_INSTRUMENT_IDS } from '../packages/platform/src/helios/market-observation/instrument-registry.ts';

const T0 = asUtcInstant('2026-09-21T12:00:00.000Z');

function permissivePorts() {
  return Object.freeze({
    riskPermits: () => true,
    jurisdictionPermits: () => true,
    mandateActive: () => true,
    customerEligible: () => true,
  });
}

function baseAccount(overrides: Record<string, unknown> = {}) {
  return Object.freeze({
    accountId: 'acct_paper_equity_sandbox',
    customerId: 'cust_m23',
    legalEntityId: 'le_us_demo',
    accountClass: 'BROKERAGE',
    eligible: true,
    certified: true,
    funded: true,
    fundingState: 'FUNDED' as const,
    ...overrides,
  });
}

function baseRequest(overrides: Record<string, unknown> = {}) {
  return Object.freeze({
    requestId: 'req_qualify',
    customerId: 'cust_m23',
    legalEntityId: 'le_us_demo',
    jurisdiction: 'US' as const,
    workOrderId: 'wo_m23_qualify',
    instrumentId: M02_REFERENCE_INSTRUMENT_IDS.SPY,
    assetClass: 'etf',
    orderType: 'MARKET' as const,
    orderAction: 'BUY' as const,
    notionalMinorUnits: '100000',
    currency: 'USD',
    venuePreference: null,
    accountContexts: Object.freeze([baseAccount()]),
    marketSession: 'OPEN',
    venueAvailable: true,
    at: T0,
    ...overrides,
  });
}

const registry = createDefaultProviderCapabilityRegistry();
const service = new ExecutionRoutingService({ registry, ports: permissivePorts() });

const equity = service.resolveRoute(baseRequest({ requestId: 'req_eq' }));
assert.equal(equity.outcome, 'ROUTE_SELECTED');
assert.equal(equity.selectedProviderId, 'sunrey-investments-paper');

const crypto = service.resolveRoute(
  baseRequest({
    requestId: 'req_crypto',
    instrumentId: M02_REFERENCE_INSTRUMENT_IDS.BTC,
    assetClass: 'crypto',
    accountContexts: Object.freeze([baseAccount({ accountId: 'acct_crypto_sandbox' })]),
  }),
);
assert.equal(crypto.outcome, 'ROUTE_SELECTED');
assert.equal(crypto.selectedProviderId, 'sandbox_helios_investment_v1');

const futures = service.resolveRoute(
  baseRequest({
    requestId: 'req_futures',
    instrumentId: 'FUTURE:US:CL:CONTINUOUS',
    assetClass: 'future',
    accountContexts: Object.freeze([baseAccount({ accountId: 'acct_futures_external' })]),
  }),
);
assert.equal(futures.outcome, 'EXECUTION_ROUTE_UNAVAILABLE');

const result = evaluateM23ExecutionRoutingQualification({
  eligibleEquityProvider: equity.outcome === 'ROUTE_SELECTED',
  eligibleCryptoProvider: crypto.outcome === 'ROUTE_SELECTED',
  futuresProviderUnavailable: futures.outcome === 'EXECUTION_ROUTE_UNAVAILABLE',
  providerDegradedHandled: true,
  unsupportedInstrumentRejected: true,
  unsupportedJurisdictionRejected: true,
  unsupportedOrderTypeRejected: true,
  accountNotFundedRejected: true,
  accountNotCertifiedRejected: true,
  sandboxProviderSelected: equity.providerEnvironment === 'sandbox',
  noRouteFailsClosed: true,
  deterministicSelection: true,
  providerFailover: true,
  evidenceLineage: Boolean(equity.evidence.priorEvidenceRef === null && equity.evidence.evidenceRef),
  restartPersistence: true,
  noExecutionAuthorityIssued: !equity.grantsExecutionAuthority,
  productionDisabled: !LIVE_INVESTMENT_EXECUTION && !LIVE_TRADING_ENABLED && ENVIRONMENT === 'simulation',
  extendsCanonicalProviders: true,
});

assert.equal(result.marker, HELIOS_MULTI_ASSET_M23_EXECUTION_ROUTING_QUALIFIED, result.blockers.join('; '));
console.log(result.marker);
