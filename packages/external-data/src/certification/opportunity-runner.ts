/**
 * Live provider certification runner for opportunity and economic data adapters.
 */

import { asUtcInstant } from '../../../domain/src/time.ts';
import {
  createAllOpportunityAdapters,
  createOpportunityAdapter,
  type OpportunityAdapterId,
} from '../wave6/adapters/index.ts';
import { LIVE_OPPORTUNITY_JOB_PROVIDER_IDS } from '../wave6/http/endpoints.ts';
import { fetchLiveFxRate, fetchLiveWorldBankIndicator } from '../wave2/live-economic.ts';
import {
  certificationStatusFromResult,
  type ProviderCertificationReport,
  type ProviderCertificationResult,
} from './types.ts';

export type CertificationRunnerOptions = {
  readonly allowNetwork?: boolean;
  readonly providerIds?: readonly string[];
};

const LIVE_ECONOMIC_PROBES = Object.freeze([
  { providerId: 'frankfurter', probe: () => fetchLiveFxRate() },
  { providerId: 'world-bank', probe: () => fetchLiveWorldBankIndicator() },
] as const);

export async function certifyOpportunityProvider(
  providerId: OpportunityAdapterId,
  allowNetwork: boolean,
): Promise<ProviderCertificationResult> {
  const certifiedAtUtc = asUtcInstant(new Date().toISOString());
  const adapter = createOpportunityAdapter(providerId, { mode: allowNetwork ? 'live' : 'simulation' });
  const nowUtc = certifiedAtUtc;

  if (!allowNetwork || !adapter.liveCapable) {
    if (adapter.capabilities.includes('job_search')) {
      const simulated = await adapter.searchJobs({ limit: 3 }, nowUtc);
      const implemented = simulated.ok || simulated.code === 'PROVIDER_UNAVAILABLE';
      return Object.freeze({
        providerId,
        status: certificationStatusFromResult({
          liveCall: false,
          validated: simulated.ok,
          implemented,
          blocked: !simulated.ok && simulated.code === 'PROVIDER_UNAVAILABLE',
        }),
        liveCall: false,
        validated: simulated.ok,
        latencyMs: simulated.execution?.latencyMs ?? null,
        httpStatus: simulated.execution?.httpStatus ?? null,
        resultCount: simulated.ok ? simulated.value.length : null,
        error: simulated.ok ? null : simulated.message,
        provenance: simulated.execution ?? {
          simulated: true,
          liveNetworkCallObserved: false,
          productionEndpointUsed: false,
          fromCache: false,
          httpStatus: null,
          latencyMs: null,
        },
        certifiedAtUtc,
      });
    }

    const intel = adapter.getPublicIntelligence ? await adapter.getPublicIntelligence(nowUtc) : null;
    return Object.freeze({
      providerId,
      status: intel?.ok ? 'IMPLEMENTED' : intel ? 'BLOCKED' : 'IMPLEMENTED',
      liveCall: false,
      validated: intel?.ok ?? true,
      latencyMs: intel?.execution?.latencyMs ?? null,
      httpStatus: intel?.execution?.httpStatus ?? null,
      resultCount: intel?.ok ? intel.value.length : null,
      error: intel && !intel.ok ? intel.message : null,
      provenance: intel?.execution ?? {
        simulated: true,
        liveNetworkCallObserved: false,
        productionEndpointUsed: false,
        fromCache: false,
        httpStatus: null,
        latencyMs: null,
      },
      certifiedAtUtc,
    });
  }

  if (adapter.capabilities.includes('job_search')) {
    const result = await adapter.searchJobs({ limit: 5 }, nowUtc);
    const validated = result.ok && (result.execution?.liveNetworkCallObserved ?? false) && result.value.length > 0;
    return Object.freeze({
      providerId,
      status: certificationStatusFromResult({
        liveCall: result.execution?.liveNetworkCallObserved ?? false,
        validated,
        implemented: true,
        blocked: false,
      }),
      liveCall: result.execution?.liveNetworkCallObserved ?? false,
      validated,
      latencyMs: result.execution?.latencyMs ?? null,
      httpStatus: result.execution?.httpStatus ?? null,
      resultCount: result.ok ? result.value.length : null,
      error: result.ok ? null : result.message,
      provenance: result.execution ?? {
        simulated: false,
        liveNetworkCallObserved: false,
        productionEndpointUsed: false,
        fromCache: false,
        httpStatus: null,
        latencyMs: null,
      },
      certifiedAtUtc,
    });
  }

  if (adapter.getPublicIntelligence) {
    const result = await adapter.getPublicIntelligence(nowUtc);
    const validated = result.ok && (result.execution?.liveNetworkCallObserved ?? false) && result.value.length > 0;
    return Object.freeze({
      providerId,
      status: certificationStatusFromResult({
        liveCall: result.execution?.liveNetworkCallObserved ?? false,
        validated,
        implemented: true,
        blocked: false,
      }),
      liveCall: result.execution?.liveNetworkCallObserved ?? false,
      validated,
      latencyMs: result.execution?.latencyMs ?? null,
      httpStatus: result.execution?.httpStatus ?? null,
      resultCount: result.ok ? result.value.length : null,
      error: result.ok ? null : result.message,
      provenance: result.execution ?? {
        simulated: false,
        liveNetworkCallObserved: false,
        productionEndpointUsed: false,
        fromCache: false,
        httpStatus: null,
        latencyMs: null,
      },
      certifiedAtUtc,
    });
  }

  return Object.freeze({
    providerId,
    status: 'IMPLEMENTED',
    liveCall: false,
    validated: false,
    latencyMs: null,
    httpStatus: null,
    resultCount: null,
    error: 'no certifiable capability',
    provenance: {
      simulated: true,
      liveNetworkCallObserved: false,
      productionEndpointUsed: false,
      fromCache: false,
      httpStatus: null,
      latencyMs: null,
    },
    certifiedAtUtc,
  });
}

