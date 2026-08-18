import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { runSunreyRelease } from './supply-chain/cli.ts';
import {
  ECONOMIC_QUALIFICATION_CATEGORIES,
  FIRST_ECONOMIC_RC_ID,
  compareEconomicReleaseCandidates,
  consumeEconomicRc,
  createEconomicReleaseCandidate,
  economicLimitationsHidden,
  freezeEconomicPolicies,
  freezeEconomicSchemas,
  invalidateEconomicBundle,
  isEconomicReleaseCandidateId,
  loadEconomicKnownLimitations,
  nextEconomicReleaseCandidateId,
  supersedeEconomicReleaseCandidate,
  unconfiguredProductionValues,
  verifyEconomicReleaseCandidate,
} from './release-candidate/index.ts';

const ROOT = join(import.meta.dirname, '../../..');

describe('Chunk 78 SunRey economic release candidate', () => {
  it('issues versioned economic RC ids without authorizing mainnet', () => {
    assert.equal(isEconomicReleaseCandidateId(FIRST_ECONOMIC_RC_ID), true);
    assert.equal(nextEconomicReleaseCandidateId(null), FIRST_ECONOMIC_RC_ID);
    assert.equal(nextEconomicReleaseCandidateId(FIRST_ECONOMIC_RC_ID), 'SUNREY_ECONOMIC_TESTNET_RC_2');
    const policy = freezeEconomicPolicies(ROOT);
    const schema = freezeEconomicSchemas(ROOT);
    assert.equal(policy.unconfiguredProductionValues.every((row) => row.value === 'UNCONFIGURED'), true);
    assert.equal(schema.breakingChangeRequiresNewRc, true);
    assert.equal(unconfiguredProductionValues().some((row) => row.id === 'treasury.productionBudget'), true);
  });

  it('creates, qualifies, verifies, and signs SUNREY_ECONOMIC_TESTNET_RC_1', () => {
    const created = createEconomicReleaseCandidate({
      root: ROOT,
      profile: 'smoke',
      rcId: FIRST_ECONOMIC_RC_ID,
    });
    const manifest = created.bundle.manifest;
    assert.equal(manifest.economic_rc_id, FIRST_ECONOMIC_RC_ID);
    assert.equal(manifest.network_id, 'net_sunrey_testnet_1');
    assert.equal(manifest.chain_id, 'chn_sunrey_testnet_1');
    assert.equal(manifest.api_version, 'v1');
    assert.equal(manifest.environment, 'simulation');
    assert.equal(manifest.ticker_status, 'NOT_ASSIGNED');
    assert.equal(manifest.mainnet_ready, false);
    assert.equal(manifest.signing_activates_policy, false);
    assert.equal(created.bundle.qualification.cells.length, ECONOMIC_QUALIFICATION_CATEGORIES.length);
    assert.equal(created.bundle.qualification.notRegulatoryApproval, true);
    assert.equal(created.bundle.qualification.cells.every((row) => row.sourceCommit === manifest.source_commit), true);
    assert.equal(economicLimitationsHidden(created.bundle.limitations), false);
    assert.ok(created.bundle.limitations.some((row) => row.id === 'PRODUCTION_PARAMETERS_UNCONFIGURED'));
    assert.equal(created.evidence.stress.hiddenFailures, false);
    assert.equal(created.evidence.extended.claimedDurationCompleted, false);
    assert.equal(created.evidence.performance.claimedExtendedDuration, false);
    assert.ok(created.evidence.supply.ok);
    assert.ok(created.evidence.recovery.invariantsIdentical);
    const verified = verifyEconomicReleaseCandidate(created.bundle, manifest.source_commit, ROOT);
    assert.equal(verified.ok, true, JSON.stringify(verified.checks.filter((row) => !row.ok)));
    assert.ok([
      'QUALIFIED_FOR_ECONOMIC_TESTNET_RC',
      'QUALIFIED_WITH_PENDING_EXTENDED_TEST',
      'QUALIFICATION_IN_PROGRESS',
    ].includes(manifest.qualification_result));
    assert.equal(created.report.mainnetReady, false);
    assert.equal(created.report.regulatoryApproval, false);
  });

  it('invalidates the bundle when frozen policy, schema, evidence, or qualification changes', () => {
    const created = createEconomicReleaseCandidate({
      root: ROOT,
      profile: 'smoke',
      rcId: FIRST_ECONOMIC_RC_ID,
      sourceCommit: 'commit-a',
    });
    const intact = verifyEconomicReleaseCandidate(created.bundle, 'commit-a', ROOT);
    assert.equal(intact.ok, true, JSON.stringify(intact.checks.filter((row) => !row.ok)));
    for (const field of ['policy', 'schema', 'artifact', 'evidence', 'qualification'] as const) {
      const tampered = invalidateEconomicBundle(created.bundle, field);
      const report = verifyEconomicReleaseCandidate(tampered, 'commit-a', ROOT);
      if (field === 'policy' || field === 'schema' || field === 'artifact' || field === 'qualification' || field === 'evidence') {
        assert.equal(report.ok, false, `tamper ${field} should fail verify`);
      }
    }
  });

  it('supersedes a prior economic RC when source or freeze material changes', () => {
    const first = createEconomicReleaseCandidate({
      root: ROOT,
      profile: 'smoke',
      rcId: FIRST_ECONOMIC_RC_ID,
      sourceCommit: 'commit-a',
    });
    const second = createEconomicReleaseCandidate({
      root: ROOT,
      profile: 'smoke',
      rcId: 'SUNREY_ECONOMIC_TESTNET_RC_2',
      sourceCommit: 'commit-b',
    });
    const compared = compareEconomicReleaseCandidates(first.bundle, second.bundle);
    assert.equal(compared.materialChange, true);
    const pair = supersedeEconomicReleaseCandidate(first.bundle, second.bundle);
    assert.equal(pair.previous.manifest.qualification_result, 'SUPERSEDED');
    assert.equal(pair.previous.supersededBy, 'SUNREY_ECONOMIC_TESTNET_RC_2');
    assert.equal(pair.next.manifest.economic_rc_id, 'SUNREY_ECONOMIC_TESTNET_RC_2');
  });

  it('runs sunrey-release economic commands and keeps TESTNET banners', () => {
    const help = runSunreyRelease(ROOT, ['economic', 'help']);
    assert.equal(help.ok, true);
    const created = runSunreyRelease(ROOT, ['economic', 'create', '--profile', 'smoke', '--id', FIRST_ECONOMIC_RC_ID]);
    assert.equal(created.ok, true, JSON.stringify(created.payload));
    const status = runSunreyRelease(ROOT, ['economic', 'status']);
    assert.equal(status.ok, true);
    const payload = status.payload as { readonly banner: string; readonly mainnetReady: boolean };
    assert.equal(payload.banner, 'SUNREY ECONOMIC TESTNET RC');
    assert.equal(payload.mainnetReady, false);
    const verified = runSunreyRelease(ROOT, ['economic', 'verify']);
    assert.equal(verified.ok, true, JSON.stringify(verified.payload));
    assert.equal(existsSync(join(ROOT, 'dist/economic-rc/economic-rc-manifest.json')), true);
    const limitations = loadEconomicKnownLimitations(ROOT);
    assert.ok(limitations.some((row) => row.id === 'NOT_MAINNET'));
    const readiness = consumeEconomicRc();
    assert.equal(readiness.mainnetAuthorized, false);
    assert.equal(readiness.engineeringStatus, 'ENGINEERING_VERIFIED');
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-economic-rc')), false);
    assert.equal(existsSync(join(ROOT, 'packages/economic-rc')), false);
    assert.equal(existsSync(join(ROOT, 'packages/economic-qualification')), false);
  });
});
