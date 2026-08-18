import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { ENVIRONMENT, LIVE_EXCHANGE_ENABLED, LIVE_MONEY_ENABLED } from '../packages/config/src/flags.ts';
import { createProductionNetworkCandidateV2, verifyProductionNetworkCandidateV2 } from '../packages/sunrey-chain/src/mainnet/candidate-v2/index.ts';
import { CANDIDATE_V2_ID } from '../packages/sunrey-chain/src/mainnet/candidate-v2/identity.ts';
import { runProductionGenesisCeremonyDressRehearsal } from '../packages/sunrey-chain/src/production-ceremony/index.ts';
import { EXPECTED_CANDIDATE_V2_ID, EXPECTED_MAINNET_RC_ID } from '../packages/sunrey-chain/src/production-ceremony/identity.ts';
import { createMainnetReleaseCandidate, FIRST_MAINNET_RC_ID, verifyMainnetReleaseCandidate } from '../packages/sunrey-chain/src/release-candidate/mainnet/index.ts';
import { runOpsCommand } from '../packages/sunrey-chain/src/ops/cli.ts';
import {
  compareDeploymentDrift,
  createProductionEnvironmentPlan,
  descriptorFromPlan,
  FORBIDDEN_PRODUCTION_NETWORK_IDS,
  gateProvidersForTarget,
  rejectFloatingImage,
  rejectPublicSignerExposure,
  rejectTestNetworkForProduction,
  rejectWrongCandidateV2,
  rejectWrongMainnetRc,
  runLocalProvisioningHarness,
  runProductionProvisioningCommand,
  simulateProvisioningFailure,
  verifyProductionEnvironmentPlan,
} from '../packages/sunrey-chain/src/infra/provisioning/index.ts';
import { consumeProviderAcceptance } from '../packages/sunrey-chain/src/production-ceremony/bindings.ts';
import { SUNREY_TESTNET_1_NETWORK_ID } from '../packages/sunrey-chain/src/testnet/identity.ts';

const ROOT = join(import.meta.dirname, '..');

