import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { ENVIRONMENT, LIVE_BANKING_RAILS, LIVE_DATA_MARKET_ENABLED, LIVE_MONEY_ENABLED } from '../../config/src/flags.ts';
import { EconomicAssetRegistry } from '../../economic-asset-registry/src/index.ts';
import { ConnectorCircuitBreaker, DEFAULT_CIRCUIT_BREAKER_POLICY } from './oracle/production/circuit-breaker.ts';
import { ConnectorRateLimiter } from './oracle/production/rate-limit.ts';
import { createFrozenConnectorClock } from './oracle/production/runtime.ts';
import { FakeExternalHttpTransport } from './oracle/production/transport.ts';
import {
  CONSENSUS_CALLS_HTTP,
  PRODUCTION_ACTIVE,
  PROVIDER_SUCCESS_MINTS,
  RAW_CREDENTIALS_PRESENT,
  REAL_EXTERNAL_PROVIDER_CONFIGURED,
  REAL_NETWORK_CALLED,
  REFERENCE_PRICE_MINTS,
  assertApiKeyReferenceOnly,
  assertMtlsReferenceOnly,
  assertOauthHandleNotPersisted,
  assertPlaceholderIsNotConfirmed,
  bindCredentialDescriptor,
  buildOnboardingPacket,
  buildProviderCandidateCoverageReport,
  collectCandidateFeed,
  createCandidateProfile,
  createEndpointProfile,
  createFixtureTranslator,
  createRequestBlueprint,
  credentialIsExpired,
  deterministicSourceObservationId,
  evaluateCandidateRevalidation,
  evidenceFromReference,
  fixtureBinding,
  fixtureComputeProfile,
  fixtureEnergyBlueprint,
  fixtureEnergyEndpoint,
  fixtureEnergyFeed,
  fixtureEnergyProfile,
  fixtureLogisticsProfile,
  fixtureManufacturingProfile,
  fixtureReferencePriceFeed,
  fixtureSchema,
  issueOauthHandle,
  mapCandidateToEconomicAsset,
  materializeApprovedUrl,
  populatedStringIsNotProof,
  projectCandidateMetadata,
  requireRevalidation,
  retainPartialPage,
  routeFamily,
  runExternalOracleProviderCandidateDemo,
  sameUpstreamNotIndependent,
  snapshotForRevalidation,
  translateVendorRecord,
  vendorDtoMustNotEscape,
  vendorEnergyBody,
  CANDIDATE_NOW_UNIX,
  FIXTURE_ENERGY_MTLS_ID,
} from './oracle/production/external-provider-candidate/index.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const CONSENSUS_DIR = join(ROOT, 'packages/sunrey-chain/src/oracle');

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

function collector(overrides: {
  readonly profile?: typeof fixtureEnergyProfile;
  readonly feed?: typeof fixtureEnergyFeed;
  readonly endpoint?: typeof fixtureEnergyEndpoint;
  readonly blueprint?: typeof fixtureEnergyBlueprint;
  readonly transport?: FakeExternalHttpTransport;
  readonly nowUnix?: bigint;
} = {}) {
  const clock = createFrozenConnectorClock(overrides.nowUnix ?? CANDIDATE_NOW_UNIX);
  return {
    profile: overrides.profile ?? fixtureEnergyProfile,
    feed: overrides.feed ?? fixtureEnergyFeed,
    endpoint: overrides.endpoint ?? fixtureEnergyEndpoint,
    blueprint: overrides.blueprint ?? fixtureEnergyBlueprint,
    binding: fixtureBinding(FIXTURE_ENERGY_MTLS_ID, 'MTLS'),
    translator: createFixtureTranslator('translator.test'),
    schema: fixtureSchema(overrides.feed ?? fixtureEnergyFeed),
    transport: overrides.transport ?? new FakeExternalHttpTransport(),
    rateLimiter: new ConnectorRateLimiter(
      { requestsPerInterval: 8, intervalMs: 1_000, burst: 8, cooldownMs: 10 },
      clock,
    ),
    circuitBreaker: new ConnectorCircuitBreaker(DEFAULT_CIRCUIT_BREAKER_POLICY, clock),
    nowUnix: overrides.nowUnix ?? CANDIDATE_NOW_UNIX,
  };
}

