import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  capabilityBlocksMonetaryMutation,
  createEconomicAwarenessFabric,
  FAIL_CLOSED_RULES,
  harness,
  authority,
  corroboration,
  entities,
  normalization,
} from './index.ts';
import { fixtureHumanObservation, fixtureProductiveObservation } from '../../sunrey-chain/src/economic-proof/fixtures.ts';
import { buildEvidenceFromObservation } from '../../sunrey-chain/src/economic-proof/adapters.ts';
import { proposeEvidenceFromObservations } from './evidence/builder.ts';
import { loadFabricConfig, DEFAULT_FABRIC_CONFIG } from './config/loader.ts';
import { materialFromRefs, resolveEntity } from './entities/resolution.ts';

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

  it('corroborates observations with quorum', () => {
    const obs1 = fixtureProductiveObservation('obs_a');
    const obs2 = fixtureProductiveObservation('obs_b');
    const result = corroboration.corroborateObservations({
      observations: [obs1, obs2],
      quorumRequired: 2,
    });
    assert.equal(result.status, 'corroborated');
  });

  it('fails corroboration below quorum', () => {
    const result = corroboration.corroborateObservations({
      observations: [fixtureHumanObservation()],
      quorumRequired: 2,
    });
    assert.equal(result.status, 'insufficient');
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
