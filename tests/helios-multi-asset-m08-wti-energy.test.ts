/**
 * HELIOS Multi-Asset Expansion M08 — WTI Energy Market Intelligence.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  HELIOS_MULTI_ASSET_M08_WTI_ENERGY_DATA_QUALIFIED,
  WTI_COMMODITY_REFERENCE_ID,
  WTI_CONTINUOUS_SERIES,
  WTI_FUTURES_FAMILY,
  WTI_OIL_ETF_PROXY_ID,
  WTI_REGISTERED_CONTRACTS,
  OIL_ETF_PROXY,
  WTI_COMMODITY_REFERENCE,
  assertDistinctIdentity,
  assess4hTrendReadiness,
  assessFirstNotice,
  composeWtiMarketState,
  createHeliosWtiEnergyRoute,
  createWtiEnergyMarketService,
  createWtiMarketStore,
  createWtiSandboxProvider,
  evaluateRollState,
  evaluateWtiEnergyQualification,
  generateM05M08CoverageReport,
  hooksForInstrument,
  resolveForExecution,
  resolveWtiIdentity,
  WTI_EVENT_METADATA_HOOKS,
  contractIdForMonth,
} from '../packages/platform/src/helios/multi-asset/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const NOW = asUtcInstant('2026-09-16T12:00:00.000Z');

describe('HELIOS M08 WTI energy market intelligence', () => {
  it('registers distinct WTI/oil identities that are not interchangeable', () => {
    assert.equal(resolveWtiIdentity(WTI_OIL_ETF_PROXY_ID)?.kind, 'security_etf_proxy');
    assert.equal(resolveWtiIdentity(WTI_COMMODITY_REFERENCE_ID)?.kind, 'commodity_reference');
    assert.equal(resolveWtiIdentity(WTI_FUTURES_FAMILY.familyId)?.kind, 'futures_family');
    assert.equal(resolveWtiIdentity(WTI_CONTINUOUS_SERIES.continuousId)?.kind, 'futures_continuous');
    assert.equal(resolveWtiIdentity(WTI_REGISTERED_CONTRACTS[1]!.contractId)?.kind, 'futures_contract');

    assert.equal(OIL_ETF_PROXY.proxyFor, WTI_COMMODITY_REFERENCE_ID);
    assert.notEqual(WTI_OIL_ETF_PROXY_ID, WTI_COMMODITY_REFERENCE_ID);

    const distinct = assertDistinctIdentity(WTI_OIL_ETF_PROXY_ID, WTI_COMMODITY_REFERENCE_ID);
    assert.equal(distinct.ok, true);

    assert.equal(WTI_COMMODITY_REFERENCE.unit, 'barrel');
    assert.equal(WTI_COMMODITY_REFERENCE.commodityCode, 'wti');
  });

  it('exposes WTI reference identity with commodity schema', () => {
    assert.equal(WTI_COMMODITY_REFERENCE.instrumentId, 'COMMODITY:wti:USD:barrel');
    assert.equal(WTI_COMMODITY_REFERENCE.symbol, 'WTI');
  });

  it('registers oil ETF proxy separately from WTI futures', () => {
    assert.equal(OIL_ETF_PROXY.symbol, 'USO');
    assert.equal(OIL_ETF_PROXY.assetClass, 'etf');
    assert.equal(OIL_ETF_PROXY.venueId, 'ARCX');
  });

  it('registers WTI futures family and contract identities', () => {
    assert.equal(WTI_FUTURES_FAMILY.exchange, 'NYMEX');
    assert.equal(WTI_FUTURES_FAMILY.rootSymbol, 'CL');
    assert.equal(WTI_REGISTERED_CONTRACTS.length >= 4, true);

    const june = WTI_REGISTERED_CONTRACTS.find((c) => c.contractMonth === '2026-06');
    assert.ok(june);
    assert.equal(june.contractId, contractIdForMonth('2026-06'));
    assert.equal(june.executability, 'EXECUTABLE');
  });

  it('includes expiration, multiplier, settlement, and first-notice metadata', () => {
    const contract = WTI_REGISTERED_CONTRACTS[1]!;
    assert.ok(contract.metadata.expirationDate);
    assert.ok(contract.metadata.lastTradeDate);
    assert.ok(contract.metadata.firstNoticeDate);
    assert.ok(contract.metadata.settlementDate);
    assert.equal(contract.metadata.multiplierMinorUnits, 100000n);
    assert.equal(contract.metadata.currency, 'USD');
  });

  it('evaluates roll logic with front contract resolution', () => {
    const roll = evaluateRollState({
      familyId: WTI_FUTURES_FAMILY.familyId,
      contracts: WTI_REGISTERED_CONTRACTS,
      nowUtc: NOW,
    });
    assert.ok(roll.frontContractId);
    assert.equal(roll.frontContractId.includes('2026-'), true);
    assert.ok(['FRONT', 'BACK', 'ROLLING', 'POST_ROLL'].includes(roll.rollState));
  });

  it('handles first-notice assessment', () => {
    const contract = WTI_REGISTERED_CONTRACTS[0]!;
    const assessment = assessFirstNotice({ contract, nowUtc: NOW, noticeWindowDays: 30 });
    assert.equal(assessment.contractId, contract.contractId);
    assert.ok(assessment.firstNoticeDate);
    assert.equal(typeof assessment.requiresRoll, 'boolean');
  });

  it('provides 4h OHLCV bars and proves trend data readiness', async () => {
    const service = createWtiEnergyMarketService();
    const bars = await service.get4hBars(WTI_CONTINUOUS_SERIES.continuousId, NOW);
    assert.equal(bars.ok, true);
    if (bars.ok) {
      assert.equal(bars.value.length >= 10, true);
      assert.equal(bars.value.every((b) => b.interval === '4h'), true);
      const readiness = assess4hTrendReadiness(bars.value);
      assert.equal(readiness.qualified, true);
      assert.equal(readiness.interval, '4h');
      assert.ok(readiness.latestBarCloseTime);
    }
  });

  it('supports 1h and 1d bars plus quote and volume', async () => {
    const service = createWtiEnergyMarketService();
    const quote = await service.getQuote(WTI_COMMODITY_REFERENCE_ID, NOW);
    assert.equal(quote.ok, true);
    if (quote.ok) {
      assert.ok(quote.value.quote.lastMinorUnits);
      assert.ok(quote.value.quote.volumeUnits);
      assert.equal(quote.value.quote.sessionStatus, 'OPEN');
    }

    for (const interval of ['1h', '1d'] as const) {
      const bars = await service.getBars({ instrumentId: WTI_COMMODITY_REFERENCE_ID, interval }, NOW);
      assert.equal(bars.ok, true);
      if (bars.ok) {
        assert.equal(bars.value.length > 0, true);
      }
    }
  });

  it('provides continuous series for research but blocks execution authority', () => {
    const continuousId = WTI_CONTINUOUS_SERIES.continuousId;
    const resolution = resolveForExecution(continuousId);
    assert.equal(resolution.ok, false);
    if (!resolution.ok) {
      assert.equal(resolution.code, 'CONTINUOUS_SERIES_NON_EXECUTABLE');
      assert.equal(resolution.executability, 'RESEARCH_ONLY');
    }
  });

  it('resolves execution to specific executable contract only', async () => {
    const service = createWtiEnergyMarketService();
    const contract = WTI_REGISTERED_CONTRACTS[1]!;
    const resolved = service.resolveExecutionContract(contract.contractId, NOW);
    assert.equal(resolved.ok, true);
    if (resolved.ok) {
      assert.equal(resolved.contractId, contract.contractId);
    }

    const continuous = service.resolveExecutionContract(WTI_CONTINUOUS_SERIES.continuousId, NOW);
    assert.equal(continuous.ok, false);
  });

  it('handles provider failure without fixture fallback', async () => {
    const provider = createWtiSandboxProvider({ simulateFailure: true });
    const service = createWtiEnergyMarketService({ provider });
    const result = await service.getQuote(WTI_COMMODITY_REFERENCE_ID, NOW);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, 'PROVIDER_UNAVAILABLE');
      assert.equal(result.routeStatus, 'UNAVAILABLE');
    }
  });

  it('surfaces stale data with STALE route status', async () => {
    const provider = createWtiSandboxProvider({ simulateStale: true, staleAgeMs: 7_200_000 });
    const service = createWtiEnergyMarketService({ provider });
    const result = await service.getQuote(WTI_COMMODITY_REFERENCE_ID, NOW);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.routeStatus, 'STALE');
    }
  });

  it('handles entitlement denial', async () => {
    const provider = createWtiSandboxProvider({ simulateEntitlementDenied: true });
    const service = createWtiEnergyMarketService({ provider });
    const result = await service.getQuote(WTI_COMMODITY_REFERENCE_ID, NOW);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, 'ENTITLEMENT_DENIED');
      assert.equal(result.routeStatus, 'ENTITLEMENT_DENIED');
    }
  });

  it('persists observations and market state across store round-trip', async () => {
    const store = createWtiMarketStore();
    const service = createWtiEnergyMarketService({ store });
    await service.buildMarketState(NOW);
    const snapshot = store.snapshot();
    assert.ok(snapshot.marketStates.length > 0);
    assert.ok(Object.keys(snapshot.observations).length > 0);

    const restored = createWtiMarketStore();
    restored.restore(snapshot);
    assert.equal(restored.listObservations().length, store.listObservations().length);
    assert.deepEqual(restored.latestMarketState()?.futuresFamilyId, WTI_FUTURES_FAMILY.familyId);
  });

  it('composes MarketState with roll context and 4h trend readiness', async () => {
    const service = createWtiEnergyMarketService();
    const state = await service.buildMarketState(NOW);
    assert.ok(state.commodityReference);
    assert.ok(state.oilEtfProxy);
    assert.ok(state.continuousSeries);
    assert.ok(state.frontContract);
    assert.equal(state.futuresFamilyId, WTI_FUTURES_FAMILY.familyId);
    assert.ok(state.rollContext.frontContractId);
    assert.equal(state.trendReadiness4h.qualified, true);
    assert.equal(state.trendReadiness4h.barCount >= 10, true);
  });

  it('registers event-ready metadata hooks without trading logic', () => {
    assert.equal(WTI_EVENT_METADATA_HOOKS.length, 5);
    for (const hook of WTI_EVENT_METADATA_HOOKS) {
      assert.equal(hook.researchEnabled, true);
      assert.equal(hook.tradingEnabled, false);
    }
    const inventoryHooks = hooksForInstrument(WTI_COMMODITY_REFERENCE_ID);
    assert.equal(inventoryHooks.some((h) => h.category === 'crude_inventory_report'), true);
  });

  it('passes HELIOS architectural boundary lint', () => {
    const findings = lintHeliosBoundary(process.cwd());
    assert.equal(findings.length, 0, findings.map((f) => f.message).join('; '));
  });

  it('qualifies with HELIOS_MULTI_ASSET_M08_WTI_ENERGY_DATA_QUALIFIED marker', async () => {
    const service = createWtiEnergyMarketService();
    const state = await service.buildMarketState(NOW);
    const bars4h = await service.get4hBars(WTI_CONTINUOUS_SERIES.continuousId, NOW);
    const store = service.store;
    const snapshot = store.snapshot();
    const restored = createWtiMarketStore();
    restored.restore(snapshot);

    const continuousExec = resolveForExecution(WTI_CONTINUOUS_SERIES.continuousId);
    const failureProvider = createWtiSandboxProvider({ simulateFailure: true });
    const staleProvider = createWtiSandboxProvider({ simulateStale: true });
    const entitlementProvider = createWtiSandboxProvider({ simulateEntitlementDenied: true });

    const checks = {
      wtiReferenceIdentity: resolveWtiIdentity(WTI_COMMODITY_REFERENCE_ID)?.kind === 'commodity_reference',
      oilProxyIdentity: resolveWtiIdentity(WTI_OIL_ETF_PROXY_ID)?.kind === 'security_etf_proxy',
      futuresFamilyIdentity: resolveWtiIdentity(WTI_FUTURES_FAMILY.familyId)?.kind === 'futures_family',
      contractIdentity: resolveWtiIdentity(WTI_REGISTERED_CONTRACTS[0]!.contractId)?.kind === 'futures_contract',
      expirationMetadata: Boolean(WTI_REGISTERED_CONTRACTS[0]!.metadata.expirationDate),
      rollLogic: Boolean(state.rollContext.frontContractId),
      firstNoticeHandling: Boolean(assessFirstNotice({ contract: WTI_REGISTERED_CONTRACTS[0]!, nowUtc: NOW }).firstNoticeDate),
      fourHourBars: bars4h.ok && bars4h.value.length >= 10,
      continuousSeriesResearch: Boolean(state.continuousSeries),
      continuousSeriesNonExecutable: !continuousExec.ok && continuousExec.code === 'CONTINUOUS_SERIES_NON_EXECUTABLE',
      providerFailureHandling: !(await createWtiEnergyMarketService({ provider: failureProvider }).getQuote(WTI_COMMODITY_REFERENCE_ID, NOW)).ok,
      staleDataHandling: (await createWtiEnergyMarketService({ provider: staleProvider }).getQuote(WTI_COMMODITY_REFERENCE_ID, NOW)).routeStatus === 'STALE',
      entitlementHandling: !(await createWtiEnergyMarketService({ provider: entitlementProvider }).getQuote(WTI_COMMODITY_REFERENCE_ID, NOW)).ok,
      persistenceRoundTrip: restored.listObservations().length === store.listObservations().length,
      marketStateComposition: Boolean(state.commodityReference && state.frontContract),
      trendReadiness4h: state.trendReadiness4h.qualified,
      eventMetadataHooks: WTI_EVENT_METADATA_HOOKS.length >= 5,
      distinctIdentityEnforcement: assertDistinctIdentity(WTI_OIL_ETF_PROXY_ID, WTI_COMMODITY_REFERENCE_ID).ok,
    };

    const result = evaluateWtiEnergyQualification(checks);
    assert.equal(result.qualified, true);
    assert.equal(result.marker, HELIOS_MULTI_ASSET_M08_WTI_ENERGY_DATA_QUALIFIED);
    assert.equal(result.blockers.length, 0);
  });

  it('generates M05-M08 data coverage report', () => {
    const report = generateM05M08CoverageReport(NOW);
    assert.equal(report.reportId, 'helios-multi-asset-m05-m08-coverage');
    assert.equal(report.assetClasses.length, 4);
    assert.equal(report.qualificationMarkers.M08, HELIOS_MULTI_ASSET_M08_WTI_ENERGY_DATA_QUALIFIED);

    const oil = report.assetClasses.find((a) => a.milestone === 'M08');
    assert.ok(oil);
    assert.equal(oil.status, 'qualified');
    assert.equal(oil.identities.includes(WTI_COMMODITY_REFERENCE_ID), true);
    assert.equal(oil.supportedIntervals.includes('4h'), true);
  });

  it('integrates via HeliosWtiEnergyRoute', async () => {
    const route = createHeliosWtiEnergyRoute();
    const state = await route.fetchMarketState(NOW);
    assert.ok(state.trendReadiness4h.qualified);
    const snapshot = await route.snapshot(NOW, true);
    assert.equal(snapshot.routeId, 'helios.multi-asset.wti-energy');
    assert.equal(snapshot.qualificationMarker, HELIOS_MULTI_ASSET_M08_WTI_ENERGY_DATA_QUALIFIED);
  });
});
