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

const LIVE_FLAG = process.env.PROVIDERS_LIVE_CERTIFY === '1';
const ENABLED_IDS = new Set(
  (process.env.PROVIDERS_LIVE_CERTIFY_IDS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean),
);

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

const service = createProviderCertificationService({
  environment: ENVIRONMENT === 'production' ? 'production' : 'sandbox',
});

const networkProbeByProvider: Record<string, () => Promise<NetworkProbeOutcome>> = {};
for (const providerId of ENABLED_IDS) {
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
