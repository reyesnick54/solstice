import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { runSunreyRelease } from './supply-chain/cli.ts';
import {
  FEATURE_INVENTORY,
  assertNoAmbiguousFeatureState,
  compareReleaseCandidates,
  createReleaseCandidate,
  freezeCryptoPolicy,
  freezeProtocol,
  isReleaseCandidateId,
  limitationsHidden,
  loadKnownSecurityLimitations,
  nextReleaseCandidateId,
  protocolChangeRequiresNewRc,
  supersedeReleaseCandidate,
  testnetIdentityFreeze,
  verifyReleaseCandidate,
} from './release-candidate/index.ts';

const ROOT = join(import.meta.dirname, '../../..');

describe('Chunk 63 SunRey Testnet release candidate', () => {
  it('issues versioned RC ids without changing Testnet 1 network identity', () => {
    assert.equal(isReleaseCandidateId('SUNREY_TESTNET_RC_1'), true);
    assert.equal(nextReleaseCandidateId(null), 'SUNREY_TESTNET_RC_1');
    assert.equal(nextReleaseCandidateId('SUNREY_TESTNET_RC_1'), 'SUNREY_TESTNET_RC_2');
    const identity = testnetIdentityFreeze();
    assert.equal(identity.networkId, 'net_sunrey_testnet_1');
    assert.equal(identity.chainId, 'chn_sunrey_testnet_1');
    assert.equal(identity.genesisHash.length, 64);
  });

  it('freezes features, protocol, and crypto policy without ambiguous states', () => {
    assert.equal(assertNoAmbiguousFeatureState(), true);
    assert.ok(FEATURE_INVENTORY.every((row) => row.state === 'FROZEN_IN_RC' || row.state === 'EXCLUDED_FROM_RC' || row.state === 'EXPERIMENTAL_TESTNET_ONLY'));
    assert.equal(FEATURE_INVENTORY.some((row) => row.featureId === 'MAINNET' && row.state === 'EXCLUDED_FROM_RC'), true);
    const protocol = freezeProtocol(ROOT);
    assert.equal(protocol.protocolVersion, '1');
    assert.equal(protocolChangeRequiresNewRc(protocol, protocol), false);
    const crypto = freezeCryptoPolicy();
    assert.equal(crypto.productionCryptographicApproval, false);
    assert.equal(crypto.quantumProofClaim, false);
    assert.ok(crypto.classicalAlgorithms.includes('Ed25519'));
    assert.equal(crypto.pqProvider, '@noble/post-quantum');
  });

  it('creates, qualifies, verifies, and signs SUNREY_TESTNET_RC_1', () => {
    const created = createReleaseCandidate({ root: ROOT, profile: 'smoke', rcId: 'SUNREY_TESTNET_RC_1' });
    const manifest = created.bundle.manifest;
    assert.equal(manifest.rc_id, 'SUNREY_TESTNET_RC_1');
    assert.equal(manifest.testnet_network_id, 'net_sunrey_testnet_1');
    assert.equal(manifest.chain_id, 'chn_sunrey_testnet_1');
    assert.equal(manifest.api_version, 'v1');
    assert.equal(manifest.environment, 'simulation');
    assert.equal(manifest.ticker_status, 'NOT_ASSIGNED');
    assert.equal(manifest.mainnet_ready, false);
    assert.equal(manifest.production_financial_services, false);
    assert.ok(manifest.source_commit.length > 0);
    assert.equal(created.bundle.qualification.cells.every((row) => row.sourceCommit === manifest.source_commit), true);
    assert.equal(created.bundle.qualification.cells.length, 20);
    assert.equal(created.bundle.notes.banner, 'SUNREY TESTNET');
    assert.equal(created.bundle.notes.mainnetReady, false);
    assert.ok(created.bundle.notes.knownLimitations.length >= 8);
    assert.equal(limitationsHidden(created.bundle.notes.knownLimitations), false);
    assert.ok(created.evidence.sevenValidator.bftFinality);
    assert.ok(created.evidence.sevenValidator.stateRootAgreement);
    assert.ok(created.evidence.upgrade.newBinaryDidNotAutoActivate);
    assert.ok(created.evidence.snapshot.finalStateRootEqual);
    assert.equal(created.evidence.database.balancingEntriesCreated, false);
    assert.ok(created.evidence.pqc.ok);
    assert.ok(created.evidence.adversarial.ok);
    const verified = verifyReleaseCandidate(created.bundle, manifest.source_commit);
    assert.equal(verified.ok, true, JSON.stringify(verified.checks.filter((row) => !row.ok)));
    assert.ok(['QUALIFIED_FOR_TESTNET_RC', 'QUALIFIED_WITH_PENDING_EXTENDED_TEST'].includes(manifest.qualification_state));
  });

  it('supersedes a prior RC when source or freeze material changes', () => {
    const first = createReleaseCandidate({ root: ROOT, profile: 'smoke', rcId: 'SUNREY_TESTNET_RC_1', sourceCommit: 'commit-a' });
    const second = createReleaseCandidate({ root: ROOT, profile: 'smoke', rcId: 'SUNREY_TESTNET_RC_2', sourceCommit: 'commit-b' });
    const compared = compareReleaseCandidates(first.bundle, second.bundle);
    assert.equal(compared.materialChange, true);
    const pair = supersedeReleaseCandidate(first.bundle, second.bundle);
    assert.equal(pair.previous.manifest.qualification_state, 'SUPERSEDED');
    assert.equal(pair.previous.supersededBy, 'SUNREY_TESTNET_RC_2');
    assert.equal(pair.next.manifest.rc_id, 'SUNREY_TESTNET_RC_2');
    assert.equal(pair.previous.notes.knownLimitations.length, first.bundle.notes.knownLimitations.length);
  });

  it('runs sunrey-release rc commands and keeps TESTNET banners', () => {
    for (const command of ['rc', 'rc help']) {
      const argv = command.split(' ');
      const result = runSunreyRelease(ROOT, argv);
      assert.equal(result.ok, true, command);
    }
    const created = runSunreyRelease(ROOT, ['rc', 'create', '--profile', 'smoke', '--id', 'SUNREY_TESTNET_RC_1']);
    assert.equal(created.ok, true, JSON.stringify(created.payload));
    const status = runSunreyRelease(ROOT, ['rc', 'status']);
    assert.equal(status.ok, true);
    const payload = status.payload as { readonly banner: string; readonly mainnetReady: boolean };
    assert.equal(payload.banner, 'SUNREY TESTNET');
    assert.equal(payload.mainnetReady, false);
    const verified = runSunreyRelease(ROOT, ['rc', 'verify']);
    assert.equal(verified.ok, true);
    assert.equal(existsSync(join(ROOT, 'dist/testnet-rc/rc-manifest.json')), true);
    const limitations = loadKnownSecurityLimitations(ROOT);
    assert.ok(limitations.some((row) => row.id === 'NOT_MAINNET'));
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-rc')), false);
    assert.equal(existsSync(join(ROOT, 'packages/release-candidate')), false);
  });
});
