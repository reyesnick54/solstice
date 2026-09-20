#!/usr/bin/env node
/**
 * HELIOS M08 WTI energy market intelligence qualification harness.
 */

import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  HELIOS_MULTI_ASSET_M08_WTI_ENERGY_DATA_QUALIFIED,
  WTI_COMMODITY_REFERENCE_ID,
  WTI_CONTINUOUS_SERIES,
  WTI_FUTURES_FAMILY,
  WTI_OIL_ETF_PROXY_ID,
  WTI_REGISTERED_CONTRACTS,
  assertDistinctIdentity,
  assessFirstNotice,
  createWtiEnergyMarketService,
  createWtiMarketStore,
  createWtiSandboxProvider,
  evaluateWtiEnergyQualification,
  generateM05M08CoverageReport,
  resolveForExecution,
  resolveWtiIdentity,
  WTI_EVENT_METADATA_HOOKS,
} from '../packages/platform/src/helios/multi-asset/index.ts';

async function main(): Promise<void> {
  const nowUtc = asUtcInstant(new Date().toISOString());
  const service = createWtiEnergyMarketService();
  const state = await service.buildMarketState(nowUtc);
  const bars4h = await service.get4hBars(WTI_CONTINUOUS_SERIES.continuousId, nowUtc);

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
    firstNoticeHandling: Boolean(
      assessFirstNotice({ contract: WTI_REGISTERED_CONTRACTS[0]!, nowUtc }).firstNoticeDate,
    ),
    fourHourBars: bars4h.ok && bars4h.value.length >= 10,
    continuousSeriesResearch: Boolean(state.continuousSeries),
    continuousSeriesNonExecutable:
      !continuousExec.ok && continuousExec.code === 'CONTINUOUS_SERIES_NON_EXECUTABLE',
    providerFailureHandling: !(await createWtiEnergyMarketService({ provider: failureProvider }).getQuote(
      WTI_COMMODITY_REFERENCE_ID,
      nowUtc,
    )).ok,
    staleDataHandling:
      (await createWtiEnergyMarketService({ provider: staleProvider }).getQuote(
        WTI_COMMODITY_REFERENCE_ID,
        nowUtc,
      )).routeStatus === 'STALE',
    entitlementHandling: !(await createWtiEnergyMarketService({ provider: entitlementProvider }).getQuote(
      WTI_COMMODITY_REFERENCE_ID,
      nowUtc,
    )).ok,
    persistenceRoundTrip: restored.listObservations().length === store.listObservations().length,
    marketStateComposition: Boolean(state.commodityReference && state.frontContract),
    trendReadiness4h: state.trendReadiness4h.qualified,
    eventMetadataHooks: WTI_EVENT_METADATA_HOOKS.length >= 5,
    distinctIdentityEnforcement: assertDistinctIdentity(WTI_OIL_ETF_PROXY_ID, WTI_COMMODITY_REFERENCE_ID).ok,
  };

  const qualification = evaluateWtiEnergyQualification(checks);
  const coverage = generateM05M08CoverageReport(nowUtc);

  const report = {
    command: 'helios:m08:wti:qualify',
    marker: qualification.marker,
    qualified: qualification.qualified,
    blockers: qualification.blockers,
    checks,
    trendReadiness4h: state.trendReadiness4h,
    coverageReport: coverage,
    secretValuePresent: false,
  };

  console.log(JSON.stringify(report, null, 2));
  process.exit(qualification.marker === HELIOS_MULTI_ASSET_M08_WTI_ENERGY_DATA_QUALIFIED ? 0 : 1);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ command: 'helios:m08:wti:qualify', error: message, secretValuePresent: false }, null, 2));
  process.exit(1);
});