describe('CHUNK-150 external economic provider candidates', () => {
  it('creates a candidate profile', () => {
    const created = createCandidateProfile(fixtureEnergyProfile);
    assert.equal(created.ok, true);
    if (created.ok) {
      assert.equal(created.value.productionAuthorized, false);
      assert.equal(created.value.providerId, FIXTURE_ENERGY_MTLS_ID);
    }
  });

  it('enforces the endpoint allowlist', () => {
    const created = createEndpointProfile(fixtureEnergyEndpoint);
    assert.equal(created.ok, true);
    const localhost = createEndpointProfile({
      ...fixtureEnergyEndpoint,
      baseOrigin: 'https://localhost/v1',
    });
    assert.equal(localhost.ok, false);
    const metadata = createEndpointProfile({
      ...fixtureEnergyEndpoint,
      baseOrigin: 'https://169.254.169.254/latest',
    });
    assert.equal(metadata.ok, false);
  });

  it('keeps secrets out of request blueprints', () => {
    const created = createRequestBlueprint(fixtureEnergyBlueprint);
    assert.equal(created.ok, true);
    const leaked = createRequestBlueprint({
      ...fixtureEnergyBlueprint,
      approvedHeaderNames: ['Authorization'],
    });
    assert.equal(leaked.ok, false);
    if (!leaked.ok) {
      assert.equal(leaked.error.code, 'AUTHORIZATION_IN_BLUEPRINT');
    }
  });

  it('binds a Chunk 149-style credential descriptor without resolving it', () => {
    const binding = bindCredentialDescriptor({
      descriptorRef: 'cred.desc.fixture-energy-mtls',
      providerId: FIXTURE_ENERGY_MTLS_ID,
      authenticationMethod: 'MTLS',
      secretPath: 'oracle/fixture-energy-mtls',
      mtlsCertificateRef: 'cert.ref.fixture-energy-mtls',
    });
    assert.equal(binding.ok, true);
    if (binding.ok) {
      assert.equal(binding.value.resolvedMaterial, null);
      assert.equal(binding.value.plaintextPresent, false);
    }
  });

  it('does not persist an OAuth handle', () => {
    const handle = issueOauthHandle({ providerId: 'fixture-compute-oauth', nowUnix: CANDIDATE_NOW_UNIX });
    assert.equal(handle.tokenMaterial, null);
    assert.equal(handle.persisted, false);
    assert.equal(assertOauthHandleNotPersisted(handle).ok, true);
    assert.equal(assertOauthHandleNotPersisted({ access_token: 'secret-token' }).ok, false);
  });

  it('stores mTLS as a reference only', () => {
    const binding = fixtureBinding(FIXTURE_ENERGY_MTLS_ID, 'MTLS');
    assert.equal(assertMtlsReferenceOnly(binding).ok, true);
  });

  it('stores API keys as references only', () => {
    const binding = fixtureBinding('fixture-manufacturing-api-key', 'API_KEY_REFERENCE');
    assert.equal(assertApiKeyReferenceOnly(binding).ok, true);
  });

  it('translates a vendor-shaped response into a canonical source record', () => {
    const translated = translateVendorRecord({
      vendor: {
        schemaId: 'fixture.vendor.v1',
        schemaVersion: 1,
        identifier: 'plant_sim_1',
        value: '100',
        unit: 'MWh',
        timestamp: CANDIDATE_NOW_UNIX.toString(),
      },
      feed: fixtureEnergyFeed,
      schema: fixtureSchema(fixtureEnergyFeed),
      providerId: FIXTURE_ENERGY_MTLS_ID,
    });
    assert.equal(translated.ok, true);
    if (translated.ok) {
      assert.equal(translated.value.schemaId, 'energy.resource.v1');
      assert.equal(translated.value.unit, 'MWh');
    }
  });

  it('does not let a vendor DTO escape the adapter', () => {
    assert.equal(vendorDtoMustNotEscape({ vendorDto: { raw: true } }).ok, false);
    assert.equal(vendorDtoMustNotEscape({ identifier: 'plant_sim_1' }).ok, true);
  });

  it('triggers revalidation on schema drift', () => {
    const drifted = translateVendorRecord({
      vendor: {
        schemaId: 'fixture.vendor.v2',
        schemaVersion: 2,
        identifier: 'plant_sim_1',
        value: '100',
        unit: 'MWh',
        timestamp: CANDIDATE_NOW_UNIX.toString(),
      },
      feed: fixtureEnergyFeed,
      schema: fixtureSchema(fixtureEnergyFeed),
      providerId: FIXTURE_ENERGY_MTLS_ID,
    });
    assert.equal(drifted.ok, false);
    if (!drifted.ok) {
      assert.equal(drifted.error.code, 'SCHEMA_DRIFT');
    }
  });

  it('triggers revalidation on unit drift', () => {
    const drifted = translateVendorRecord({
      vendor: {
        schemaId: 'fixture.vendor.v1',
        schemaVersion: 1,
        identifier: 'plant_sim_1',
        value: '100',
        unit: 'kWh',
        timestamp: CANDIDATE_NOW_UNIX.toString(),
      },
      feed: fixtureEnergyFeed,
      schema: fixtureSchema(fixtureEnergyFeed),
      providerId: FIXTURE_ENERGY_MTLS_ID,
    });
    assert.equal(drifted.ok, false);
    if (!drifted.ok) {
      assert.equal(drifted.error.code, 'UNIT_DRIFT');
    }
  });

  it('triggers revalidation when the controller changes', () => {
    const prior = snapshotForRevalidation({
      profile: fixtureEnergyProfile,
      feed: fixtureEnergyFeed,
      endpoint: fixtureEnergyEndpoint,
      authenticationMethod: 'MTLS',
      credentialGeneration: 1,
    });
    const next = snapshotForRevalidation({
      profile: { ...fixtureEnergyProfile, controllerId: 'controller_other' },
      feed: fixtureEnergyFeed,
      endpoint: fixtureEnergyEndpoint,
      authenticationMethod: 'MTLS',
      credentialGeneration: 1,
    });
    const decision = evaluateCandidateRevalidation(prior, next);
    assert.equal(decision.required, true);
    assert.equal(decision.triggers.includes('CONTROLLER_CHANGE'), true);
    assert.equal(requireRevalidation(prior, next).ok, false);
  });

  it('bounds pagination and rejects a cursor loop', async () => {
    const transport = new FakeExternalHttpTransport((request) => {
      const url = new URL(request.url);
      const cursor = url.searchParams.get('cursor');
      if (cursor === 'loop') {
        return {
          ok: true,
          value: {
            status: 200,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              records: [
                {
                  schemaId: 'fixture.vendor.v1',
                  schemaVersion: 1,
                  identifier: 'plant_sim_2',
                  value: '20',
                  unit: 'MWh',
                  timestamp: (CANDIDATE_NOW_UNIX + 1n).toString(),
                },
              ],
              nextCursor: 'loop',
            }),
            finalUrl: request.url,
            redirected: false,
          },
        };
      }
      return {
        ok: true,
        value: {
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            records: [
              {
                schemaId: 'fixture.vendor.v1',
                schemaVersion: 1,
                identifier: 'plant_sim_1',
                value: '10',
                unit: 'MWh',
                timestamp: CANDIDATE_NOW_UNIX.toString(),
              },
            ],
            nextCursor: 'loop',
          }),
          finalUrl: request.url,
          redirected: false,
        },
      };
    });
    const feed = { ...fixtureEnergyFeed, paginationMode: 'CURSOR' as const, maxPages: 4 };
    const result = await collectCandidateFeed(
      collector({
        feed,
        transport,
        blueprint: { ...fixtureEnergyBlueprint, paginationMode: 'CURSOR' },
      }),
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, 'CURSOR_LOOP_DETECTED');
    }
  });

  it('retains validated drafts when a later page fails', () => {
    const partial = retainPartialPage({
      retained: [
        {
          identifier: 'plant_sim_1',
          numericValue: '10',
          unit: 'MWh',
          sourceTimestampUnix: CANDIDATE_NOW_UNIX.toString(),
          schemaId: 'energy.resource.v1',
          schemaVersion: 1,
        },
      ],
      pagesCollected: 1,
      failedPage: 2,
    });
    assert.equal(partial.partial, true);
    assert.equal(partial.fabricatedMissingPage, false);
    assert.equal(partial.quorumCreated, false);
    assert.equal(partial.retained.length, 1);
  });

  it('respects rate limits', async () => {
    const transport = new FakeExternalHttpTransport();
    transport.on('GET', 'https://fixture-energy-mtls.oracle.test/v1/energy', { body: vendorEnergyBody() });
    const clock = createFrozenConnectorClock(CANDIDATE_NOW_UNIX);
    const tight = new ConnectorRateLimiter(
      { requestsPerInterval: 1, intervalMs: 60_000, burst: 0, cooldownMs: 1_000 },
      clock,
    );
    const first = await collectCandidateFeed({
      ...collector({ transport }),
      rateLimiter: tight,
    });
    assert.equal(first.ok, true);
    const second = await collectCandidateFeed({
      ...collector({ transport }),
      rateLimiter: tight,
    });
    assert.equal(second.ok, false);
    if (!second.ok) {
      assert.equal(second.error.code, 'RATE_LIMITED');
    }
  });

  it('respects the circuit breaker', async () => {
    const transport = new FakeExternalHttpTransport(() => ({
      ok: false,
      error: { code: 'REQUEST_TIMEOUT', detail: 'timeout' },
    }));
    const clock = createFrozenConnectorClock(CANDIDATE_NOW_UNIX);
    const breaker = new ConnectorCircuitBreaker(
      { consecutiveFailureThreshold: 1, failureRatioNumerator: 1, failureRatioDenominator: 1, sampleWindow: 2, cooldownMs: 60_000 },
      clock,
    );
    const first = await collectCandidateFeed({ ...collector({ transport }), circuitBreaker: breaker });
    assert.equal(first.ok, false);
    const second = await collectCandidateFeed({ ...collector({ transport }), circuitBreaker: breaker });
    assert.equal(second.ok, false);
    if (!second.ok) {
      assert.equal(second.error.code, 'CIRCUIT_OPEN');
    }
  });

  it('uses deterministic source identity', () => {
    const left = deterministicSourceObservationId({
      providerId: FIXTURE_ENERGY_MTLS_ID,
      sourceId: fixtureEnergyFeed.sourceId,
      feedId: fixtureEnergyFeed.feedId,
      subject: 'plant_sim_1',
      sourceTimestampUnix: CANDIDATE_NOW_UNIX.toString(),
      numericValue: '100',
    });
    const right = deterministicSourceObservationId({
      providerId: FIXTURE_ENERGY_MTLS_ID,
      sourceId: fixtureEnergyFeed.sourceId,
      feedId: fixtureEnergyFeed.feedId,
      subject: 'plant_sim_1',
      sourceTimestampUnix: CANDIDATE_NOW_UNIX.toString(),
      numericValue: '100',
    });
    assert.equal(left, right);
    assert.equal(left.includes('plant_sim_1'), true);
  });

  it('does not treat the same upstream as independent', () => {
    assert.equal(
      sameUpstreamNotIndependent(
        { controllerId: 'a', upstreamOrganizationId: 'up', sharedControlGroup: null },
        { controllerId: 'b', upstreamOrganizationId: 'up', sharedControlGroup: null },
      ),
      true,
    );
    assert.equal(
      sameUpstreamNotIndependent(
        { controllerId: 'a', upstreamOrganizationId: 'up-1', sharedControlGroup: 'group' },
        { controllerId: 'b', upstreamOrganizationId: 'up-2', sharedControlGroup: 'group' },
      ),
      true,
    );
    assert.equal(
      sameUpstreamNotIndependent(
        { controllerId: 'a', upstreamOrganizationId: 'up-1', sharedControlGroup: null },
        { controllerId: 'b', upstreamOrganizationId: 'up-2', sharedControlGroup: null },
      ),
      false,
    );
  });

  it('routes every fixture family into the existing taxonomy', () => {
    assert.equal(routeFamily(fixtureEnergyFeed).ok, true);
    assert.equal(routeFamily(fixtureComputeProfile.feedProfiles[0]!).ok, true);
    assert.equal(routeFamily(fixtureManufacturingProfile.feedProfiles[0]!).ok, true);
    assert.equal(routeFamily(fixtureLogisticsProfile.feedProfiles[0]!).ok, true);
    const referenceRouted = routeFamily(fixtureReferencePriceFeed);
    assert.equal(referenceRouted.ok, true);
    if (referenceRouted.ok) {
      assert.equal(referenceRouted.value, 'REFERENCE_DATA');
    }
  });

  it('keeps REFERENCE_PRICE reference-only', () => {
    const productive = createCandidateProfile({
      ...fixtureEnergyProfile,
      factTypes: ['REFERENCE_PRICE'],
      dataSourceCategories: ['reference_price'],
      productiveCategories: ['ENERGY'],
      feedProfiles: [{ ...fixtureReferencePriceFeed, productiveCategory: 'ENERGY' }],
    });
    assert.equal(productive.ok, false);
  });

  it('reuses Economic Data Fabric admission', async () => {
    const transport = new FakeExternalHttpTransport();
    transport.on('GET', 'https://fixture-energy-mtls.oracle.test/v1/energy', { body: vendorEnergyBody() });
    const result = await collectCandidateFeed(collector({ transport }));
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value.fabricEnvelopes.length >= 1, true);
      assert.equal(result.value.fabricEnvelopes[0]?.canMint, false);
    }
  });

  it('lets the existing oracle hold an observation without the connector finalizing a fact', async () => {
    const demo = await runExternalOracleProviderCandidateDemo();
    assert.equal(typeof demo.observationId, 'string');
    assert.equal(demo.observationId.length > 0, true);
    assert.equal(PROVIDER_SUCCESS_MINTS, false);
  });

  it('cannot mint from provider success', () => {
    assert.equal(PROVIDER_SUCCESS_MINTS, false);
    assert.equal(REFERENCE_PRICE_MINTS, false);
    assert.equal(PRODUCTION_ACTIVE, false);
  });

  it('proves consensus cannot import transport, credentials, or endpoint profiles', () => {
    const forbidden = [
      'external-provider-candidate',
      'FakeExternalHttpTransport',
      'http-transport',
      'NodeExternalHttpTransport',
      'SecretProvider',
      'ExternalProviderEndpointProfile',
    ];
    const files = walk(CONSENSUS_DIR).filter((file) => {
      if (file.includes(`${join('oracle', 'production')}`)) return false;
      if (file.endsWith('.test.ts') || file.endsWith('demo.ts') || file.endsWith('demo-helpers.ts')) return false;
      return file.endsWith('.ts');
    });
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const token of forbidden) {
        assert.equal(source.includes(token), false, `${file} must not mention ${token}`);
      }
    }
    assert.equal(CONSENSUS_CALLS_HTTP, false);
  });

  it('does not make real external calls and leaves LIVE flags unchanged', async () => {
    const demo = await runExternalOracleProviderCandidateDemo();
    assert.equal(demo.REAL_EXTERNAL_PROVIDER_CONFIGURED, false);
    assert.equal(demo.REAL_NETWORK_CALLED, false);
    assert.equal(REAL_EXTERNAL_PROVIDER_CONFIGURED, false);
    assert.equal(REAL_NETWORK_CALLED, false);
    assert.equal(RAW_CREDENTIALS_PRESENT, false);
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_MONEY_ENABLED, false);
    assert.equal(LIVE_BANKING_RAILS, false);
    assert.equal(LIVE_DATA_MARKET_ENABLED, false);
  });

  it('rejects unapproved hostnames, credential URLs, and redirect escape', async () => {
    const url = materializeApprovedUrl({
      endpoint: fixtureEnergyEndpoint,
      blueprint: { ...fixtureEnergyBlueprint, pathTemplate: 'https://evil.example/steal' },
    });
    assert.equal(url.ok, false);
    const credentialUrl = createEndpointProfile({
      ...fixtureEnergyEndpoint,
      baseOrigin: 'https://user:pass@fixture-energy-mtls.oracle.test',
    });
    assert.equal(credentialUrl.ok, false);
    const transport = new FakeExternalHttpTransport();
    transport.on('GET', 'https://fixture-energy-mtls.oracle.test/v1/energy', {
      status: 302,
      headers: { location: 'https://evil.example/exfil' },
      body: '',
    });
    const redirected = await collectCandidateFeed(collector({ transport }));
    assert.equal(redirected.ok, false);
    if (!redirected.ok) {
      assert.equal(redirected.error.code, 'REDIRECT_ESCAPE');
    }
  });

  it('rejects oversized responses, wrong content types, missing timestamps, and expired credentials', async () => {
    const oversized = new FakeExternalHttpTransport();
    oversized.on('GET', 'https://fixture-energy-mtls.oracle.test/v1/energy', {
      body: vendorEnergyBody({ value: '1'.repeat(8_000) }),
    });
    const tooBig = await collectCandidateFeed(
      collector({
        transport: oversized,
        endpoint: { ...fixtureEnergyEndpoint, maxResponseBytes: 64 },
      }),
    );
    assert.equal(tooBig.ok, false);

    const wrongType = new FakeExternalHttpTransport();
    wrongType.on('GET', 'https://fixture-energy-mtls.oracle.test/v1/energy', {
      headers: { 'content-type': 'text/html' },
      body: '<html></html>',
    });
    const typed = await collectCandidateFeed(collector({ transport: wrongType }));
    assert.equal(typed.ok, false);

    const missing = translateVendorRecord({
      vendor: { schemaId: 'fixture.vendor.v1', schemaVersion: 1, identifier: 'plant_sim_1', value: '100', unit: 'MWh' },
      feed: fixtureEnergyFeed,
      schema: fixtureSchema(fixtureEnergyFeed),
      providerId: FIXTURE_ENERGY_MTLS_ID,
    });
    assert.equal(missing.ok, false);
    if (!missing.ok) {
      assert.equal(missing.error.code, 'TIMESTAMP_MISSING');
    }

    const expired = bindCredentialDescriptor({
      descriptorRef: 'cred.expired',
      providerId: FIXTURE_ENERGY_MTLS_ID,
      authenticationMethod: 'MTLS',
      secretPath: 'oracle/expired',
      mtlsCertificateRef: 'cert.expired',
      expiresAtUnix: CANDIDATE_NOW_UNIX - 1n,
    });
    assert.equal(expired.ok, true);
    if (expired.ok) {
      assert.equal(credentialIsExpired(expired.value, CANDIDATE_NOW_UNIX), true);
    }
  });

  it('refuses suspended and revoked providers', async () => {
    const transport = new FakeExternalHttpTransport();
    transport.on('GET', 'https://fixture-energy-mtls.oracle.test/v1/energy', { body: vendorEnergyBody() });
    const suspended = await collectCandidateFeed(
      collector({ transport, profile: { ...fixtureEnergyProfile, state: 'SUSPENDED' } }),
    );
    assert.equal(suspended.ok, false);
    if (!suspended.ok) {
      assert.equal(suspended.error.code, 'PROVIDER_SUSPENDED');
    }
    const revoked = await collectCandidateFeed(
      collector({ transport, profile: { ...fixtureEnergyProfile, state: 'REVOKED' } }),
    );
    assert.equal(revoked.ok, false);
    if (!revoked.ok) {
      assert.equal(revoked.error.code, 'PROVIDER_REVOKED');
    }
  });

  it('does not treat a contract placeholder as proof', () => {
    assert.equal(populatedStringIsNotProof('contract-123'), 'REFERENCE_RECORDED');
    const placeholder = evidenceFromReference('contract', 'contract-123');
    assert.equal(placeholder.confirmationState, 'REFERENCE_RECORDED');
    assert.equal(assertPlaceholderIsNotConfirmed(placeholder).ok, true);
    assert.equal(assertPlaceholderIsNotConfirmed({ ...placeholder, confirmationState: 'CONFIRMED' }).ok, false);
  });

  it('projects only safe metadata into the Economic Asset Registry', () => {
    const mapped = mapCandidateToEconomicAsset({
      profile: fixtureEnergyProfile,
      feed: fixtureEnergyFeed,
      observationSetCommitment: 'obs-set-1',
      nowUnix: CANDIDATE_NOW_UNIX,
    });
    assert.equal(mapped.ok, true);
    if (mapped.ok) {
      const encoded = JSON.stringify(mapped.value);
      assert.equal(/authorization|access_token|api[_-]?key/i.test(encoded), false);
    }
    const projected = projectCandidateMetadata(new EconomicAssetRegistry(), {
      profile: fixtureEnergyProfile,
      feed: fixtureEnergyFeed,
      observationSetCommitment: 'obs-set-1',
      nowUnix: CANDIDATE_NOW_UNIX,
    });
    assert.equal(projected.ok, true);
  });

  it('reports coverage without a real external provider', () => {
    const report = buildProviderCandidateCoverageReport([fixtureEnergyProfile]);
    assert.equal(report.realExternalProviderConfigured, false);
    assert.equal(report.rows.every((row) => row.realExternalProviderConfigured === false), true);
    assert.equal(report.rows.some((row) => row.productiveCategory === 'ENERGY' && row.candidateProfileArchitectureSupported), true);
  });

  it('builds an onboarding packet that stays production-unauthorized', () => {
    const packet = buildOnboardingPacket({
      profile: fixtureEnergyProfile,
      endpoints: [fixtureEnergyEndpoint],
      technicalTestEvidenceRef: 'tech.1',
    });
    assert.equal(packet.productionAuthorized, false);
    assert.equal(packet.profileHash.length > 0, true);
    assert.equal(packet.externalEvidence.every((row) => row.confirmationState !== 'CONFIRMED'), true);
  });

  it('does not create a second oracle package', () => {
    assert.equal(existsSync(join(ROOT, 'packages/external-oracle-providers')), false);
    assert.equal(existsSync(join(ROOT, 'packages/oracle-provider-candidates')), false);
    assert.equal(existsSync(join(ROOT, 'packages/external-economic-oracles')), false);
    assert.equal(
      existsSync(join(ROOT, 'packages/sunrey-chain/src/oracle/production/external-provider-candidate/types.ts')),
      true,
    );
  });
});
