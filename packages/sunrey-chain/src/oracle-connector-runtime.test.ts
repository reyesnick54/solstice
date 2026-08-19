import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { hmacSha256Hex } from '../../security/src/hmac.ts';
import { secretRef } from '../../security/src/secrets.ts';
import {
  ApiKeyReferenceAdapter,
  CONSENSUS_CALLED_HTTP,
  CREDENTIALS_EXPOSED,
  DEFAULT_CONNECTOR_RUNTIME_CONFIG,
  FETCH_AUTO_FINALIZED_ORACLE,
  FETCH_AUTO_MINTED_MOONREY,
  HTTP_FETCH_SUCCESS_IS_NOT_VERIFIED_ECONOMIC_FACT,
  ConnectorCircuitBreaker,
  ConnectorRateLimiter,
  ConnectorRuntimeAdapterV2,
  DEFAULT_CIRCUIT_BREAKER_POLICY,
  DEFAULT_RATE_LIMIT_POLICY,
  EconomicDataConnectorRuntime,
  FakeExternalHttpTransport,
  LIVE_MAINNET_CONNECTIVITY,
  NodeExternalHttpTransport,
  PRODUCTIVE_CONTRIBUTION_IS_NOT_PRODUCTIVE_VALUE,
  PRODUCTIVE_VALUE_IS_NOT_MOONREY_ISSUANCE,
  ProviderEndpointProfileRegistry,
  VERIFIED_ECONOMIC_FACT_IS_NOT_PRODUCTIVE_CONTRIBUTION,
  auditContainsCredential,
  canonicalSignedRequest,
  classifyHostname,
  consensusMustNotCallExternalApis,
  consensusMustNotCallHttp,
  createConnectorTransport,
  destinationMatchesProfile,
  createDeterministicRandom,
  createFrozenConnectorClock,
  enforceSsrfPolicy,
  fetchDoesNotFinalizeOracle,
  fetchDoesNotMintMoonRey,
  isRetryableRejection,
  liveMainnetConnectivityEnabled,
  parseDestination,
  profileUrl,
} from './oracle/production/index.ts';
import {
  SANDBOX_API_KEY,
  SANDBOX_NOW_UNIX,
  SANDBOX_OAUTH_ACCESS_TOKEN,
  SANDBOX_SIGNING_KEY,
  sandboxApiKeyAuth,
  sandboxEnergyRecord,
  sandboxEndpointProfile,
  sandboxFeed,
  sandboxIdentity,
  sandboxMtlsAuth,
  sandboxOauthAuth,
  sandboxSecrets,
  sandboxSignedAuth,
  sandboxSource,
  sandboxTokenEndpointProfile,
} from './oracle/production/sandbox-fixture.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');

function runtime(transport: FakeExternalHttpTransport, mode: typeof DEFAULT_CONNECTOR_RUNTIME_CONFIG.mode = 'FIXTURE') {
  return new EconomicDataConnectorRuntime({
    config: { ...DEFAULT_CONNECTOR_RUNTIME_CONFIG, mode },
    transport,
    clock: createFrozenConnectorClock(SANDBOX_NOW_UNIX),
    random: createDeterministicRandom(),
    sleeper: async () => undefined,
    retry: { maxAttempts: 3, backoffMs: [0, 0, 0], jitterPolicy: 'NONE' },
    circuit: { ...DEFAULT_CIRCUIT_BREAKER_POLICY, consecutiveFailureThreshold: 3, cooldownMs: 1_000 },
  });
}

function successTransport(profile = sandboxEndpointProfile(), body = sandboxEnergyRecord()) {
  const transport = new FakeExternalHttpTransport();
  transport.on('GET', profileUrl(profile), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    body,
  });
  return { transport, profile };
}

