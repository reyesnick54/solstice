#!/usr/bin/env node
/**
 * Controlled live provider certification.
 *
 * Requires PROVIDERS_LIVE_CERTIFY=1 and explicit provider IDs via
 * PROVIDERS_LIVE_CERTIFY_IDS (comma-separated). Never runs in normal CI.
 * Never prints secret values.
 */
import { createProviderCertificationService } from '../packages/provider-sdk/src/certification/service.ts';
import type { NetworkProbeOutcome } from '../packages/provider-sdk/src/certification/engine.ts';
import { ENVIRONMENT } from '../packages/config/src/flags.ts';
import {
  certifyOpportunityProvider,
} from '../packages/external-data/src/certification/opportunity-runner.ts';
import type { OpportunityAdapterId } from '../packages/external-data/src/wave6/adapters/index.ts';
import type { ProviderCertificationResult } from '../packages/external-data/src/certification/types.ts';
import {
  fetchLiveFxRate,
  fetchLiveWorldBankIndicator,
  type EconomicLiveProbeResult,
} from '../packages/external-data/src/wave2/live-economic.ts';
import { OPPORTUNITY_ADAPTER_IDS } from '../packages/external-data/src/wave6/adapters/index.ts';

const LIVE_FLAG = process.env.PROVIDERS_LIVE_CERTIFY === '1';
const ENABLED_IDS = new Set(
  (process.env.PROVIDERS_LIVE_CERTIFY_IDS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean),
);

const OPPORTUNITY_IDS = new Set<string>(OPPORTUNITY_ADAPTER_IDS);
const ECONOMIC_PROBES: Record<string, () => Promise<EconomicLiveProbeResult>> = Object.freeze({
  frankfurter: fetchLiveFxRate,
  'world-bank': fetchLiveWorldBankIndicator,
});

if (!LIVE_FLAG) {
  console.error('PROVIDERS_LIVE_CERTIFY=1 is required for live provider certification');
  process.exit(2);
}

if (ENABLED_IDS.size === 0) {
  console.error('PROVIDERS_LIVE_CERTIFY_IDS must list at least one provider id');
  process.exit(2);
}

if (ENVIRONMENT === 'simulation' && process.env.PROVIDERS_LIVE_CERTIFY_ALLOW_SIMULATION !== '1') {
  console.error(
    'Live certification in simulation requires PROVIDERS_LIVE_CERTIFY_ALLOW_SIMULATION=1',
  );
  process.exit(2);
}

function mapOpportunityResult(result: ProviderCertificationResult): NetworkProbeOutcome {
  return Object.freeze({
    reachable: result.liveCall && result.error === null,
    authenticated: true,
    responseValidated: result.validated,
    liveNetworkCallObserved: result.liveCall,
    productionEndpointUsed: result.provenance.productionEndpointUsed,
    simulated: result.provenance.simulated,
    endpointClass: result.provenance.productionEndpointUsed ? 'production' : 'sandbox',
    latencyMs: result.latencyMs,
    failureCode: result.validated
      ? null
      : result.status === 'BLOCKED'
        ? 'PROVIDER_UNAVAILABLE'
        : result.liveCall
          ? 'INVALID_RESPONSE'
          : 'NOT_CONFIGURED',
    message: result.error ?? undefined,
  });
}

function mapEconomicResult(result: EconomicLiveProbeResult): NetworkProbeOutcome {
  return Object.freeze({
    reachable: result.liveCall && result.error === null,
    authenticated: true,
    responseValidated: result.validated,
    liveNetworkCallObserved: result.liveCall,
    productionEndpointUsed: result.provenance.productionEndpointUsed,
    simulated: result.provenance.simulated,
    endpointClass: result.provenance.productionEndpointUsed ? 'production' : 'sandbox',
    latencyMs: result.latencyMs,
    failureCode: result.validated ? null : result.liveCall ? 'INVALID_RESPONSE' : 'NOT_CONFIGURED',
    message: result.error ?? undefined,
  });
}

const service = createProviderCertificationService({
  environment: ENVIRONMENT === 'production' ? 'production' : 'sandbox',
});

const networkProbeByProvider: Record<string, () => Promise<NetworkProbeOutcome>> = {};
for (const providerId of ENABLED_IDS) {
  if (OPPORTUNITY_IDS.has(providerId)) {
    networkProbeByProvider[providerId] = async () =>
      mapOpportunityResult(await certifyOpportunityProvider(providerId as OpportunityAdapterId, true));
    continue;
  }
  const economicProbe = ECONOMIC_PROBES[providerId];
  if (economicProbe) {
    networkProbeByProvider[providerId] = async () => mapEconomicResult(await economicProbe());
    continue;
  }
  if (!service.catalogHas(providerId)) {
    continue;
  }
  networkProbeByProvider[providerId] = async () =>
    Object.freeze({
      reachable: false,
      authenticated: false,
      responseValidated: false,
      liveNetworkCallObserved: false,
      productionEndpointUsed: false,
      simulated: false,
      endpointClass: 'sandbox' as const,
      latencyMs: null,
      failureCode: 'MISSING_CREDENTIALS' as const,
      message: 'live probe stub — configure provider-specific live probe',
    });
}

const report = await service.certifyAllCatalogEntriesAsync({
  providerIds: [...ENABLED_IDS],
  liveProbeEnabled: true,
  explicitlyEnabledProviderIds: ENABLED_IDS,
  networkProbeByProvider,
});

const results = report.providers.map((entry) => {
  const outcome =
    entry.evidence.some((e) => e.outcome === 'SKIPPED')
      ? 'SKIPPED'
      : entry.failureCode
        ? 'FAIL'
        : entry.liveNetworkCallObserved
          ? 'PASS'
          : entry.credentialsPresent === false &&
              entry.evidence.some((e) => e.probe === 'credentials' && e.outcome === 'FAIL')
            ? 'SKIPPED'
            : 'FAIL';
  return Object.freeze({
    providerId: entry.providerId,
    outcome,
    status: entry.status,
    failureCode: entry.failureCode,
    liveNetworkCallObserved: entry.liveNetworkCallObserved,
    simulated: entry.simulated,
  });
});

console.log(
  JSON.stringify(
    Object.freeze({
      mode: 'live',
      environment: report.environment,
      generatedAt: report.generatedAt,
      summary: report.summary,
      results,
    }),
    null,
    2,
  ),
);

const failed = results.filter((r) => r.outcome === 'FAIL');
process.exit(failed.length > 0 ? 1 : 0);
