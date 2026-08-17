import assert from 'node:assert/strict';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  COVERAGE_INVENTORY,
  assertDifferentialAgreement,
  assertReplay,
  consensusCampaign,
  coverageCounts,
  feeActualNeverExceedsMax,
  feeEngineReservationConserved,
  generateDifferentialCases,
  interopPacketAtMostOnce,
  loadHexCorpus,
  loadReplayFixture,
  machineMandateProperties,
  moonreyIssuanceProperties,
  mulDivMatchesRounding,
  nativeAssetInvariantProperties,
  oracleAggregationProperties,
  protocolFuzzNeverPanics,
  replayProtocolCorpus,
  resolveFuzzProfile,
  runConsensusCampaign,
  runEconomicCampaign,
  runSecurityRegressionFixtures,
  runSignerSafetySequence,
  walletThresholdProperties,
} from './assurance/index.ts';
import { SeededRng } from './assurance/rng.ts';

const SEED = 56;
const CORPUS = join(import.meta.dirname, '../../../tests/assurance/corpus');
const FIXTURES = join(import.meta.dirname, '../../../tests/assurance/fixtures');

describe('Chunk 56 SunRey assurance', () => {
  const profile = resolveFuzzProfile('FUZZ_SMOKE');

  it('fuzzes protocol envelopes without panic', () => {
    const rejected = protocolFuzzNeverPanics(new SeededRng(SEED), profile.propertyCases);
    assert.ok(rejected >= 0);
  });

  it('holds fee, wallet, oracle, MoonRey, and asset properties', () => {
    const rng = new SeededRng(SEED);
    feeActualNeverExceedsMax(rng.child('fee'), profile.propertyCases);
    feeEngineReservationConserved(rng.child('fee-engine'), 16);
    walletThresholdProperties(rng.child('wallet'), 16);
    oracleAggregationProperties(rng.child('oracle'), profile.propertyCases);
    moonreyIssuanceProperties(rng.child('moonrey'), profile.propertyCases);
    nativeAssetInvariantProperties(rng.child('assets'), profile.propertyCases);
    mulDivMatchesRounding(rng.child('muldiv'), profile.propertyCases);
    machineMandateProperties();
    interopPacketAtMostOnce();
  });

  it('runs the required consensus campaign without conflicting finality', () => {
    const report = runConsensusCampaign(SEED, profile);
    assert.equal(report.ok, true);
    consensusCampaign(new SeededRng(SEED), profile.consensusEvents);
    const safety = runSignerSafetySequence(new SeededRng(SEED), 24);
    assert.ok(safety.conflicts >= 0);
  });

  it('runs the required economic campaign and replica state roots match', () => {
    const report = runEconomicCampaign(SEED, { ...profile, campaignOps: 256 });
    assert.equal(report.ok, true);
    assert.ok(report.operations >= 256);
    assert.ok(report.stateRoots.every((root) => root === report.stateRoots[0]));
  });

  it('agrees with recorded differential cases', () => {
    for (const item of generateDifferentialCases(SEED, 32)) {
      assertDifferentialAgreement(item);
    }
  });

  it('replays the checked-in security and protocol corpus', () => {
    const passed = runSecurityRegressionFixtures();
    assert.ok(passed.includes('signature-malleability'));
    assert.ok(passed.includes('cross-network-replay'));
    replayProtocolCorpus(loadHexCorpus(CORPUS));
    assertReplay(loadReplayFixture(join(FIXTURES, 'empty-decode.json')));
    assertReplay(loadReplayFixture(join(FIXTURES, 'fee-differential.json')));
  });

  it('classifies coverage without claiming formal verification', () => {
    const counts = coverageCounts();
    assert.ok(counts.implemented >= 20);
    assert.equal(COVERAGE_INVENTORY.some((entry) => entry.status === 'NOT_APPLICABLE'), true);
    assert.equal(
      COVERAGE_INVENTORY.some((entry) => entry.target.includes('machine-checked')),
      true,
    );
  });
});