describe('Chunk 127 economic data connector runtime', () => {
  it('keeps consensus off HTTP and never auto-finalizes or mints', () => {
    assert.equal(consensusMustNotCallExternalApis(), true);
    assert.equal(consensusMustNotCallHttp(), false);
    assert.equal(CONSENSUS_CALLED_HTTP, false);
    assert.equal(liveMainnetConnectivityEnabled(), false);
    assert.equal(LIVE_MAINNET_CONNECTIVITY, 'DISABLED');
    assert.equal(DEFAULT_CONNECTOR_RUNTIME_CONFIG.mode, 'FIXTURE');
    assert.equal(HTTP_FETCH_SUCCESS_IS_NOT_VERIFIED_ECONOMIC_FACT, true);
    assert.equal(VERIFIED_ECONOMIC_FACT_IS_NOT_PRODUCTIVE_CONTRIBUTION, true);
    assert.equal(PRODUCTIVE_CONTRIBUTION_IS_NOT_PRODUCTIVE_VALUE, true);
    assert.equal(PRODUCTIVE_VALUE_IS_NOT_MOONREY_ISSUANCE, true);
    assert.equal(fetchDoesNotFinalizeOracle(), false);
    assert.equal(fetchDoesNotMintMoonRey(), false);
    assert.equal(FETCH_AUTO_FINALIZED_ORACLE, false);
    assert.equal(FETCH_AUTO_MINTED_MOONREY, false);
    assert.equal(CREDENTIALS_EXPOSED, false);
  });

  it('collects a sandbox record into a non-final observation draft', async () => {
    const { transport, profile } = successTransport();
    const result = await runtime(transport).collect({
      request: {
        source: sandboxSource(),
        identity: sandboxIdentity(),
        feed: sandboxFeed(),
        endpointProfile: profile,
        subject: 'plant_sim_1',
        nowUnix: SANDBOX_NOW_UNIX,
      },
      secrets: sandboxSecrets(),
      auth: sandboxApiKeyAuth(),
    });
    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    assert.equal(result.value.record.numericValue, '100');
    assert.equal(result.value.verifiedEconomicFact, null);
    assert.equal(result.value.finalizedOracle, false);
    assert.equal(result.value.mintedMoonRey, false);
    assert.equal(result.value.provenance.authMethod, 'API_KEY_REFERENCE');
    assert.equal(result.value.provenance.collectorVersion, 'sunrey-oracle-connector/1');
    assert.notEqual(result.value.provenance.sourceTimestampUnix, 0n);
    assert.equal(result.value.provenance.collectionTimestampUnix, SANDBOX_NOW_UNIX);
    assert.match(result.value.provenance.contentHash, /^[0-9a-f]{64}$/);
    const provenanceJson = JSON.stringify(result.value.provenance, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value,
    );
    assert.equal(provenanceJson.includes(SANDBOX_API_KEY), false);
    assert.equal(transport.requests[0]?.headers['x-api-key'], SANDBOX_API_KEY);
  });

  it('times out, rejects 429/500, malformed JSON, oversized bodies, and wrong content types', async () => {
    const profile = sandboxEndpointProfile();
    const url = profileUrl(profile);
    const cases: Array<{ script: Parameters<FakeExternalHttpTransport['on']>[2]; code: string }> = [
      { script: { timeout: true }, code: 'REQUEST_TIMEOUT' },
      { script: { status: 429, headers: { 'retry-after': '1', 'content-type': 'application/json' }, body: '{}' }, code: 'RATE_LIMITED' },
      { script: { status: 500, headers: { 'content-type': 'application/json' }, body: '{}' }, code: 'HTTP_STATUS_REJECTED' },
      { script: { status: 200, headers: { 'content-type': 'application/json' }, body: '{not-json' }, code: 'SOURCE_RECORD_INVALID' },
      { script: { status: 200, headers: { 'content-type': 'text/plain' }, body: sandboxEnergyRecord() }, code: 'CONTENT_TYPE_INVALID' },
      {
        script: {
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: sandboxEnergyRecord('x'.repeat(8_000)),
        },
        code: 'RESPONSE_TOO_LARGE',
      },
    ];
    for (const row of cases) {
      const transport = new FakeExternalHttpTransport();
      transport.on('GET', url, row.script);
      const result = await runtime(transport).collect({
        request: {
          source: sandboxSource(),
          identity: sandboxIdentity(),
          feed: sandboxFeed(),
          endpointProfile: { ...profile, maximumResponseBytes: 2_048 },
          subject: 'plant_sim_1',
          nowUnix: SANDBOX_NOW_UNIX,
        },
        secrets: sandboxSecrets(),
        auth: sandboxApiKeyAuth(),
      });
      assert.equal(result.ok, false, row.code);
      if (!result.ok) {
        assert.equal(result.error.code, row.code);
      }
    }
  });

  it('rejects bad schema and stale source timestamps without using collection time as a fake source time', async () => {
    const profile = sandboxEndpointProfile();
    const transport = new FakeExternalHttpTransport();
    transport.on('GET', profileUrl(profile), {
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        identifier: 'plant_sim_1',
        numericValue: '100',
        unit: 'MWh',
        sourceTimestampUnix: '1700000000',
        schemaId: 'energy.resource.v2',
        schemaVersion: 2,
      }),
    });
    const schema = await runtime(transport).collect({
      request: {
        source: sandboxSource(),
        identity: sandboxIdentity(),
        feed: sandboxFeed(),
        endpointProfile: profile,
        subject: 'plant_sim_1',
        nowUnix: SANDBOX_NOW_UNIX,
      },
      secrets: sandboxSecrets(),
      auth: sandboxApiKeyAuth(),
    });
    assert.equal(schema.ok, false);
    if (!schema.ok) {
      assert.ok(schema.error.code === 'SCHEMA_INCOMPATIBLE' || schema.error.code === 'SCHEMA_DRIFT');
    }

    const staleTransport = new FakeExternalHttpTransport();
    staleTransport.on('GET', profileUrl(profile), {
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: sandboxEnergyRecord((SANDBOX_NOW_UNIX - 10_000n).toString()),
    });
    const stale = await runtime(staleTransport).collect({
      request: {
        source: sandboxSource(),
        identity: sandboxIdentity(),
        feed: sandboxFeed(),
        endpointProfile: profile,
        subject: 'plant_sim_1',
        nowUnix: SANDBOX_NOW_UNIX,
      },
      secrets: sandboxSecrets(),
      auth: sandboxApiKeyAuth(),
    });
    assert.equal(stale.ok, false);
    if (!stale.ok) {
      assert.equal(stale.error.code, 'SOURCE_TIMESTAMP_STALE');
    }
  });

  it('implements OAuth client credentials, API keys, signed requests, and mTLS material resolution', async () => {
    const oauthProfile = sandboxEndpointProfile({
      sourceId: 'src_sandbox',
      authenticationClass: 'OAUTH_CLIENT',
    });
    const token = sandboxTokenEndpointProfile();
    const oauthTransport = new FakeExternalHttpTransport();
    oauthTransport.on('POST', profileUrl(token), async (request) => {
      assert.equal(request.body?.includes(SANDBOX_OAUTH_ACCESS_TOKEN), false);
      assert.match(request.body ?? '', /grant_type=client_credentials/);
      return {
        ok: true,
        value: {
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ access_token: SANDBOX_OAUTH_ACCESS_TOKEN, expires_in: 300 }),
          finalUrl: request.url,
          redirected: false,
        },
      };
    });
    oauthTransport.on('GET', profileUrl(oauthProfile), (request) => {
      assert.equal(request.headers.authorization, `Bearer ${SANDBOX_OAUTH_ACCESS_TOKEN}`);
      return {
        ok: true,
        value: {
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: sandboxEnergyRecord(),
          finalUrl: request.url,
          redirected: false,
        },
      };
    });
    const oauth = await runtime(oauthTransport).collect({
      request: {
        source: sandboxSource({ authenticationMethod: 'OAUTH_CLIENT' }),
        identity: sandboxIdentity(),
        feed: sandboxFeed(),
        endpointProfile: oauthProfile,
        subject: 'plant_sim_1',
        nowUnix: SANDBOX_NOW_UNIX,
      },
      secrets: sandboxSecrets(),
      auth: sandboxOauthAuth(),
    });
    assert.equal(oauth.ok, true, oauth.ok ? '' : oauth.error.detail);

    const signedProfile = sandboxEndpointProfile({ authenticationClass: 'SIGNED_REQUEST' });
    const signedTransport = new FakeExternalHttpTransport();
    signedTransport.on('GET', profileUrl(signedProfile), (request) => {
      const timestamp = request.headers['x-sunrey-timestamp'];
      const nonce = request.headers['x-sunrey-nonce'];
      const canonical = canonicalSignedRequest({
        method: 'GET',
        path: signedProfile.pathPrefix,
        timestamp: timestamp ?? '',
        nonce: nonce ?? '',
        body: '',
      });
      assert.equal(request.headers['x-sunrey-signature'], hmacSha256Hex(SANDBOX_SIGNING_KEY, canonical));
      return {
        ok: true,
        value: {
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: sandboxEnergyRecord(),
          finalUrl: request.url,
          redirected: false,
        },
      };
    });
    const signed = await runtime(signedTransport).collect({
      request: {
        source: sandboxSource({ authenticationMethod: 'SIGNED_REQUEST' }),
        identity: sandboxIdentity(),
        feed: sandboxFeed(),
        endpointProfile: signedProfile,
        subject: 'plant_sim_1',
        nowUnix: SANDBOX_NOW_UNIX,
      },
      secrets: sandboxSecrets(),
      auth: sandboxSignedAuth(),
    });
    assert.equal(signed.ok, true, signed.ok ? '' : signed.error.detail);

    const mtlsProfile = sandboxEndpointProfile({ authenticationClass: 'MTLS' });
    const mtlsTransport = new FakeExternalHttpTransport();
    mtlsTransport.on('GET', profileUrl(mtlsProfile), (request) => {
      assert.equal(request.tls.clientCertificatePresent, true);
      return {
        ok: true,
        value: {
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: sandboxEnergyRecord(),
          finalUrl: request.url,
          redirected: false,
        },
      };
    });
    const mtls = await runtime(mtlsTransport).collect({
      request: {
        source: sandboxSource({ authenticationMethod: 'MTLS' }),
        identity: sandboxIdentity(),
        feed: sandboxFeed(),
        endpointProfile: mtlsProfile,
        subject: 'plant_sim_1',
        nowUnix: SANDBOX_NOW_UNIX,
      },
      secrets: sandboxSecrets(),
      auth: sandboxMtlsAuth(),
    });
    assert.equal(mtls.ok, true, mtls.ok ? '' : mtls.error.detail);
  });

  it('opens a circuit after consecutive transient failures and recovers after cooldown', async () => {
    const profile = sandboxEndpointProfile();
    const transport = new FakeExternalHttpTransport();
    transport.on('GET', profileUrl(profile), { status: 500, headers: { 'content-type': 'application/json' }, body: '{}' });
    const clock = {
      unix: SANDBOX_NOW_UNIX,
      ms: SANDBOX_NOW_UNIX * 1000n,
      nowUnix() {
        return this.unix;
      },
      nowMs() {
        return this.ms;
      },
    };
    const connector = new EconomicDataConnectorRuntime({
      config: DEFAULT_CONNECTOR_RUNTIME_CONFIG,
      transport,
      clock,
      random: createDeterministicRandom(),
      sleeper: async () => undefined,
      retry: { maxAttempts: 1, backoffMs: [0], jitterPolicy: 'NONE' },
      circuit: { ...DEFAULT_CIRCUIT_BREAKER_POLICY, consecutiveFailureThreshold: 2, cooldownMs: 50 },
    });
    const request = {
      source: sandboxSource(),
      identity: sandboxIdentity(),
      feed: sandboxFeed(),
      endpointProfile: profile,
      subject: 'plant_sim_1',
      nowUnix: SANDBOX_NOW_UNIX,
    };
    await connector.collect({ request, secrets: sandboxSecrets(), auth: sandboxApiKeyAuth() });
    await connector.collect({ request, secrets: sandboxSecrets(), auth: sandboxApiKeyAuth() });
    const opened = await connector.collect({ request, secrets: sandboxSecrets(), auth: sandboxApiKeyAuth() });
    assert.equal(opened.ok, false);
    if (!opened.ok) {
      assert.equal(opened.error.code, 'CIRCUIT_OPEN');
    }
    clock.ms += 100n;
    transport.on('GET', profileUrl(profile), {
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: sandboxEnergyRecord(),
    });
    const recovered = await connector.collect({ request, secrets: sandboxSecrets(), auth: sandboxApiKeyAuth() });
    assert.equal(recovered.ok, true);
  });

  it('fails closed on SSRF destinations except approved PRIVATE_NETWORK fixtures', async () => {
    const approved = sandboxEndpointProfile();
    const blocked = [
      'http://127.0.0.1/latest',
      'http://localhost/latest',
      'http://169.254.169.254/latest/meta-data',
      'file:///etc/passwd',
      'ftp://sandbox.oracle.test/data',
      'https://user:pass@sandbox.oracle.test/v1/energy',
      'https://evil.example/v1/energy',
    ];
    for (const href of blocked) {
      const parsed = parseDestination(href);
      if (href.startsWith('file:') || href.startsWith('ftp:') || href.includes('user:pass')) {
        assert.equal(parsed.ok, false, href);
        continue;
      }
      assert.equal(parsed.ok, true, href);
      if (!parsed.ok) {
        continue;
      }
      const matched = destinationMatchesProfile(parsed.value, approved);
      const ssrf = enforceSsrfPolicy(parsed.value, approved, 'FIXTURE');
      assert.equal(matched.ok && ssrf.ok, false, href);
    }

    const privateProfile = sandboxEndpointProfile({
      scheme: 'http',
      hostname: '10.0.0.8',
      port: 8080,
      pathPrefix: '/energy',
      authenticationClass: 'PRIVATE_NETWORK',
      networkClass: 'PRIVATE_NETWORK',
      tlsPolicy: 'FIXTURE_HTTP_ALLOWED',
    });
    const privateDestination = parseDestination('http://10.0.0.8:8080/energy');
    assert.equal(privateDestination.ok, true);
    if (privateDestination.ok) {
      const allowed = enforceSsrfPolicy(privateDestination.value, privateProfile, 'SANDBOX');
      assert.equal(allowed.ok, true);
    }

    const redirectProfile = sandboxEndpointProfile({
      redirectPolicy: 'NONE',
      maxRedirects: 0,
    });
    const transport = new FakeExternalHttpTransport();
    transport.on('GET', profileUrl(redirectProfile), {
      redirectTo: 'https://127.0.0.1/steal',
    });
    const redirected = await runtime(transport).collect({
      request: {
        source: sandboxSource(),
        identity: sandboxIdentity(),
        feed: sandboxFeed(),
        endpointProfile: redirectProfile,
        subject: 'plant_sim_1',
        nowUnix: SANDBOX_NOW_UNIX,
      },
      secrets: sandboxSecrets(),
      auth: sandboxApiKeyAuth(),
    });
    assert.equal(redirected.ok, false);
    if (!redirected.ok) {
      assert.equal(redirected.error.code, 'SSRF_DESTINATION_FORBIDDEN');
    }
    assert.equal(classifyHostname('169.254.169.254'), 'BLOCKED_METADATA');
    assert.equal(classifyHostname('127.0.0.1'), 'LOOPBACK_FIXTURE');
  });

  it('refuses unconfigured production-candidate connectivity and public-internet node transport in FIXTURE', () => {
    const live = new NodeExternalHttpTransport({
      ...DEFAULT_CONNECTOR_RUNTIME_CONFIG,
      mode: 'PRODUCTION_CANDIDATE_EXTERNAL',
      externalNetworkEnabled: false,
      productionCandidateExternalConfigured: false,
    });
    assert.equal(live.contactsPublicInternet, true);
    const injected = createConnectorTransport(DEFAULT_CONNECTOR_RUNTIME_CONFIG, live);
    assert.equal(injected.ok, false);
    if (!injected.ok) {
      assert.equal(injected.error.code, 'CONNECTIVITY_DISABLED');
    }
    const v1 = new ApiKeyReferenceAdapter().retrieve(
      {
        source: sandboxSource(),
        identity: sandboxIdentity(),
        nowUnix: SANDBOX_NOW_UNIX,
      },
      sandboxSecrets(),
    );
    assert.equal(v1.ok, false);
    if (!v1.ok) {
      assert.match(v1.error.detail, /interface only/);
    }
  });

  it('rate-limits a source and records privacy-safe audit rows', async () => {
    const limiter = new ConnectorRateLimiter(
      { ...DEFAULT_RATE_LIMIT_POLICY, requestsPerInterval: 1, burst: 0, intervalMs: 10_000, cooldownMs: 1_000 },
      createFrozenConnectorClock(SANDBOX_NOW_UNIX),
    );
    assert.equal(limiter.acquire('oracle_sandbox', 'src_sandbox').ok, true);
    const limited = limiter.acquire('oracle_sandbox', 'src_sandbox');
    assert.equal(limited.ok, false);
    if (!limited.ok) {
      assert.equal(limited.error.code, 'RATE_LIMITED');
    }

    const { transport, profile } = successTransport();
    const connector = runtime(transport);
    const accepted = await connector.collect({
      request: {
        source: sandboxSource(),
        identity: sandboxIdentity(),
        feed: sandboxFeed(),
        endpointProfile: profile,
        subject: 'plant_sim_1',
        nowUnix: SANDBOX_NOW_UNIX,
      },
      secrets: sandboxSecrets(),
      auth: sandboxApiKeyAuth(),
    });
    assert.equal(accepted.ok, true);
    assert.equal(connector.observability.metrics.fetchSuccesses, 1);
    assert.equal(connector.observability.audit[0]?.payloadPersisted, false);
    assert.equal(auditContainsCredential(connector.observability.audit[0]!, [SANDBOX_API_KEY]), false);
  });

  it('does not retry authentication or schema failures', () => {
    assert.equal(isRetryableRejection({ code: 'AUTH_FAILED', detail: 'no' }), false);
    assert.equal(isRetryableRejection({ code: 'SCHEMA_INCOMPATIBLE', detail: 'no' }), false);
    assert.equal(isRetryableRejection({ code: 'REQUEST_TIMEOUT', detail: 'yes' }), true);
    assert.equal(isRetryableRejection({ code: 'HTTP_STATUS_REJECTED', detail: '500' }, 500), true);
    assert.equal(isRetryableRejection({ code: 'HTTP_STATUS_REJECTED', detail: '400' }, 400), false);
  });

  it('exposes a V2 async adapter and a profile registry', async () => {
    const { transport, profile } = successTransport();
    const connector = runtime(transport);
    const adapter = new ConnectorRuntimeAdapterV2(
      connector,
      'API_KEY_REFERENCE',
      sandboxSecrets(),
      sandboxApiKeyAuth(),
    );
    const fetched = await adapter.retrieve(
      {
        source: sandboxSource(),
        identity: sandboxIdentity(),
        feed: sandboxFeed(),
        endpointProfile: profile,
        subject: 'plant_sim_1',
        nowUnix: SANDBOX_NOW_UNIX,
      },
      connector.context({ secrets: sandboxSecrets(), auth: sandboxApiKeyAuth() }),
    );
    assert.equal(fetched.ok, true);
    const registry = new ProviderEndpointProfileRegistry();
    assert.equal(registry.register(profile).ok, true);
    assert.equal(registry.getForSource('src_sandbox')?.profileId, profile.profileId);
  });

  it('never imports connector HTTP into consensus or issuance modules', () => {
    const files = [
      'packages/sunrey-chain/src/oracle/engine.ts',
      'packages/sunrey-chain/src/oracle/admission.ts',
      'packages/sunrey-chain/src/oracle/aggregation.ts',
      'packages/sunrey-chain/src/productive/issuance.ts',
    ];
    for (const file of files) {
      const source = readFileSync(join(ROOT, file), 'utf8');
      assert.equal(source.includes('http-transport'), false, file);
      assert.equal(source.includes('EconomicDataConnectorRuntime'), false, file);
      assert.equal(/\bfetch\s*\(/.test(source), false, file);
    }
    assert.equal(existsSync(join(ROOT, 'packages/oracle-connectors')), false);
    assert.equal(existsSync(join(ROOT, 'packages/data-ingestion')), false);
    assert.equal(existsSync(join(ROOT, 'packages/moonrey-connectors')), false);
    assert.equal(existsSync(join(ROOT, 'packages/provider-runtime-v2')), false);
  });
});
