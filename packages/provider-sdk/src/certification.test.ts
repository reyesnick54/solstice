/**
 * Wave 4 Prompt 10 — universal provider certification framework tests.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildProviderCertification,
  buildResponseProvenance,
  classifyProviderError,
  createProviderCertificationService,
  credentialsPresent,
  deriveLifecycleState,
  isConfigured,
  isLiveValidatedState,
  mapTransportKindToFailureCode,
  normalizeProviderFailure,
  rejectSilentSimulationFallback,
  resolveDataPathPolicy,
  runCertificationProbes,
  runCertificationProbesAsync,
  sanitizeFailureMessage,
  type CertificationProbeContext,
} from './certification/index.ts';
import type { CatalogProviderEntry } from './catalog/types.ts';
import { buildAbsoluteUrl, enforceSsrfPolicy, isLinkLocalOrMetadata, parseDestination } from './ssrf.ts';
import type { SunReyProvider } from './contract.ts';

function sampleCatalogEntry(overrides: Partial<CatalogProviderEntry> = {}): CatalogProviderEntry {
  return Object.freeze({
    provider_id: 'fred',
    name: 'FRED',
    short_name: 'FRED',
    description: 'Federal Reserve Economic Data',
    primary_category: 'macroeconomics',
    capabilities: ['macroeconomic_indicators'],
    endpoints: {
      base_url: 'https://api.stlouisfed.org/fred',
      api_version: 'v1',
      documentation_url: 'https://fred.stlouisfed.org/docs/api/',
      status_url: null,
    },
    authentication: {
      type: 'api_key',
      required: true,
      registration_required: true,
      environment_variable: 'FRED_API_KEY',
      notes: null,
    },
    access: {
      status: 'verified_free',
      free_tier_verified: true,
      registration_required: true,
      notes: null,
    },
    commercial_use: {
      status: 'verified_allowed',
      notes: null,
    },
    redistribution: {
      status: 'allowed',
      notes: null,
    },
    rate_limits: {
      documented: true,
      requests_per_second: null,
      requests_per_minute: null,
      requests_per_hour: null,
      requests_per_day: null,
      monthly_quota: null,
      concurrency_limit: null,
      notes: null,
    },
    verification: {
      status: 'verified',
      verified_at: null,
      verified_by: null,
      notes: null,
    },
    sunrey: {
      integration_state: 'implemented',
      launch_tier: 'production_candidate',
      consumer_domains: ['world'],
      priority: 'high',
      authority_class: 'authoritative_official',
    },
    ...overrides,
  }) as CatalogProviderEntry;
}

function probeContext(
  overrides: Partial<CertificationProbeContext> = {},
): CertificationProbeContext {
  return {
    providerId: 'fred',
    catalogEntry: sampleCatalogEntry(),
    configuration: null,
    explicitlyDisabled: false,
    credentialAvailable: false,
    environment: 'simulation',
    nowUtc: () => '2026-08-31T16:00:00.000Z',
    ...overrides,
  };
}

describe('provider certification framework', () => {
  it('1. cataloged provider is not automatically live', () => {
    const probe = runCertificationProbes(probeContext());
    const certification = buildProviderCertification({ providerId: 'fred', probe });
    assert.equal(certification.status, 'SIMULATED');
    assert.equal(certification.liveNetworkCallObserved, false);
    assert.equal(certification.productionEndpointUsed, false);
    assert.equal(isLiveValidatedState(certification.status), false);
  });

  it('2. configured provider is not automatically authenticated', () => {
    const probe = runCertificationProbes(
      probeContext({
        credentialAvailable: true,
        liveProbeEnabled: true,
      }),
    );
    assert.equal(probe.configured, true);
    assert.equal(probe.authenticated, false);
    assert.equal(probe.networkReachable, false);
  });

  it('3. missing credentials produce correct state', () => {
    const probe = runCertificationProbes(
      probeContext({
        liveProbeEnabled: true,
        credentialAvailable: false,
      }),
    );
    assert.equal(probe.credentialsPresent, false);
    assert.equal(probe.failureCode, 'MISSING_CREDENTIALS');
    const certification = buildProviderCertification({ providerId: 'fred', probe });
    assert.equal(certification.status, 'CONFIGURED');
  });

  it('4. unreachable provider produces correct state', async () => {
    const probe = await runCertificationProbesAsync(
      probeContext({
        liveProbeEnabled: true,
        credentialAvailable: true,
        networkProbe: async () =>
          Object.freeze({
            reachable: false,
            authenticated: false,
            responseValidated: false,
            liveNetworkCallObserved: false,
            productionEndpointUsed: false,
            simulated: false,
            endpointClass: 'sandbox',
            latencyMs: 42,
            failureCode: 'CONNECTION_FAILURE',
            message: 'connection refused',
          }),
      }),
    );
    assert.equal(probe.networkReachable, false);
    assert.equal(probe.failureCode, 'CONNECTION_FAILURE');
    assert.equal(probe.authenticated, false);
  });

  it('5. authentication failure is distinguished from network failure', async () => {
    const authProbe = await runCertificationProbesAsync(
      probeContext({
        liveProbeEnabled: true,
        credentialAvailable: true,
        networkProbe: async () =>
          Object.freeze({
            reachable: true,
            authenticated: false,
            responseValidated: false,
            liveNetworkCallObserved: true,
            productionEndpointUsed: false,
            simulated: false,
            endpointClass: 'sandbox',
            latencyMs: 10,
            failureCode: 'AUTHENTICATION_FAILURE',
          }),
      }),
    );
    const netProbe = await runCertificationProbesAsync(
      probeContext({
        liveProbeEnabled: true,
        credentialAvailable: true,
        networkProbe: async () =>
          Object.freeze({
            reachable: false,
            authenticated: false,
            responseValidated: false,
            liveNetworkCallObserved: false,
            productionEndpointUsed: false,
            simulated: false,
            endpointClass: 'sandbox',
            latencyMs: 10,
            failureCode: 'CONNECTION_FAILURE',
          }),
      }),
    );
    assert.equal(authProbe.networkReachable, true);
    assert.equal(authProbe.failureCode, 'AUTHENTICATION_FAILURE');
    assert.equal(netProbe.networkReachable, false);
    assert.equal(netProbe.failureCode, 'CONNECTION_FAILURE');
  });

  it('6. schema mismatch is detected', async () => {
    const probe = await runCertificationProbesAsync(
      probeContext({
        liveProbeEnabled: true,
        credentialAvailable: true,
        networkProbe: async () =>
          Object.freeze({
            reachable: true,
            authenticated: true,
            responseValidated: false,
            liveNetworkCallObserved: true,
            productionEndpointUsed: false,
            simulated: false,
            endpointClass: 'sandbox',
            latencyMs: 15,
            failureCode: 'SCHEMA_MISMATCH',
          }),
      }),
    );
    assert.equal(probe.responseValidated, false);
    assert.equal(probe.failureCode, 'SCHEMA_MISMATCH');
    const status = deriveLifecycleState(probe);
    assert.equal(status, 'AUTHENTICATED');
  });

  it('7. simulated response is clearly labeled', () => {
    const probe = runCertificationProbes(probeContext({ environment: 'simulation' }));
    assert.equal(probe.simulated, true);
    assert.equal(probe.endpointClass, 'simulation_fixture');
    const provenance = buildResponseProvenance({
      providerId: 'fred',
      simulated: true,
      retrievedAt: '2026-08-31T16:00:00.000Z',
      endpointClass: 'simulation_fixture',
      requestId: 'req-1',
    });
    assert.equal(provenance.simulated, true);
  });

  it('8. production cannot silently return simulation as live', () => {
    const decision = rejectSilentSimulationFallback({
      primaryFailed: true,
      fallbackToSimulation: true,
      simulationLabeled: false,
      environment: 'production',
      explicitSimulationAllowed: false,
    });
    assert.equal(decision.allowed, false);
    assert.equal(decision.failureCode, 'SILENT_SIMULATION_REJECTED');
    const policy = resolveDataPathPolicy({
      environment: 'production',
      explicitSimulationRequested: false,
      providerDisabled: false,
    });
    assert.equal(policy.allowSimulation, false);
  });

  it('9. valid provider certification transitions correctly', async () => {
    const probe = await runCertificationProbesAsync(
      probeContext({
        liveProbeEnabled: true,
        credentialAvailable: true,
        networkProbe: async () =>
          Object.freeze({
            reachable: true,
            authenticated: true,
            responseValidated: true,
            liveNetworkCallObserved: true,
            productionEndpointUsed: false,
            simulated: false,
            endpointClass: 'sandbox',
            latencyMs: 20,
            failureCode: null,
          }),
      }),
    );
    const certification = buildProviderCertification({ providerId: 'fred', probe });
    assert.equal(certification.status, 'LIVE_VALIDATED');
    assert.equal(certification.liveNetworkCallObserved, true);
    assert.equal(certification.responseValidated, true);
  });

  it('10. secrets are not present in certification output', () => {
    const secret = 'sk-live-abcdefghijklmnopqrstuvwxyz';
    const message = sanitizeFailureMessage(`auth failed Bearer ${secret} api_key=${secret}`);
    assert.ok(!message.includes(secret));
    assert.ok(message.includes('[REDACTED]'));
    const service = createProviderCertificationService();
    const certification = service.sanitizeForExposure(
      buildProviderCertification({
        providerId: 'fred',
        probe: runCertificationProbes(
          probeContext({
            configuration: {
              providerId: 'fred',
              secretReference: { environmentVariable: 'FRED_API_KEY', resolved: false },
              featureFlag: null,
              timeoutMs: null,
              notes: null,
            },
          }),
        ),
      }),
    );
    const serialized = JSON.stringify(certification);
    assert.ok(!serialized.includes(process.env.FRED_API_KEY ?? '___no_key___'));
    assert.ok(!serialized.includes('sk-live'));
  });

  it('11. unknown provider fails safely', () => {
    const probe = runCertificationProbes(
      probeContext({ catalogEntry: null, providerId: 'unknown-provider' }),
    );
    assert.equal(probe.failureCode, 'PROVIDER_NOT_IN_CATALOG');
    const certification = buildProviderCertification({
      providerId: 'unknown-provider',
      probe,
    });
    assert.equal(certification.status, 'CATALOGED');
    assert.equal(certification.configured, false);
  });

  it('12. disabled provider does not make network requests', async () => {
    let networkCalled = false;
    const probe = await runCertificationProbesAsync(
      probeContext({
        explicitlyDisabled: true,
        liveProbeEnabled: true,
        credentialAvailable: true,
        networkProbe: async () => {
          networkCalled = true;
          return Object.freeze({
            reachable: true,
            authenticated: true,
            responseValidated: true,
            liveNetworkCallObserved: true,
            productionEndpointUsed: false,
            simulated: false,
            endpointClass: 'sandbox',
            latencyMs: 1,
            failureCode: null,
          });
        },
      }),
    );
    assert.equal(networkCalled, false);
    assert.equal(probe.failureCode, 'PROVIDER_DISABLED');
    const certification = buildProviderCertification({
      providerId: 'fred',
      probe,
      explicitlyDisabled: true,
    });
    assert.equal(certification.status, 'DISABLED');
  });

  it('13. provider error normalization works', () => {
    assert.equal(mapTransportKindToFailureCode('ProviderAuthenticationError'), 'AUTHENTICATION_FAILURE');
    assert.equal(mapTransportKindToFailureCode('ProviderTimeoutError'), 'TIMEOUT');
    const normalized = normalizeProviderFailure({
      providerId: 'fred',
      httpStatus: 429,
      message: 'too many requests',
    });
    assert.equal(normalized.code, 'RATE_LIMITED');
    assert.equal(normalized.retryable, true);
    const provider: SunReyProvider = {
      id: 'fred',
      descriptor: {
        id: 'fred',
        name: 'FRED',
        shortName: 'FRED',
        description: 'test',
        primaryCategory: 'macroeconomics',
        capabilities: [],
        domains: ['world'],
        authorityClass: 'reference_data',
        priority: 'high',
        launchTier: 'production_candidate',
        activationMode: 'preview_only',
        catalogOnly: false,
        secretReference: null,
      },
      initialize: async () => {},
      healthCheck: async () => ({
        providerId: 'fred',
        state: 'unknown',
        status: 'registered',
        checkedAt: '2026-08-31T16:00:00.000Z',
        message: 'ok',
        latencyMs: null,
      }),
      getCapabilities: () => [],
      shutdown: async () => {},
    };
    const classified = classifyProviderError(provider, new Error('boom'), 'fred');
    assert.equal(classified.code, 'UNKNOWN');
    assert.equal(classified.providerId, 'fred');
  });

  it('14. malformed URL/input cannot redirect requests to arbitrary infrastructure', () => {
    assert.equal(isLinkLocalOrMetadata('169.254.169.254'), true);
    const parsed = parseDestination('https://169.254.169.254/latest/meta-data');
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      const decision = enforceSsrfPolicy(parsed.destination, {
        allowHttp: false,
        environment: 'production',
        approvedHostname: 'api.stlouisfed.org',
        approvedPort: 443,
        approvedScheme: 'https',
      });
      assert.equal(decision.ok, false);
    }
    const redirect = buildAbsoluteUrl('https://api.example.com/v1', 'https://evil.example.net/steal');
    assert.equal(redirect.ok, true);
    if (redirect.ok) {
      const blocked = enforceSsrfPolicy(redirect.destination, {
        allowHttp: false,
        environment: 'production',
        approvedHostname: 'api.example.com',
        approvedPort: 443,
        approvedScheme: 'https',
      });
      assert.equal(blocked.ok, false);
    }
  });
});

describe('provider certification service integration', () => {
  it('catalog-only entries never report live validated', () => {
    const service = createProviderCertificationService();
    const live = service.listLiveValidated();
    assert.equal(live.length, 0);
    const report = service.certifyAllCatalogEntries();
    assert.ok(report.providers.length > 0);
    for (const entry of report.providers) {
      assert.equal(entry.liveNetworkCallObserved, false);
      assert.equal(entry.productionEndpointUsed, false);
      if (entry.status !== 'DISABLED') {
        assert.ok(
          entry.status === 'SIMULATED' ||
            entry.status === 'CATALOGED' ||
            entry.status === 'CONFIGURED' ||
            entry.status === 'CREDENTIALS_PRESENT',
        );
      }
    }
  });
});
