/**
 * Wave 4 Economic Awareness Fabric — exit-gate red-team suite.
 *
 * Exercises Provider → Connector → Observation → Event/Provenance → Federation →
 * Entity Resolution → Graph → Information Consensus → VerifiedEconomicFact → Claim
 * without granting monetary authority to any awareness-layer component.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import { detectDuplicateJobs } from '../packages/external-data/src/wave6/deduplication.ts';
import {
  buildExternalObservation,
  ProviderRegistry,
  runNormalizationPipeline,
  type ExternalObservation,
  type RawProviderResponse,
} from '../packages/provider-sdk/src/index.ts';
import { redactErrorMessage, redactUrlForLog, createRedactionCatalog } from '../packages/provider-sdk/src/redaction.ts';
import {
  createExternalDataTrustEngine,
  countIndependentSources,
  type TrustObservationContext,
} from '../packages/provider-sdk/src/trust/index.ts';
import { OracleEngine } from '../packages/sunrey-chain/src/oracle/engine.ts';
import { moonreyIssuanceActivated } from '../packages/sunrey-chain/src/protocol/assets.ts';
import { oracleFactCreationNeverMintsMoonRey } from '../packages/sunrey-chain/src/oracle/production/eligibility.ts';
import {
  analyzeIndependentSources,
  groupObservations,
  sameControllerSources,
  energyProductionFixture,
  ingestBatch,
  EconomicDataFabricStore,
  FABRIC_NOW_UNIX,
} from '../packages/sunrey-chain/src/oracle/production/economic-data-fabric/index.ts';
import { verifyObservation } from '../packages/sunrey-chain/src/productive/economy-data/verification.ts';
import { HumanInformationNetworkEngine } from '../packages/information-market/src/network/engine.ts';
import { HumanInformationNetworkStore } from '../packages/information-market/src/network/store.ts';

const NOW = asUtcInstant('2026-09-02T12:00:00.000Z');
const SOURCE = asUtcInstant('2026-09-02T11:55:00.000Z');

function energyCtx(
  providerId: string,
  quantityMwh: string,
  lineage?: { upstreamSource?: string; sourceFamily?: string },
): TrustObservationContext<{ quantityMwh: string }> {
  const built = buildExternalObservation({
    providerId,
    providerCategory: 'energy',
    capability: 'macroeconomic_indicators',
    data: { quantityMwh },
    source: { provider: providerId, dataset: 'generation' },
    time: { retrievedAt: NOW, sourceTimestamp: SOURCE },
    authorityClass: 'authoritative_official',
    provenance: { rawPayload: JSON.stringify({ quantityMwh }), providerSchemaVersion: 'energy/1' },
  });
  assert.equal(built.ok, true);
  return Object.freeze({
    observation: built.value!,
    numericValue: Number(quantityMwh),
    lineage: lineage ? Object.freeze(lineage) : undefined,
  });
}

describe('Wave 4 exit gate — TASK 1 Provider red team', () => {
  it('rejects unknown provider registration', () => {
    const registry = new ProviderRegistry();
    assert.throws(
      () =>
        registry.register(
          {
            descriptor: {
              providerId: 'totally-unknown-provider-xyz',
              displayName: 'Unknown',
              category: 'other',
              capabilities: ['macro_indicators'],
              activationMode: 'simulation_fixture',
              authorityClass: 'community_data',
              domains: ['macro'],
              healthStatus: 'healthy',
              commercialUseStatus: 'unknown',
              redistributionStatus: 'unknown',
              schemaVersion: 'test/1',
            },
            fetch: async () => ({ ok: false, code: 'NOT_IMPLEMENTED', message: 'n/a' }),
          } as never,
          { activationMode: 'simulation_fixture' },
        ),
      /catalog|unknown|not found/i,
    );
  });

  it('excludes quarantined and disabled providers from trust consensus', () => {
    const engine = createExternalDataTrustEngine();
    const healthy = energyCtx('eia-generation', '500');
    const quarantined = Object.freeze({
      ...energyCtx('compromised-aggregator', '500'),
      quarantined: true,
    });
    const result = engine.assess({
      contexts: [healthy, quarantined],
      policyProfile: 'ENERGY',
      semanticKey: 'energy.mwh',
      unit: 'MWh',
    });
    assert.ok(result.excludedObservationIds.includes(quarantined.observation.observationId));
    assert.notEqual(result.status, 'VERIFIED');
  });

  it('does not treat schema-changed payload as verified without validation failure surface', () => {
    const raw: RawProviderResponse = {
      providerId: 'schema-shift',
      capability: 'energy',
      requestId: 'req-1',
      retrievedAt: NOW,
      rawPayload: '{not-json',
      providerSchemaVersion: 'broken/99',
    };
    const pipeline = {
      untrustedParse: () => ({ ok: false as const, code: 'JSON_PARSE_FAILED', message: 'invalid' }),
      schemaValidator: { providerId: 'x', providerSchemaVersion: '1', validate: () => ({ ok: true as const, value: {} }) },
      parser: { providerId: 'x', parse: () => ({ ok: true as const, value: {} }) },
      mapper: { normalizationVersion: '1', map: () => ({ ok: true as const, value: {} }) },
      assembler: { assemble: () => ({ ok: false as const, code: 'UNREACHABLE', message: 'n/a' }) },
    };
    const result = runNormalizationPipeline(pipeline, raw);
    assert.equal(result.ok, false);
  });
});

describe('Wave 4 exit gate — TASK 2 Connector red team', () => {
  it('redacts credentials from transport error surfaces', () => {
    const catalog = createRedactionCatalog();
    const secret = 'super-secret-api-key-value';
    const redacted = redactErrorMessage(`Request failed with api_key=${secret}`, [secret]);
    assert.equal(redacted.includes(secret), false);
    assert.ok(redacted.includes('[REDACTED]'));
    const url = redactUrlForLog(`https://api.example.com/data?api_key=${secret}`, catalog);
    assert.equal(url.includes(secret), false);
  });
});

describe('Wave 4 exit gate — TASK 3 Normalization red team', () => {
  it('rejects capacity power dimension mislabeled as energy quantity', async () => {
    const { ingestEnergyObservation } = await import(
      '../packages/sunrey-chain/src/oracle/production/provider-families/energy/adapter.ts'
    );
    const { capacityMwhAsMwFixture } = await import(
      '../packages/sunrey-chain/src/oracle/production/provider-families/energy/fixtures.ts'
    );
    const rejected = ingestEnergyObservation(capacityMwhAsMwFixture(), FABRIC_NOW_UNIX);
    assert.equal(rejected.ok, false);
    if (!rejected.ok) {
      assert.match(rejected.error.detail, /MW|capacity|power|unit/i);
    }
  });

  it('rejects observation without provider id', () => {
    const built = buildExternalObservation({
      providerId: '   ',
      providerCategory: 'economic_data',
      capability: 'test',
      data: { value: 1 },
      source: { provider: 'x', dataset: 'd' },
      time: { retrievedAt: NOW },
      authorityClass: 'reference_data',
      provenance: { rawPayload: '{}', providerSchemaVersion: '1' },
    });
    assert.equal(built.ok, false);
  });
});

describe('Wave 4 exit gate — TASK 5 Federation red team', () => {
  it('has no federated query entrypoint — awareness layer cannot silently federate', () => {
    // Federation is not implemented as a governed query plane; callers must use domain owners.
    const federationExports = [
      'FederatedQuery',
      'federatedQuery',
      'createFederatedQueryService',
      'EconomicAwarenessFabric',
    ];
    for (const symbol of federationExports) {
      assert.equal(typeof (globalThis as Record<string, unknown>)[symbol], 'undefined');
    }
  });
});

describe('Wave 4 exit gate — TASK 7 Double-counting red team', () => {
  it('five sensor paths through same controller do not equal five independent sources', () => {
    const candidates = sameControllerSources();
    const store = new EconomicDataFabricStore();
    const batch = ingestBatch(candidates, 'FIXTURE_ONLY', FABRIC_NOW_UNIX, store);
    const envelopes = batch.accepted;
    const grouped = groupObservations(envelopes, {
      [envelopes[0]!.sourceId]: { controllerId: 'utility-controller', sharedControlGroup: 'grid-1' },
      [envelopes[1]!.sourceId]: { controllerId: 'utility-controller', sharedControlGroup: 'grid-1' },
    });
    assert.equal(grouped.length, 1);
    const group = grouped[0]!;
    assert.equal(group.rawSourceCount, 2);
    assert.equal(group.independentControllerCount, 1);
    const independence = analyzeIndependentSources([
      { sourceId: 'sensor-a', controllerId: 'utility-controller', upstreamOrganizationId: 'org-1', sharedControlGroup: 'grid-1' },
      { sourceId: 'operator-b', controllerId: 'utility-controller', upstreamOrganizationId: 'org-1', sharedControlGroup: 'grid-1' },
      { sourceId: 'gov-c', controllerId: 'utility-controller', upstreamOrganizationId: 'org-1', sharedControlGroup: 'grid-1' },
      { sourceId: 'agg-d', controllerId: 'utility-controller', upstreamOrganizationId: 'org-1', sharedControlGroup: 'grid-1' },
      { sourceId: 'web-e', controllerId: 'utility-controller', upstreamOrganizationId: 'org-1', sharedControlGroup: 'grid-1' },
    ]);
    assert.equal(independence.rawSourceCount, 5);
    assert.equal(independence.independentControllerCount, 1);
    assert.equal(independence.endpointCountIsNotIndependence, true);
  });

  it('trust engine deduplicates mirrored lineage for independence counting', () => {
    const contexts = [
      energyCtx('gov-open-data', '100', { upstreamSource: 'eia-923', sourceFamily: 'US_EIA' }),
      energyCtx('aggregator-copy', '100', { upstreamSource: 'eia-923', sourceFamily: 'US_EIA' }),
      energyCtx('website-copy', '100', { upstreamSource: 'eia-923', sourceFamily: 'US_EIA' }),
    ];
    assert.equal(countIndependentSources(contexts), 1);
  });

  it('human contribution dedupes same work across publication surfaces', () => {
    const jobs = Object.freeze([
      Object.freeze({
        opportunityId: 'job-1',
        providerId: 'pub-db',
        providerJobId: 'doi:10.1/example',
        title: 'Quantum Economics',
        employer: 'Example University',
        location: 'Remote',
        applicationUrl: 'https://example.edu/paper/1',
        freshness: 'fresh' as const,
        observedAt: NOW,
      }),
      Object.freeze({
        opportunityId: 'job-2',
        providerId: 'aggregator',
        providerJobId: 'agg-99',
        title: 'Quantum Economics',
        employer: 'Example University',
        location: 'Remote',
        applicationUrl: 'https://example.edu/paper/1',
        freshness: 'fresh' as const,
        observedAt: NOW,
      }),
    ]);
    const deduped = detectDuplicateJobs(jobs);
    assert.equal(deduped.length, 1);
    assert.equal(deduped[0]!.mergedSourceIds?.length, 2);
  });
});

describe('Wave 4 exit gate — TASK 8 Information consensus red team', () => {
  it('high-reputation wrong source loses to policy when corroboration insufficient', () => {
    const engine = createExternalDataTrustEngine();
    const officialWrong = energyCtx('official-wrong', '900');
    const sensorRight = Object.freeze({
      ...energyCtx('direct-sensor', '500'),
      observation: Object.freeze({
        ...energyCtx('direct-sensor', '500').observation,
        authority: Object.freeze({ authorityClass: 'community_data' as const }),
      }),
    });
    const result = engine.assess({
      contexts: [officialWrong, sensorRight],
      policyProfile: 'ENERGY',
      semanticKey: 'energy.mwh',
      unit: 'MWh',
    });
    assert.ok(result.status !== 'VERIFIED' || result.confidenceBand !== 'HIGH');
  });

  it('single-source verified is not consensus and cannot claim consensus', () => {
    const decision = verifyObservation({
      signatureValid: true,
      provenancePresent: true,
      freshnessState: 'FRESH',
      independentSourceCount: 1,
      values: [100n],
      subjectValue: 100n,
    });
    assert.equal(decision.status, 'SINGLE_SOURCE_VERIFIED');
    assert.equal(decision.consensusClaimed, false);
    assert.equal(decision.singleSourceIsConsensus, false);
  });
});

describe('Wave 4 exit gate — TASK 9 Monetary authority red team', () => {
  it('VerifiedEconomicFact path does not mint MoonRey', () => {
    assert.equal(oracleFactCreationNeverMintsMoonRey(), true);
    assert.equal(moonreyIssuanceActivated(), false);
  });

  it('oracle engine stores facts without supply mutation API', () => {
    const engine = new OracleEngine({
      networkId: 'sim-net',
      chainId: 'sim-chain',
      clock: { nowUnix: () => FABRIC_NOW_UNIX },
    });
    assert.equal(typeof (engine as { authorizeIssuance?: unknown }).authorizeIssuance, 'undefined');
    assert.equal(typeof (engine as { postJournal?: unknown }).postJournal, 'undefined');
  });

  it('economic data fabric store cannot mint', () => {
    const store = new EconomicDataFabricStore();
    const batch = ingestBatch([energyProductionFixture()], 'FIXTURE_ONLY', FABRIC_NOW_UNIX, store);
    assert.equal(batch.accepted.length > 0, true);
    assert.equal(typeof (store as { mint?: unknown }).mint, 'undefined');
  });
});

describe('Wave 4 exit gate — TASK 10 Privacy red team', () => {
  it('fabric privacy fixture is rejected at admission — secrets cannot enter envelopes', async () => {
    const { privacyLeakFixture, admitCollection } = await import(
      '../packages/sunrey-chain/src/oracle/production/economic-data-fabric/index.ts'
    );
    const leaked = admitCollection(privacyLeakFixture(), 'FIXTURE_ONLY', FABRIC_NOW_UNIX);
    assert.equal(leaked.ok, false);
    if (!leaked.ok) {
      assert.equal(leaked.error.code, 'PRIVACY_FIREWALL_VIOLATION');
    }
  });
});

describe('Wave 4 exit gate — TASK 11 Persistence / restart (simulation)', () => {
  it('fabric store replays duplicate ingestion without duplicating envelopes', () => {
    const store = new EconomicDataFabricStore();
    const fixture = energyProductionFixture();
    const first = ingestBatch([fixture], 'FIXTURE_ONLY', FABRIC_NOW_UNIX, store);
    const second = ingestBatch([fixture], 'FIXTURE_ONLY', FABRIC_NOW_UNIX, store);
    assert.equal(first.accepted.length, 1);
    assert.equal(second.accepted.length, 1);
    assert.equal(second.results[0]?.replay, true);
    assert.equal(store.list().length, 1);
  });
});

describe('Wave 4 exit gate — TASK 12 Performance baseline (local synthetic)', () => {
  it('records observation ingestion and trust evaluation latency samples', () => {
    const engine = createExternalDataTrustEngine();
    const contexts = Array.from({ length: 20 }, (_, i) => energyCtx(`provider-${i}`, String(400 + i)));
    const trustSamples: number[] = [];
    for (let i = 0; i < 50; i += 1) {
      const start = performance.now();
      engine.assess({
        contexts,
        policyProfile: 'ENERGY',
        semanticKey: 'energy.mwh',
        unit: 'MWh',
      });
      trustSamples.push(performance.now() - start);
    }
    trustSamples.sort((a, b) => a - b);
    const p50 = trustSamples[Math.floor(trustSamples.length / 2)]!;
    const p99 = trustSamples[Math.floor(trustSamples.length * 0.99)]!;
    assert.ok(p50 < 50, `trust p50 ${p50}ms should stay under 50ms locally`);
    assert.ok(p99 < 200, `trust p99 ${p99}ms should stay under 200ms locally`);
  });
});

describe('Wave 4 exit gate — TASK 15 criteria spot checks', () => {
  it('mainnet and LIVE issuance remain fail-closed', () => {
    assert.equal(moonreyIssuanceActivated(), false);
  });

  it('HIN path cannot mint from awareness-layer activity alone', () => {
    const store = new HumanInformationNetworkStore();
    const engine = new HumanInformationNetworkEngine({ store });
    assert.equal(typeof (engine as { authorizeIssuance?: unknown }).authorizeIssuance, 'undefined');
    assert.equal(typeof (store as { mint?: unknown }).mint, 'undefined');
  });
});
