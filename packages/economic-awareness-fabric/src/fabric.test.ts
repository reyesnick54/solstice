import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  capabilityBlocksMonetaryMutation,
  createEconomicAwarenessFabric,
  FAIL_CLOSED_RULES,
  harness,
  authority,
  corroboration,
  informationConsensus,
  entities,
  normalization,
} from './index.ts';
import { fixtureHumanObservation } from '@solstice/sunrey-chain/economic-proof';
import { buildEvidenceFromObservation } from '@solstice/sunrey-chain/economic-proof';
import { proposeEvidenceFromObservations } from './evidence/builder.ts';
import { loadFabricConfig, DEFAULT_FABRIC_CONFIG } from './config/loader.ts';
import { materialFromRefs, resolveEntity } from './entities/resolution.ts';
import {
  PRODUCTIVE_ENERGY_CANDIDATE,
  THREE_INDEPENDENT_SOURCES,
  THREE_PROVIDERS_ONE_UPSTREAM,
  PRODUCTIVE_ENERGY_METHODOLOGY,
} from './consensus/index.ts';

describe('Wave 4 Economic Awareness Fabric', () => {
  it('blocks monetary mutation at capability boundary', () => {
    assert.equal(capabilityBlocksMonetaryMutation(), true);
    const fabric = createEconomicAwarenessFabric();
    assert.equal(fabric.authorityIntact, true);
    assert.equal(fabric.capability.mayIssueSunRey, false);
    assert.equal(fabric.capability.mayIssueMoonRey, false);
  });

  it('enforces fail-closed rules structurally', () => {
    assert.equal(FAIL_CLOSED_RULES.unknownProviderUntrusted, true);
    assert.equal(FAIL_CLOSED_RULES.claimNotMonetaryAuthorization, true);
    const reject = authority.rejectMonetaryAuthority('issue_sunrey');
    assert.equal(reject.permitted, false);
  });

  it('loads versioned fabric configuration', () => {
    const config = loadFabricConfig();
    assert.equal(config.environment, 'simulation');
    assert.equal(config.failClosed.unknownProviderIsUntrusted, true);
    assert.equal(DEFAULT_FABRIC_CONFIG.fabricId, 'sunrey-economic-awareness-fabric');
  });

  it('ingests fixture provider through sandbox harness', async () => {
    const sandbox = harness.createSandboxHarness();
    sandbox.registerFixtureProvider(harness.FIXTURE_ENERGY_PROVIDER, { mwh: 100 });

    const result = await sandbox.ingestFixture('eia-fixture', 'generation.mwh', { mwh: 100 });
    assert.equal(result.ok, true);
    assert.ok(result.envelope);
    assert.equal(result.envelope!.schemaVersion, normalization.FABRIC_OBSERVATION_ENVELOPE_SCHEMA);
    assert.equal(sandbox.events.list('provider.ingested').length, 1);
    assert.equal(sandbox.reputation.score('eia-fixture')?.sampleCount, 1);
  });

  it('rejects unknown provider at ingestion', async () => {
    const sandbox = harness.createSandboxHarness();
    const result = await sandbox.ingestFixture('unknown-provider', 'test', {});
    assert.equal(result.ok, false);
  });

  it('resolves entities without raw identifiers', () => {
    const material = materialFromRefs('PRODUCTIVE', 'POWER_PLANT', ['plant_commitment_abc'], 'US');
    const resolved = resolveEntity({ material, aliases: [] });
    assert.ok(resolved.canonicalEntityId.startsWith('ep_') || resolved.canonicalEntityId.length > 10);
  });

  it('satisfies lineage-aware corroboration with independent sources', () => {
    const policy = informationConsensus.resolveMethodologyPolicy(PRODUCTIVE_ENERGY_METHODOLOGY.methodology);
    const independence = corroboration.analyzeSourceIndependence(THREE_INDEPENDENT_SOURCES);
    const result = corroboration.evaluateCorroboration(policy, THREE_INDEPENDENT_SOURCES, independence);
    assert.equal(result.satisfied, true);
    assert.equal(independence.independentLineageRootCount, 3);
  });

  it('fails corroboration when providers share upstream lineage', () => {
    const policy = informationConsensus.resolveMethodologyPolicy(PRODUCTIVE_ENERGY_METHODOLOGY.methodology);
    const independence = corroboration.analyzeSourceIndependence(THREE_PROVIDERS_ONE_UPSTREAM);
    const result = corroboration.evaluateCorroboration(policy, THREE_PROVIDERS_ONE_UPSTREAM, independence);
    assert.equal(result.satisfied, false);
    assert.equal(independence.independentLineageRootCount, 1);
  });

  it('proposes evidence without minting', () => {
    const obs = fixtureHumanObservation();
    const proposal = proposeEvidenceFromObservations(
      [obs],
      (observations) =>
        buildEvidenceFromObservation(observations[0]!, {
          evidenceId: 'ev_fixture_001',
          purposeDigest: 'sha256:purpose-fixture',
        }),
      '2026-01-01T00:00:00.000Z',
    );
    assert.ok(proposal);
    assert.equal(proposal!.observationIds.length, 1);
    assert.equal(proposal!.evidence.authority.mintsNativeAsset, false);
  });

  it('executes federated query across stored envelopes', async () => {
    const sandbox = harness.createSandboxHarness();
    sandbox.registerFixtureProvider(harness.FIXTURE_MACRO_PROVIDER, { gdp: 1 });
    await sandbox.ingestFixture('fred-fixture', 'gdp', { gdp: 1 });

    const fabric = createEconomicAwarenessFabric();
    for (const [id, env] of sandbox.envelopes) {
      fabric.ports.envelopes.set(id, env);
    }

    const result = fabric.ports.federation.execute(
      {
        queryId: 'q1',
        economicDomain: 'macroeconomics',
        metric: 'gdp',
        entityRef: null,
        providerIds: ['fred-fixture'],
        asOfUtc: '2026-01-01T00:00:00.000Z',
      },
      fabric.ports.envelopes,
    );
    assert.equal(result.providerCoverage['fred-fixture'], 'hit');
  });
});