export async function runOpportunityCertification(
  options: CertificationRunnerOptions = {},
): Promise<ProviderCertificationReport> {
  const allowNetwork =
    options.allowNetwork ??
    (process.env.PROVIDERS_LIVE_CERTIFY === '1' || process.env.SUNREY_LIVE_CERTIFICATION === '1');
  const providerIds = options.providerIds ?? [...createAllOpportunityAdapters().map((p) => p.providerId)];
  const results: ProviderCertificationResult[] = [];
  for (const providerId of providerIds) {
    results.push(await certifyOpportunityProvider(providerId as OpportunityAdapterId, allowNetwork));
  }
  return Object.freeze({
    certifiedAtUtc: asUtcInstant(new Date().toISOString()),
    environmentAllowsNetwork: allowNetwork,
    results: Object.freeze(results),
  });
}

export async function runEconomicCertification(
  allowNetwork =
    process.env.PROVIDERS_LIVE_CERTIFY === '1' || process.env.SUNREY_LIVE_CERTIFICATION === '1',
): Promise<readonly ProviderCertificationResult[]> {
  const certifiedAtUtc = asUtcInstant(new Date().toISOString());
  const results: ProviderCertificationResult[] = [];
  for (const probe of LIVE_ECONOMIC_PROBES) {
    if (!allowNetwork) {
      results.push(
        Object.freeze({
          providerId: probe.providerId,
          status: 'IMPLEMENTED',
          liveCall: false,
          validated: false,
          latencyMs: null,
          httpStatus: null,
          resultCount: null,
          error: 'network disabled',
          provenance: {
            simulated: true,
            liveNetworkCallObserved: false,
            productionEndpointUsed: false,
            fromCache: false,
            httpStatus: null,
            latencyMs: null,
          },
          certifiedAtUtc,
        }),
      );
      continue;
    }
    const outcome = await probe.probe();
    results.push(
      Object.freeze({
        providerId: probe.providerId,
        status: outcome.validated ? 'LIVE_VALIDATED' : 'IMPLEMENTED',
        liveCall: outcome.liveCall,
        validated: outcome.validated,
        latencyMs: outcome.latencyMs,
        httpStatus: outcome.httpStatus,
        resultCount: outcome.resultCount,
        error: outcome.error,
        provenance: outcome.provenance,
        certifiedAtUtc,
      }),
    );
  }
  return Object.freeze(results);
}

export function formatCertificationTable(report: ProviderCertificationReport): string {
  const header = 'Provider'.padEnd(28) + 'Status'.padEnd(20) + 'Live Call'.padEnd(13) + 'Validated';
  const lines = [header, '-'.repeat(header.length)];
  for (const row of report.results) {
    lines.push(
      row.providerId.padEnd(28) +
        row.status.padEnd(20) +
        (row.liveCall ? 'YES' : 'NO').padEnd(13) +
        (row.validated ? 'YES' : 'NO'),
    );
  }
  return lines.join('\n');
}

export { LIVE_OPPORTUNITY_JOB_PROVIDER_IDS };