describe('Chunk 86 production environment provisioning', () => {
  it('creates a deterministic local plan bound to actual Candidate V2 and Mainnet RC', () => {
    const first = createProductionEnvironmentPlan({ root: ROOT, environmentClass: 'LOCAL' });
    const second = createProductionEnvironmentPlan({ root: ROOT, environmentClass: 'LOCAL' });
    assert.equal(first.planHash, second.planHash);
    assert.equal(first.candidateV2Id, CANDIDATE_V2_ID);
    assert.equal(first.mainnetRcId, FIRST_MAINNET_RC_ID);
    assert.equal(first.productionAuthorized, false);
    assert.equal(first.mainnetEnabled, false);
    assert.equal(first.genesisExecuted, false);
    assert.equal(first.customerCapabilitiesActivated, false);
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_EXCHANGE_ENABLED, false);
    assert.equal(LIVE_MONEY_ENABLED, false);
    const verified = verifyProductionEnvironmentPlan(first, ROOT);
    assert.equal(verified.ok, true, JSON.stringify(verified.checks.filter((row) => !row.ok)));
  });

  it('re-runs Candidate V2, Mainnet RC, and ceremony dress rehearsal against canonical interfaces', () => {
    const candidate = createProductionNetworkCandidateV2(ROOT);
    const candidateReport = verifyProductionNetworkCandidateV2(candidate, ROOT);
    assert.equal(candidateReport.ok, true);
    assert.equal(candidate.candidateId, EXPECTED_CANDIDATE_V2_ID);
    const created = createMainnetReleaseCandidate({ root: ROOT, profile: 'smoke', rcId: FIRST_MAINNET_RC_ID });
    const rcReport = verifyMainnetReleaseCandidate(created.bundle, created.bundle.manifest.source_commit, ROOT);
    assert.equal(rcReport.ok, true, JSON.stringify(rcReport.checks.filter((row) => !row.ok)));
    assert.equal(created.bundle.manifest.candidate_v2_id, CANDIDATE_V2_ID);
    assert.equal(created.bundle.candidateV2.rootHash, candidate.candidateRootHash);
    const rehearsal = runProductionGenesisCeremonyDressRehearsal(ROOT);
    assert.equal(rehearsal.session.plan.candidateV2Id, EXPECTED_CANDIDATE_V2_ID);
    assert.equal(rehearsal.session.plan.mainnetRcId, EXPECTED_MAINNET_RC_ID);
    assert.equal(rehearsal.usableForProduction, false);
    assert.equal(rehearsal.mainnetEnabled, false);
  });

  it('rejects fixture providers, AI authorization, wrong artifacts, and secret leakage', () => {
    const plan = createProductionEnvironmentPlan({ root: ROOT, environmentClass: 'LOCAL' });
    const provider = consumeProviderAcceptance(ROOT);
    assert.throws(
      () => gateProvidersForTarget('PRODUCTION', provider, { authorized: true, actorKind: 'AI', humanRoles: [], evidenceDigest: null, aiGeneratedPlanningAlone: true }),
      /fixture provider|AI deployment/,
    );
    assert.throws(
      () =>
        gateProvidersForTarget('PRODUCTION', provider, {
          authorized: true,
          actorKind: 'HUMAN',
          humanRoles: ['OPERATIONS_AUTHORITY'],
          evidenceDigest: 'aa'.repeat(32),
          aiGeneratedPlanningAlone: false,
        }),
      /fixture provider cannot qualify production/,
    );
    assert.throws(() => rejectWrongCandidateV2(plan, '00'.repeat(32)), /wrong Candidate V2/);
    assert.throws(() => rejectWrongMainnetRc(plan, '11'.repeat(32)), /wrong RC/);
    assert.throws(() => rejectFloatingImage('sunrey-node:latest'), /floating image/);
    assert.throws(() => rejectPublicSignerExposure('PUBLIC_EDGE'), /public signer/);
    assert.throws(() => rejectTestNetworkForProduction(SUNREY_TESTNET_1_NETWORK_ID, 'PRODUCTION'), /test network ID/);
    assert.ok((FORBIDDEN_PRODUCTION_NETWORK_IDS as readonly string[]).includes(SUNREY_TESTNET_1_NETWORK_ID));
    const serialized = JSON.stringify(plan);
    assert.equal(/BEGIN [A-Z ]+PRIVATE KEY/.test(serialized), false);
    assert.equal(/password=|secret=/.test(serialized), false);
    assert.ok(plan.secretReferences.every((href) => href.startsWith('secret://')));
    assert.ok(plan.validators.every((row) => row.privateSigningMaterialEmbedded === false));
  });

  it('classifies configuration drift and rehearses the same plan graph locally', () => {
    const plan = createProductionEnvironmentPlan({ root: ROOT, environmentClass: 'MAINNET_REHEARSAL' });
    const match = compareDeploymentDrift(plan, descriptorFromPlan(plan));
    assert.equal(match.classification, 'MATCH');
    const drifted = compareDeploymentDrift(plan, {
      ...descriptorFromPlan(plan),
      networkId: 'net_sunrey_wrong',
    });
    assert.equal(drifted.classification, 'UNAUTHORIZED_DRIFT');
    const unavailable = compareDeploymentDrift(plan, null);
    assert.equal(unavailable.classification, 'OBSERVATION_UNAVAILABLE');
    const harness = runLocalProvisioningHarness('LOCAL', ROOT);
    assert.equal(harness.mutated, false);
    assert.equal(harness.productionAuthorized, false);
    assert.equal(harness.mainnetEnabled, false);
    assert.equal(harness.plan.planHash, createProductionEnvironmentPlan({ root: ROOT, environmentClass: 'LOCAL' }).planHash);
    for (const kind of [
      'provider-unavailable',
      'object-storage-unavailable',
      'database-unavailable',
      'wrong-artifact',
      'wrong-network',
      'wrong-chain',
      'wrong-zone',
      'missing-signer',
      'unaccepted-hsm',
      'expired-evidence',
      'network-policy',
    ] as const) {
      const failure = simulateProvisioningFailure(kind);
      assert.equal(failure.ok, false);
      assert.equal(failure.mutated, false);
    }
  });

  it('exposes sunrey-ops production commands without mutating infrastructure', () => {
    for (const command of ['plan', 'verify-plan', 'topology', 'services', 'providers', 'drift', 'rehearse']) {
      const result = runProductionProvisioningCommand([command], ROOT);
      assert.equal(result.ok, true, command);
    }
    const ops = runOpsCommand(['production', 'rehearse']);
    assert.equal(ops.ok, true);
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-production-platform')), false);
    assert.equal(existsSync(join(ROOT, 'packages/mainnet-infrastructure-v2')), false);
    assert.equal(existsSync(join(ROOT, 'packages/cloud-control-plane')), false);
  });
});
