import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ALL_MESH_DOMAINS,
  DOMAIN_TOPOLOGIES,
  DOMAIN_VERIFICATION_POLICIES,
  ENERGY_VERIFICATION_POLICY,
  ORACLE_MESH_MINTS_MOONREY,
  analyzeProductiveIndependence,
  copiedSourcesDoNotCountIndependently,
  evaluateProductiveOracleMesh,
  marketReferenceCannotSubstituteForProduction,
  marketReferenceOnlyFixture,
  meshFixturePack,
  oracleMeshOutputCannotMint,
  policyForDomain,
  repeatedPollingDoesNotCreateRepeatedProduction,
  createReplayLedger,
  wrongSourceClassFixture,
  MESH_FIXTURE_NOW_UTC,
} from '../packages/sunrey-chain/src/oracle/production/oracle-mesh/index.ts';
import { providerLineageFromRecord } from '../packages/sunrey-chain/src/oracle/production/oracle-mesh/independence.ts';

describe('Wave 5 MoonRey Productive Oracle Mesh', () => {
  it('defines productive oracle source classes and domain topologies', () => {
    for (const domain of ALL_MESH_DOMAINS) {
      assert.ok(DOMAIN_TOPOLOGIES[domain]);
      assert.ok(DOMAIN_VERIFICATION_POLICIES[domain]);
      assert.ok(DOMAIN_TOPOLOGIES[domain].recommendedClasses.length >= 2);
    }
  });

  it('single source cannot satisfy multi-source policy where prohibited', () => {
    const pack = meshFixturePack('ENERGY', 'single_source');
    const output = evaluateProductiveOracleMesh({
      asset: pack.asset,
      candidateEvent: pack.candidateEvent,
      sourceRecords: pack.sourceRecords,
      policy: ENERGY_VERIFICATION_POLICY,
      evaluatedAtUtc: MESH_FIXTURE_NOW_UTC,
    });
    assert.equal(output.verified, false);
    assert.equal(output.evaluation.result, 'INSUFFICIENT_INDEPENDENT_SOURCES');
    assert.ok(output.evaluation.explanationCodes.includes('SINGLE_SOURCE_PROHIBITED'));
  });

  it('copied sources do not count independently', () => {
    const pack = meshFixturePack('ENERGY', 'copied_sources');
    const lineages = pack.sourceRecords.map((row) =>
      providerLineageFromRecord({
        providerId: row.providerId,
        controllerId: row.controllerId,
        upstreamOrganizationId: row.upstreamOrganizationId,
        datasetOriginId: row.datasetOriginId,
        copiedFromProviderId: row.copiedFromProviderId,
        derivedFromDatasetId: row.derivedFromDatasetId,
        sourceClass: row.sourceClass,
      }),
    );
    const independence = analyzeProductiveIndependence(lineages);
    assert.equal(independence.rawSourceCount, 3);
    assert.equal(independence.independentSourceCount, 1);
    assert.ok(copiedSourcesDoNotCountIndependently(lineages[0]!, lineages[1]!));

    const output = evaluateProductiveOracleMesh({
      asset: pack.asset,
      candidateEvent: pack.candidateEvent,
      sourceRecords: pack.sourceRecords,
      evaluatedAtUtc: MESH_FIXTURE_NOW_UTC,
    });
    assert.equal(output.evaluation.independentSourceCount, 1);
    assert.ok(output.evaluation.explanationCodes.includes('COPIED_SOURCES_COLLAPSED'));
  });

  it('independent sources do count toward corroboration', () => {
    const pack = meshFixturePack('ENERGY', 'healthy_corroboration');
    const output = evaluateProductiveOracleMesh({
      asset: pack.asset,
      candidateEvent: pack.candidateEvent,
      sourceRecords: pack.sourceRecords,
      evaluatedAtUtc: MESH_FIXTURE_NOW_UTC,
    });
    assert.equal(output.evaluation.independentSourceCount, 2);
    assert.equal(output.evaluation.result, 'CORROBORATED');
    assert.equal(output.verified, true);
    assert.ok(output.evaluation.explanationCodes.includes('INDEPENDENT_SOURCES_SATISFIED'));
  });

  it('stale source is excluded from corroboration', () => {
    const pack = meshFixturePack('ENERGY', 'stale_source');
    const output = evaluateProductiveOracleMesh({
      asset: pack.asset,
      candidateEvent: pack.candidateEvent,
      sourceRecords: pack.sourceRecords,
      evaluatedAtUtc: MESH_FIXTURE_NOW_UTC,
    });
    assert.ok(output.evaluation.explanationCodes.includes('STALE_SOURCE_EXCLUDED'));
    assert.equal(output.evaluation.freshness.staleExcludedCount, 1);
    assert.equal(output.evaluation.independentSourceCount, 1);
    assert.equal(output.verified, false);
  });

  it('detects outlier providers', () => {
    const pack = meshFixturePack('ENERGY', 'outlier');
    const output = evaluateProductiveOracleMesh({
      asset: pack.asset,
      candidateEvent: pack.candidateEvent,
      sourceRecords: pack.sourceRecords,
      evaluatedAtUtc: MESH_FIXTURE_NOW_UTC,
    });
    assert.ok(output.evaluation.explanationCodes.includes('OUTLIER_DETECTED'));
    assert.equal(output.evaluation.conflicts.disagreementLevel, 'OUTLIER');
    assert.equal(output.verified, false);
  });

  it('handles provider outage without necessarily failing the whole system', () => {
    const healthy = meshFixturePack('COMPUTE', 'healthy_corroboration');
    const outage = meshFixturePack('COMPUTE', 'provider_outage');
    const output = evaluateProductiveOracleMesh({
      asset: healthy.asset,
      candidateEvent: healthy.candidateEvent,
      sourceRecords: [...healthy.sourceRecords, ...outage.sourceRecords],
      evaluatedAtUtc: MESH_FIXTURE_NOW_UTC,
    });
    assert.ok(output.evaluation.explanationCodes.includes('PROVIDER_OPERATIONALLY_UNAVAILABLE'));
    assert.equal(output.evaluation.result, 'CORROBORATED');
    assert.equal(output.verified, true);
  });

  it('rejects wrong source class for domain policy', () => {
    const pack = wrongSourceClassFixture('ENERGY');
    const output = evaluateProductiveOracleMesh({
      asset: pack.asset,
      candidateEvent: pack.candidateEvent,
      sourceRecords: pack.sourceRecords,
      evaluatedAtUtc: MESH_FIXTURE_NOW_UTC,
    });
    assert.equal(output.evaluation.result, 'SOURCE_CLASS_REJECTED');
    assert.equal(output.verified, false);
  });

  it('market price cannot substitute for production evidence', () => {
    const pack = marketReferenceOnlyFixture('ENERGY');
    assert.equal(marketReferenceCannotSubstituteForProduction('MARKET_REFERENCE'), true);
    const output = evaluateProductiveOracleMesh({
      asset: pack.asset,
      candidateEvent: pack.candidateEvent,
      sourceRecords: pack.sourceRecords,
      evaluatedAtUtc: MESH_FIXTURE_NOW_UTC,
    });
    assert.equal(output.evaluation.result, 'MARKET_REFERENCE_CANNOT_SUBSTITUTE');
    assert.ok(output.evaluation.explanationCodes.includes('MARKET_REFERENCE_NOT_PRODUCTION_EVIDENCE'));
    assert.equal(output.verified, false);
  });

  it('oracle output cannot mint', () => {
    const pack = meshFixturePack('MANUFACTURING', 'healthy_corroboration');
    const output = evaluateProductiveOracleMesh({
      asset: pack.asset,
      candidateEvent: pack.candidateEvent,
      sourceRecords: pack.sourceRecords,
      evaluatedAtUtc: MESH_FIXTURE_NOW_UTC,
    });
    assert.equal(ORACLE_MESH_MINTS_MOONREY, false);
    assert.equal(output.mintsMoonRey, false);
    assert.equal(output.evaluation.mintsMoonRey, false);
    assert.equal(output.evaluation.grantsExecutionAuthority, false);
    assert.ok(oracleMeshOutputCannotMint(output));
    assert.ok(output.evaluation.explanationCodes.includes('ORACLE_CANNOT_MINT'));
  });

  it('prevents repeated API polling from creating repeated production', () => {
    const ledger = createReplayLedger();
    const result = repeatedPollingDoesNotCreateRepeatedProduction(
      ledger,
      {
        providerId: 'energy_meter_a',
        sourceRecordId: 'meter_1',
        datasetOriginId: 'origin.meter_a',
      },
      100,
    );
    assert.equal(result.uniqueObservations, 1);
    assert.equal(result.duplicates, 99);
  });

  it('evaluates all domain fixtures without throwing', () => {
    for (const domain of ALL_MESH_DOMAINS) {
      const policy = policyForDomain(domain);
      const healthy = meshFixturePack(domain, 'healthy_corroboration');
      const output = evaluateProductiveOracleMesh({
        asset: healthy.asset,
        candidateEvent: healthy.candidateEvent,
        sourceRecords: healthy.sourceRecords,
        policy,
        evaluatedAtUtc: MESH_FIXTURE_NOW_UTC,
      });
      assert.equal(output.evaluation.productiveAsset.domain, domain);
      assert.ok(output.evaluation.observations.length >= 1);
    }
  });

  it('material conflict is not averaged away', () => {
    const pack = meshFixturePack('LOGISTICS', 'conflict');
    const output = evaluateProductiveOracleMesh({
      asset: pack.asset,
      candidateEvent: pack.candidateEvent,
      sourceRecords: pack.sourceRecords,
      evaluatedAtUtc: MESH_FIXTURE_NOW_UTC,
    });
    assert.equal(output.evaluation.conflicts.disagreementLevel, 'MATERIAL_CONFLICT');
    assert.equal(output.evaluation.result, 'MATERIAL_CONFLICT');
    assert.equal(output.verified, false);
  });

  it('invalid rights are rejected', () => {
    const pack = meshFixturePack('WATER', 'invalid_rights');
    const output = evaluateProductiveOracleMesh({
      asset: pack.asset,
      candidateEvent: pack.candidateEvent,
      sourceRecords: pack.sourceRecords,
      evaluatedAtUtc: MESH_FIXTURE_NOW_UTC,
    });
    assert.equal(output.evaluation.result, 'INVALID_RIGHTS');
    assert.ok(output.evaluation.explanationCodes.includes('RIGHTS_INVALID'));
  });
});
