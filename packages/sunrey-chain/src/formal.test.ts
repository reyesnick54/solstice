import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { CRYPTO_MIGRATION_STATES } from '../../security/src/crypto-migration.ts';
import { DEV_INTEROP_TEST_ASSET, PACKET_LIFECYCLES } from './interop/types.ts';
import { FEE_DISPOSITION_SINKS } from './fees/types.ts';
import { UPGRADE_STATUSES } from './governance/types.ts';
import { twoThirdsPlus } from './ops/topology.ts';
import { twoThirdsThreshold } from './assurance/consensus.ts';
import { checkTraceConformance, replayTrace } from './formal/conformance.ts';
import {
  exceedsOneThird,
  exceedsTwoThirds,
  hasTwoThirdsPlus,
  IMPLEMENTATION_CONSTANT_SNAPSHOT,
  implementationQuorumAgrees,
  QUORUM_BOUNDARY_TOTALS,
  twoThirdsThresholdFormal,
} from './formal/constants.ts';
import { exploreModel, requireVerified } from './formal/explore.ts';
import { FORMAL_DASHBOARD_ID, formalDashboardPayload } from './formal/dashboard.ts';
import { modelsForProfile, quorumBoundaryCases } from './formal/models/index.ts';
import { MODEL_CRYPTO_STATES } from './formal/models/crypto-policy.ts';
import { MODEL_INTEROP_ASSET } from './formal/models/interop-asset.ts';
import { FORMAL_SMOKE_PROFILE } from './formal/profiles.ts';
import { loadFormalModelRegistry } from './formal/registry.ts';
import { buildFormalVerificationReport, publicAssuranceView } from './formal/report.ts';
import { allDevelopmentTraces } from './formal/traces.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');

describe('Chunk 61 formal models', () => {
  it('registers every required model', () => {
    const registry = loadFormalModelRegistry();
    assert.equal(registry.claimLanguage, 'model checked within stated bounds');
    assert.equal(registry.notWholeSystemVerification, true);
    assert.equal(registry.selectedTool, 'TLA+/TLC');
    assert.equal(registry.models.length, 16);
  });

  it('model-checks the smoke campaign within stated bounds', () => {
    for (const model of modelsForProfile(FORMAL_SMOKE_PROFILE)) {
      const result = exploreModel(model, 'FORMAL_SMOKE', 'sunrey-formal-explicit-state/1');
      requireVerified(result);
      assert.ok(result.statesExplored > 0, model.modelId);
    }
  });

  it('aligns quorum arithmetic with the implementation', () => {
    for (const total of QUORUM_BOUNDARY_TOTALS) {
      assert.equal(implementationQuorumAgrees(total), true, String(total));
      assert.equal(twoThirdsThresholdFormal(total), twoThirdsPlus(total));
      assert.equal(twoThirdsThresholdFormal(total), twoThirdsThreshold(total));
    }
    for (const row of quorumBoundaryCases()) {
      assert.equal(exceedsOneThird(row.signed, row.total), row.oneThird);
      assert.equal(exceedsTwoThirds(row.signed, row.total), row.twoThirds);
      assert.equal(hasTwoThirdsPlus(row.signed, row.total), row.twoThirds);
    }
  });

  it('detects silent constant drift', () => {
    assert.deepEqual(IMPLEMENTATION_CONSTANT_SNAPSHOT.cryptoMigrationStates, CRYPTO_MIGRATION_STATES);
    assert.equal(IMPLEMENTATION_CONSTANT_SNAPSHOT.interopDevAsset, DEV_INTEROP_TEST_ASSET);
    assert.equal(MODEL_INTEROP_ASSET, DEV_INTEROP_TEST_ASSET);
    assert.deepEqual(IMPLEMENTATION_CONSTANT_SNAPSHOT.packetLifecycles, PACKET_LIFECYCLES);
    assert.deepEqual(IMPLEMENTATION_CONSTANT_SNAPSHOT.feeDispositionSinks, FEE_DISPOSITION_SINKS);
    assert.deepEqual(IMPLEMENTATION_CONSTANT_SNAPSHOT.upgradeStatuses, UPGRADE_STATUSES);
    assert.deepEqual([...MODEL_CRYPTO_STATES], [...CRYPTO_MIGRATION_STATES.slice(0, 5)]);
    assert.equal(IMPLEMENTATION_CONSTANT_SNAPSHOT.settlementAtomicity, 'all-or-nothing');
  });

  it('replays sanitized implementation traces against the models', () => {
    for (const trace of allDevelopmentTraces()) {
      const replayed = replayTrace(trace);
      assert.equal(replayed.aligned, true, `${trace.id}: ${replayed.reason}`);
    }
    const results = checkTraceConformance(allDevelopmentTraces());
    assert.ok(results.every((row) => row.aligned));
  });

  it('writes a machine-readable report without secrets', () => {
    const report = buildFormalVerificationReport('FORMAL_SMOKE');
    assert.equal(report.claim, 'model checked within stated bounds');
    assert.equal(report.notWholeSystemVerification, true);
    assert.ok(report.models.every((row) => row.result === 'VERIFIED_WITHIN_MODEL_BOUNDS'));
    const view = publicAssuranceView(report);
    assert.equal(JSON.stringify(view).includes('secret'), false);
    const dashboard = formalDashboardPayload(report);
    assert.equal(dashboard.id, FORMAL_DASHBOARD_ID);
    assert.equal(dashboard.secretsExposed, false);
  });

  it('keeps TLA+ sources and does not invent a competing package', () => {
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-chain/formal/tla/ConsensusSafety.tla')), true);
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-chain/formal/tla/Quorum.tla')), true);
    assert.equal(existsSync(join(ROOT, 'packages/formal')), false);
    assert.equal(existsSync(join(ROOT, 'packages/tla')), false);
    assert.equal(existsSync(join(ROOT, 'packages/model-checker')), false);
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-formal')), false);
    assert.equal(existsSync(join(ROOT, 'tools/formal')), false);
  });
});
