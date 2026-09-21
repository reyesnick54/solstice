/**
 * HELIOS Multi-Asset M23 — multi-provider and multi-venue execution routing.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../packages/config/src/clock.ts';
import { ENVIRONMENT, LIVE_INVESTMENT_EXECUTION, LIVE_TRADING_ENABLED } from '../packages/config/src/flags.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import { EvidenceVault } from '../packages/evidence/src/vault.ts';
import {
  DEFAULT_EXECUTION_PROVIDER_CAPABILITIES,
  EXECUTION_PROVIDER_ROUTE_CATALOG,
  ExecutionRoutingService,
  HELIOS_MULTI_ASSET_M23_EXECUTION_ROUTING_QUALIFIED,
  InMemoryExecutionRoutingStore,
  createDefaultProviderCapabilityRegistry,
  createExternalFuturesAdapter,
  createSandboxCryptoExecutionAdapter,
  createSandboxPaperEquityAdapter,
  evaluateM23ExecutionRoutingQualification,
  type AccountRoutingContext,
  type ExecutionRoutingIntegrationPorts,
  type ExecutionRoutingRequest,
  type ProviderCapabilityObject,
} from '../packages/platform/src/helios/execution-routing/index.ts';
import { M02_REFERENCE_INSTRUMENT_IDS } from '../packages/platform/src/helios/market-observation/instrument-registry.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const T0 = asUtcInstant('2026-09-21T12:00:00.000Z');
const T1 = asUtcInstant('2026-09-21T12:05:00.000Z');

function permissivePorts(overrides: Partial<ExecutionRoutingIntegrationPorts> = {}): ExecutionRoutingIntegrationPorts {
  return Object.freeze({
    riskPermits: () => true,
    jurisdictionPermits: () => true,
    mandateActive: () => true,
    customerEligible: () => true,
    ...overrides,
  });
}

function account(overrides: Partial<AccountRoutingContext> & Pick<AccountRoutingContext, 'accountId'>): AccountRoutingContext {
  return Object.freeze({
    customerId: 'cust_m23',
    legalEntityId: 'le_us_demo',
    accountClass: 'BROKERAGE',
    eligible: true,
    certified: true,
    funded: true,
    fundingState: 'FUNDED',
    ...overrides,
  });
}

function request(overrides: Partial<ExecutionRoutingRequest> & Pick<ExecutionRoutingRequest, 'requestId'>): ExecutionRoutingRequest {
  return Object.freeze({
    customerId: 'cust_m23',
    legalEntityId: 'le_us_demo',
    jurisdiction: 'US',
    workOrderId: 'wo_m23_test',
    instrumentId: M02_REFERENCE_INSTRUMENT_IDS.SPY,
    assetClass: 'etf',
    orderType: 'MARKET',
    orderAction: 'BUY',
    notionalMinorUnits: '100000',
    currency: 'USD',
    venuePreference: null,
    accountContexts: Object.freeze([account({ accountId: 'acct_paper_equity_sandbox' })]),
    marketSession: 'OPEN',
    venueAvailable: true,
    at: T0,
    ...overrides,
  });
}

function withHealth(
  providerId: string,
  accountId: string,
  healthState: ProviderCapabilityObject['healthState'],
): readonly ProviderCapabilityObject[] {
  return DEFAULT_EXECUTION_PROVIDER_CAPABILITIES.map((row) =>
    row.providerId === providerId && row.accountId === accountId
      ? Object.freeze({ ...row, healthState })
      : row,
  );
}

describe('HELIOS Multi-Asset M23 execution routing', () => {
  it('selects eligible equity sandbox provider', () => {
    const service = new ExecutionRoutingService({
      registry: createDefaultProviderCapabilityRegistry(),
      ports: permissivePorts(),
    });
    const result = service.resolveRoute(request({ requestId: 'req_equity' }));
    assert.equal(result.outcome, 'ROUTE_SELECTED');
    assert.equal(result.selectedProviderId, 'sunrey-investments-paper');
    assert.equal(result.selectedAccountId, 'acct_paper_equity_sandbox');
    assert.equal(result.selectedVenueId, 'ARCX');
    assert.equal(result.executionCapability, 'FULL');
    assert.equal(result.providerEnvironment, 'sandbox');
    assert.equal(result.grantsExecutionAuthority, false);
    assert.equal(result.authorizesFinancialExecution, false);
  });

  it('selects eligible crypto sandbox provider', () => {
    const service = new ExecutionRoutingService({
      registry: createDefaultProviderCapabilityRegistry(),
      ports: permissivePorts(),
    });
    const result = service.resolveRoute(
      request({
        requestId: 'req_crypto',
        instrumentId: M02_REFERENCE_INSTRUMENT_IDS.BTC,
        assetClass: 'crypto',
        accountContexts: Object.freeze([account({ accountId: 'acct_crypto_sandbox' })]),
      }),
    );
    assert.equal(result.outcome, 'ROUTE_SELECTED');
    assert.equal(result.selectedProviderId, 'sandbox_helios_investment_v1');
    assert.equal(result.selectedRouteId, 'route_crypto_sandbox_execution');
  });

  it('returns EXECUTION_ROUTE_UNAVAILABLE for futures (external provider required)', () => {
    const service = new ExecutionRoutingService({
      registry: createDefaultProviderCapabilityRegistry(),
      ports: permissivePorts(),
    });
    const result = service.resolveRoute(
      request({
        requestId: 'req_futures',
        instrumentId: 'FUTURE:US:CL:CONTINUOUS',
        assetClass: 'future',
        accountContexts: Object.freeze([account({ accountId: 'acct_futures_external' })]),
      }),
    );
    assert.equal(result.outcome, 'EXECUTION_ROUTE_UNAVAILABLE');
    assert.equal(result.selectedProviderId, null);
    assert.ok(
      result.rejectedAlternatives.some((row) =>
        row.reasons.includes('EXTERNAL_PROVIDER_REQUIRED'),
      ),
    );
  });

  it('accepts degraded provider when no healthy alternative exists', () => {
    const caps = DEFAULT_EXECUTION_PROVIDER_CAPABILITIES.map((row) =>
      row.providerId.startsWith('sunrey-investments-paper')
        ? Object.freeze({ ...row, healthState: 'DEGRADED' as const })
        : row,
    );
    const service = new ExecutionRoutingService({
      registry: createDefaultProviderCapabilityRegistry(caps),
      ports: permissivePorts(),
    });
    const result = service.resolveRoute(
      request({
        requestId: 'req_degraded_only',
        accountContexts: Object.freeze([
          account({ accountId: 'acct_paper_equity_sandbox' }),
          account({ accountId: 'acct_paper_equity_failover' }),
        ]),
      }),
    );
    assert.equal(result.outcome, 'ROUTE_SELECTED');
    assert.equal(result.failoverApplied, true);
    assert.equal(result.providerCapabilityState, 'DEGRADED');
  });

  it('rejects degraded primary and fails over to secondary provider', () => {
    const caps = withHealth('sunrey-investments-paper', 'acct_paper_equity_sandbox', 'DEGRADED');
    const service = new ExecutionRoutingService({
      registry: createDefaultProviderCapabilityRegistry(caps),
      ports: permissivePorts(),
    });
    const result = service.resolveRoute(
      request({
        requestId: 'req_failover',
        accountContexts: Object.freeze([
          account({ accountId: 'acct_paper_equity_sandbox' }),
          account({ accountId: 'acct_paper_equity_failover' }),
        ]),
      }),
    );
    assert.equal(result.outcome, 'ROUTE_SELECTED');
    assert.equal(result.selectedProviderId, 'sunrey-investments-paper-failover');
    assert.equal(result.failoverApplied, false);
  });

  it('rejects unsupported instrument', () => {
    const service = new ExecutionRoutingService({
      registry: createDefaultProviderCapabilityRegistry(),
      ports: permissivePorts(),
    });
    const result = service.resolveRoute(
      request({ requestId: 'req_bad_instr', instrumentId: 'UNKNOWN:INSTRUMENT:XYZ' }),
    );
    assert.equal(result.outcome, 'EXECUTION_ROUTE_UNAVAILABLE');
    assert.ok(result.rejectedAlternatives.every((row) => row.reasons.includes('UNSUPPORTED_INSTRUMENT')));
  });

  it('rejects unsupported jurisdiction', () => {
    const service = new ExecutionRoutingService({
      registry: createDefaultProviderCapabilityRegistry(),
      ports: permissivePorts(),
    });
    const result = service.resolveRoute(
      request({
        requestId: 'req_bad_jurisdiction',
        jurisdiction: 'JP',
        accountContexts: Object.freeze([account({ accountId: 'acct_paper_equity_sandbox' })]),
      }),
    );
    assert.equal(result.outcome, 'EXECUTION_ROUTE_UNAVAILABLE');
    assert.ok(result.rejectedAlternatives.some((row) => row.reasons.includes('UNSUPPORTED_JURISDICTION')));
  });

  it('rejects unsupported order type', () => {
    const service = new ExecutionRoutingService({
      registry: createDefaultProviderCapabilityRegistry(),
      ports: permissivePorts(),
    });
    const result = service.resolveRoute(
      request({ requestId: 'req_bad_order_type', orderType: 'STOP' }),
    );
    assert.equal(result.outcome, 'EXECUTION_ROUTE_UNAVAILABLE');
    assert.ok(result.rejectedAlternatives.some((row) => row.reasons.includes('UNSUPPORTED_ORDER_TYPE')));
  });

  it('rejects unfunded account', () => {
    const service = new ExecutionRoutingService({
      registry: createDefaultProviderCapabilityRegistry(),
      ports: permissivePorts(),
    });
    const result = service.resolveRoute(
      request({
        requestId: 'req_unfunded',
        accountContexts: Object.freeze([
          account({ accountId: 'acct_paper_equity_sandbox', funded: false, fundingState: 'UNFUNDED' }),
        ]),
      }),
    );
    assert.equal(result.outcome, 'EXECUTION_ROUTE_UNAVAILABLE');
    assert.ok(result.rejectedAlternatives.some((row) => row.reasons.includes('ACCOUNT_NOT_FUNDED')));
  });

  it('rejects uncertified account', () => {
    const service = new ExecutionRoutingService({
      registry: createDefaultProviderCapabilityRegistry(),
      ports: permissivePorts(),
    });
    const result = service.resolveRoute(
      request({
        requestId: 'req_uncertified',
        accountContexts: Object.freeze([
          account({ accountId: 'acct_paper_equity_sandbox', certified: false }),
        ]),
      }),
    );
    assert.equal(result.outcome, 'EXECUTION_ROUTE_UNAVAILABLE');
    assert.ok(result.rejectedAlternatives.some((row) => row.reasons.includes('ACCOUNT_NOT_CERTIFIED')));
  });

  it('selects sandbox provider with sandbox environment posture', () => {
    const service = new ExecutionRoutingService({
      registry: createDefaultProviderCapabilityRegistry(),
      ports: permissivePorts(),
    });
    const result = service.resolveRoute(request({ requestId: 'req_sandbox' }));
    assert.equal(result.providerEnvironment, 'sandbox');
    assert.ok(result.validUntil > T0);
  });

  it('fails closed with no route — no silent substitution', () => {
    const service = new ExecutionRoutingService({
      registry: createDefaultProviderCapabilityRegistry(),
      ports: permissivePorts({ riskPermits: () => false }),
    });
    const result = service.resolveRoute(request({ requestId: 'req_no_route' }));
    assert.equal(result.outcome, 'EXECUTION_ROUTE_UNAVAILABLE');
    assert.equal(result.selectedProviderId, null);
    assert.match(result.selectionReason, /EXECUTION_ROUTE_UNAVAILABLE/);
  });

  it('selects deterministically for identical inputs', () => {
    const registry = createDefaultProviderCapabilityRegistry();
    const ports = permissivePorts();
    const a = new ExecutionRoutingService({ registry, ports, store: new InMemoryExecutionRoutingStore() });
    const b = new ExecutionRoutingService({ registry, ports, store: new InMemoryExecutionRoutingStore() });
    const input = request({ requestId: 'req_deterministic' });
    const r1 = a.resolveRoute(input);
    const r2 = b.resolveRoute({ ...input, at: T0 });
    assert.equal(r1.selectedProviderId, r2.selectedProviderId);
    assert.equal(r1.selectedAccountId, r2.selectedAccountId);
    assert.equal(r1.selectedVenueId, r2.selectedVenueId);
    assert.equal(r1.selectedRouteId, r2.selectedRouteId);
  });

  it('preserves evidence lineage across sequential decisions', () => {
    const store = new InMemoryExecutionRoutingStore();
    const service = new ExecutionRoutingService({
      registry: createDefaultProviderCapabilityRegistry(),
      ports: permissivePorts(),
      store,
    });
    const first = service.resolveRoute(request({ requestId: 'req_lineage', at: T0 }));
    const second = service.resolveRoute(request({ requestId: 'req_lineage', at: T1 }));
    assert.equal(second.evidence.priorEvidenceRef, first.evidence.evidenceRef);
    assert.notEqual(second.decisionId, first.decisionId);
  });

  it('restores routing store after restart', () => {
    const store = new InMemoryExecutionRoutingStore();
    const service = new ExecutionRoutingService({
      registry: createDefaultProviderCapabilityRegistry(),
      ports: permissivePorts(),
      store,
    });
    const before = service.resolveRoute(request({ requestId: 'req_restart' }));
    const snapshot = store.snapshot();
    const restartedStore = new InMemoryExecutionRoutingStore();
    restartedStore.restore(snapshot);
    assert.equal(restartedStore.getDecision(before.decisionId)?.selectedRouteId, before.selectedRouteId);
    assert.equal(restartedStore.snapshot().lastEvidenceRef, before.evidence.evidenceRef);
  });

  it('integrates risk engine refusal', () => {
    const service = new ExecutionRoutingService({
      registry: createDefaultProviderCapabilityRegistry(),
      ports: permissivePorts({ riskPermits: () => false }),
    });
    const result = service.resolveRoute(request({ requestId: 'req_risk' }));
    assert.equal(result.outcome, 'EXECUTION_ROUTE_UNAVAILABLE');
    assert.ok(result.rejectedAlternatives.some((row) => row.reasons.includes('RISK_ENGINE_REFUSED')));
  });

  it('integrates jurisdiction capability denial', () => {
    const service = new ExecutionRoutingService({
      registry: createDefaultProviderCapabilityRegistry(),
      ports: permissivePorts({ jurisdictionPermits: () => false }),
    });
    const result = service.resolveRoute(request({ requestId: 'req_jurisdiction' }));
    assert.equal(result.outcome, 'EXECUTION_ROUTE_UNAVAILABLE');
    assert.ok(result.rejectedAlternatives.some((row) => row.reasons.includes('JURISDICTION_DENIED')));
  });

  it('documents provider route catalog with implementation posture', () => {
    const paper = EXECUTION_PROVIDER_ROUTE_CATALOG.find((row) => row.providerId === 'sunrey-investments-paper');
    const futures = EXECUTION_PROVIDER_ROUTE_CATALOG.find((row) => row.providerId === 'cme_futures_external');
    assert.ok(paper?.sandboxQualified);
    assert.equal(paper?.productionDisabled, true);
    assert.ok(futures?.externallyRequired);
    assert.equal(futures?.implementationStatus, 'EXTERNALLY_REQUIRED');
  });

  it('sandbox provider adapters remain non-live', () => {
    const equity = createSandboxPaperEquityAdapter();
    const crypto = createSandboxCryptoExecutionAdapter();
    const futures = createExternalFuturesAdapter();
    assert.equal(equity.liveProviderConnected, false);
    assert.equal(crypto.productionAuthorized, false);
    assert.equal(futures.describeCapability().externallyRequired, true);
    assert.ok(equity.ping(T0).ok);
    assert.ok(crypto.ping(T0).ok);
    assert.equal(futures.ping(T0).ok, false);
  });

  it('passes HELIOS boundary lint — no Execution Authority issuance', () => {
    const findings = lintHeliosBoundary(process.cwd());
    const routingFindings = findings.filter((row) => row.file.includes('execution-routing'));
    assert.deepEqual(routingFindings, []);
  });

  it('seals evidence compatible with Evidence Vault lineage', () => {
    const vault = new EvidenceVault(new FrozenClock(T0));
    const service = new ExecutionRoutingService({
      registry: createDefaultProviderCapabilityRegistry(),
      ports: permissivePorts(),
    });
    const result = service.resolveRoute(request({ requestId: 'req_vault' }));
    vault.seal('HELIOS_EXECUTION_ROUTING_DECISION', {
      decisionId: result.decisionId,
      outcome: result.outcome,
      selectedRouteId: result.selectedRouteId,
      evidenceRef: result.evidence.evidenceRef,
    });
    assert.equal(vault.verifyChain().length, 1);
  });

  it('HELIOS_MULTI_ASSET_M23_EXECUTION_ROUTING_QUALIFIED when all checks pass', () => {
    const registry = createDefaultProviderCapabilityRegistry();
    const service = new ExecutionRoutingService({ registry, ports: permissivePorts() });

    const equity = service.resolveRoute(request({ requestId: 'q_equity' }));
    const crypto = service.resolveRoute(
      request({
        requestId: 'q_crypto',
        instrumentId: M02_REFERENCE_INSTRUMENT_IDS.BTC,
        assetClass: 'crypto',
        accountContexts: Object.freeze([account({ accountId: 'acct_crypto_sandbox' })]),
      }),
    );
    const futures = service.resolveRoute(
      request({
        requestId: 'q_futures',
        instrumentId: 'FUTURE:US:CL:CONTINUOUS',
        assetClass: 'future',
        accountContexts: Object.freeze([account({ accountId: 'acct_futures_external' })]),
      }),
    );
    const degradedCaps = withHealth('sunrey-investments-paper', 'acct_paper_equity_sandbox', 'DEGRADED');
    const failoverService = new ExecutionRoutingService({
      registry: createDefaultProviderCapabilityRegistry(degradedCaps),
      ports: permissivePorts(),
    });
    const failover = failoverService.resolveRoute(
      request({
        requestId: 'q_failover',
        accountContexts: Object.freeze([
          account({ accountId: 'acct_paper_equity_sandbox' }),
          account({ accountId: 'acct_paper_equity_failover' }),
        ]),
      }),
    );
    const unsupported = service.resolveRoute(
      request({ requestId: 'q_unsupported', instrumentId: 'UNKNOWN:XYZ' }),
    );
    const badJurisdiction = service.resolveRoute(
      request({ requestId: 'q_jurisdiction', jurisdiction: 'JP' }),
    );
    const badOrderType = service.resolveRoute(request({ requestId: 'q_order_type', orderType: 'STOP' }));
    const unfunded = service.resolveRoute(
      request({
        requestId: 'q_unfunded',
        accountContexts: Object.freeze([
          account({ accountId: 'acct_paper_equity_sandbox', funded: false, fundingState: 'UNFUNDED' }),
        ]),
      }),
    );
    const uncertified = service.resolveRoute(
      request({
        requestId: 'q_uncertified',
        accountContexts: Object.freeze([
          account({ accountId: 'acct_paper_equity_sandbox', certified: false }),
        ]),
      }),
    );
    const noRouteService = new ExecutionRoutingService({
      registry,
      ports: permissivePorts({ mandateActive: () => false }),
    });
    const noRouteResult = noRouteService.resolveRoute(request({ requestId: 'q_no_route_real' }));

    const store = new InMemoryExecutionRoutingStore();
    const lineageService = new ExecutionRoutingService({ registry, ports: permissivePorts(), store });
    const first = lineageService.resolveRoute(request({ requestId: 'q_lineage', at: T0 }));
    const second = lineageService.resolveRoute(request({ requestId: 'q_lineage', at: T1 }));
    const snap = store.snapshot();
    const restored = new InMemoryExecutionRoutingStore();
    restored.restore(snap);

    const detA = new ExecutionRoutingService({
      registry,
      ports: permissivePorts(),
      store: new InMemoryExecutionRoutingStore(),
    });
    const detB = new ExecutionRoutingService({
      registry,
      ports: permissivePorts(),
      store: new InMemoryExecutionRoutingStore(),
    });
    const d1 = detA.resolveRoute(request({ requestId: 'q_det' }));
    const d2 = detB.resolveRoute(request({ requestId: 'q_det' }));

    const qualification = evaluateM23ExecutionRoutingQualification({
      eligibleEquityProvider: equity.outcome === 'ROUTE_SELECTED',
      eligibleCryptoProvider: crypto.outcome === 'ROUTE_SELECTED',
      futuresProviderUnavailable: futures.outcome === 'EXECUTION_ROUTE_UNAVAILABLE',
      providerDegradedHandled:
        failover.outcome === 'ROUTE_SELECTED' &&
        failover.selectedProviderId === 'sunrey-investments-paper-failover',
      unsupportedInstrumentRejected: unsupported.outcome === 'EXECUTION_ROUTE_UNAVAILABLE',
      unsupportedJurisdictionRejected: badJurisdiction.outcome === 'EXECUTION_ROUTE_UNAVAILABLE',
      unsupportedOrderTypeRejected: badOrderType.outcome === 'EXECUTION_ROUTE_UNAVAILABLE',
      accountNotFundedRejected: unfunded.outcome === 'EXECUTION_ROUTE_UNAVAILABLE',
      accountNotCertifiedRejected: uncertified.outcome === 'EXECUTION_ROUTE_UNAVAILABLE',
      sandboxProviderSelected: equity.providerEnvironment === 'sandbox',
      noRouteFailsClosed: noRouteResult.outcome === 'EXECUTION_ROUTE_UNAVAILABLE',
      deterministicSelection:
        d1.selectedProviderId === d2.selectedProviderId &&
        d1.selectedAccountId === d2.selectedAccountId &&
        d1.selectedVenueId === d2.selectedVenueId,
      providerFailover:
        failover.selectedProviderId === 'sunrey-investments-paper-failover' &&
        failover.selectedProviderId !== 'sunrey-investments-paper',
      evidenceLineage: second.evidence.priorEvidenceRef === first.evidence.evidenceRef,
      restartPersistence: restored.getDecision(first.decisionId)?.selectedRouteId === first.selectedRouteId,
      noExecutionAuthorityIssued:
        !equity.grantsExecutionAuthority && !crypto.grantsExecutionAuthority && !futures.grantsExecutionAuthority,
      productionDisabled: !LIVE_INVESTMENT_EXECUTION && !LIVE_TRADING_ENABLED && ENVIRONMENT === 'simulation',
      extendsCanonicalProviders:
        equity.selectedProviderId === 'sunrey-investments-paper' &&
        crypto.selectedProviderId === 'sandbox_helios_investment_v1',
    });

    assert.equal(
      qualification.marker,
      HELIOS_MULTI_ASSET_M23_EXECUTION_ROUTING_QUALIFIED,
      qualification.blockers.join('; '),
    );
    assert.match(qualification.marker, /^HELIOS_MULTI_ASSET_M23_/);
  });
});
