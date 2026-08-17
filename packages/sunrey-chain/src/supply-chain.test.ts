import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  authorizeDevelopmentUpgrade,
  developmentUpgradeFixture,
} from './ops/upgrade.ts';
import {
  auditDependencies,
  auditMaliciousFixtures,
  classifyEcosystemAdvisoryJson,
  buildProvenance,
  buildReleaseRecord,
  buildTargetSbom,
  canonicalArtifactDigest,
  collectSoftwareInventory,
  compareBuilds,
  criticalDependencies,
  generatedSourceDigest,
  generatedSourceDrift,
  inventoryUnsafeRust,
  licenseInventory,
  loadDependencyPolicy,
  localTestReleaseAuthority,
  operatorUpgradePrecheck,
  randomBinarySameVersionFails,
  revokeRelease,
  runSunreyRelease,
  signArtifact,
  softwareReleaseActivatesProtocol,
  upgradePlanReferencesApprovedRelease,
  verifyRelease,
  versionStringIsNotIdentity,
} from './supply-chain/index.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');

describe('Chunk 59 SunRey software supply chain', () => {
  it('loads DependencyPolicy without treating popularity as security', () => {
    const policy = loadDependencyPolicy(ROOT);
    assert.equal(policy.popularityIsNotSecurity, true);
    assert.equal(policy.notLegalAdvice, true);
    assert.equal(policy.packages.some((row) => row.classification === 'BLOCKED'), true);
    assert.equal(policy.packages.some((row) => row.classification === 'TEMPORARY_EXCEPTION'), true);
  });

  it('inventories lockfiles, toolchains, actions, and critical dependencies', () => {
    const inventory = collectSoftwareInventory(ROOT);
    assert.ok(inventory.length > 0);
    assert.equal(inventory.some((row) => row.name === 'ed25519-dalek'), true);
    assert.equal(inventory.some((row) => row.ecosystem === 'github-actions'), true);
    const critical = criticalDependencies(inventory);
    assert.ok(critical.length >= 3);
    const licenses = licenseInventory(inventory);
    assert.equal(licenses.every((row) => row.legalConclusion === null), true);
  });

  it('catches unregistered crypto, unlocked change, and blocked packages', () => {
    const report = auditMaliciousFixtures({
      root: ROOT,
      packages: [
        { name: 'evil-homegrown-crypto', ecosystem: 'npm', primitives: ['signature'] },
        { name: 'blocked-demo-package', ecosystem: 'npm' },
        { name: 'typescript', ecosystem: 'npm', lockfilePresent: false },
      ],
    });
    assert.equal(report.ok, false);
    assert.ok(report.counts.unregistered_crypto >= 1);
    assert.ok(report.counts.blocked_package >= 1);
    assert.ok(report.counts.unlocked_dependency >= 1);
  });

  it('signs, verifies, and fails tamper and SBOM mismatch', () => {
    const { authority } = localTestReleaseAuthority();
    const artifact = 'sunrey-node-bytes';
    const digest = canonicalArtifactDigest(ROOT, ['packages/sunrey-chain/schemas/srcb-v1.json']);
    const sbom = buildTargetSbom('sunrey-node', collectSoftwareInventory(ROOT).slice(0, 4), digest);
    const provenance = buildProvenance({
      sourceCommit: 'abc123',
      artifactName: 'sunrey-node',
      artifactDigest: createHash('sha256').update(artifact).digest('hex'),
      packageLock: 'aa',
      cargoLockRust: 'bb',
      cargoLockNode: 'cc',
      builderId: 'builder-a',
      protocolVersion: '1',
      networkCompatibility: 'net_sunrey_testnet_1',
      toolchain: 'rust-1.83.0+node-22',
    });
    const artifactDigest = createHash('sha256').update(artifact).digest('hex');
    const manifest = buildReleaseRecord({
      releaseId: 'rel_test',
      sourceCommit: 'abc123',
      artifactDigest,
      sbom,
      provenance,
      authority,
      protocolCompatibility: '1',
      reproduced: 'MATCHED',
    });
    const signature = signArtifact(Buffer.from(artifact), authority);
    const ok = verifyRelease({
      artifact,
      manifest,
      signature,
      sbom,
      provenance,
      expectedCommit: 'abc123',
      expectedToolchain: 'rust-1.83.0+node-22',
      expectedProtocol: '1',
      expectedNetwork: 'net_sunrey_testnet_1',
      authority,
    });
    assert.equal(ok.ok, true);

    const tampered = verifyRelease({
      artifact: 'sunrey-node-bytes-TAMPERED',
      manifest,
      signature,
      sbom,
      provenance,
      expectedCommit: 'abc123',
      expectedToolchain: 'rust-1.83.0+node-22',
      expectedProtocol: '1',
      expectedNetwork: 'net_sunrey_testnet_1',
      authority,
    });
    assert.equal(tampered.ok, false);

    const wrongSbom = buildTargetSbom('sunrey-rpc', [], 'deadbeef');
    const mismatch = verifyRelease({
      artifact,
      manifest,
      signature,
      sbom: wrongSbom,
      provenance,
      expectedCommit: 'abc123',
      expectedToolchain: 'rust-1.83.0+node-22',
      expectedProtocol: '1',
      expectedNetwork: 'net_sunrey_testnet_1',
      authority,
    });
    assert.equal(mismatch.ok, false);
  });

  it('compares two builders and does not claim reproducibility on mismatch', () => {
    const matched = compareBuilds('aaa', 'aaa', 'sunrey-node');
    assert.equal(matched.status, 'MATCHED');
    const different = compareBuilds('aaa', 'bbb', 'consensus');
    assert.equal(different.status, 'NOT_REPRODUCED');
    assert.equal(different.differences.length, 1);
  });

  it('runs sunrey-release commands and writes a secret-free bundle', () => {
    for (const command of ['build', 'sbom', 'provenance', 'sign', 'verify', 'compare-builds', 'audit']) {
      const result = runSunreyRelease(ROOT, [command]);
      assert.equal(result.ok, true, command);
    }
    const bundle = join(ROOT, 'dist', 'testnet-release', 'release-manifest.json');
    assert.equal(existsSync(bundle), true);
    const text = readFileSync(bundle, 'utf8');
    assert.equal(text.includes('BEGIN PRIVATE KEY'), false);
    assert.equal(text.includes('AKIA'), false);
  });

  it('keeps ReleaseAuthority off the blockchain and rejects version-only binaries', () => {
    const { authority } = localTestReleaseAuthority();
    assert.equal(authority.mayChangeBlockchainState, false);
    assert.equal(authority.notAppAuthorityGrant, true);
    const fixture = developmentUpgradeFixture(20);
    authorizeDevelopmentUpgrade(fixture.manager, fixture.plan);
    const digest = fixture.plan.releaseArtifactHash;
    const record = buildReleaseRecord({
      releaseId: 'rel_gov',
      sourceCommit: 'dev',
      artifactDigest: digest,
      sbom: buildTargetSbom('sunrey-node', [], digest),
      provenance: buildProvenance({
        sourceCommit: 'dev',
        artifactName: 'sunrey-node',
        artifactDigest: digest,
        packageLock: 'a',
        cargoLockRust: 'b',
        cargoLockNode: 'c',
        builderId: 'builder-a',
        protocolVersion: '2',
        networkCompatibility: 'net_sunrey_testnet_1',
        toolchain: 'rust-1.83.0+node-22',
      }),
      authority,
      protocolCompatibility: '2',
      reproduced: 'MATCHED',
    });
    assert.equal(softwareReleaseActivatesProtocol(record), false);
    assert.equal(upgradePlanReferencesApprovedRelease(fixture.plan, record), true);
    assert.equal(randomBinarySameVersionFails(fixture.plan, 'ff'.repeat(32)), true);
    assert.equal(versionStringIsNotIdentity('0.1.0', 'ff'.repeat(32), digest), true);
    const ready = operatorUpgradePrecheck({
      manager: fixture.manager,
      node: fixture.compatible,
      diskFreeBytes: 8_000,
      diskRequiredBytes: 1_000,
      snapshotAvailable: true,
      signerSuiteIds: fixture.compatible.suiteIds,
      installedArtifactHash: digest,
      claimedVersion: '0.1.0',
      release: record,
    });
    assert.equal(ready.artifactIdentityOk, true);
    const revoked = revokeRelease([record], record.releaseId, 'REVOKED')[0]!;
    const warned = operatorUpgradePrecheck({
      manager: fixture.manager,
      node: fixture.compatible,
      diskFreeBytes: 8_000,
      diskRequiredBytes: 1_000,
      snapshotAvailable: true,
      signerSuiteIds: fixture.compatible.suiteIds,
      installedArtifactHash: digest,
      claimedVersion: '0.1.0',
      release: revoked,
    });
    assert.equal(warned.releaseWarning?.includes('REVOKED'), true);
  });

  it('inventories unsafe Rust and generated-source lock', () => {
    const unsafe = inventoryUnsafeRust(ROOT);
    assert.ok(unsafe.some((row) => row.crate === 'sunrey-consensus' && row.forbidUnsafe));
    const digest = generatedSourceDigest(ROOT);
    assert.equal(digest.length, 64);
    assert.equal(generatedSourceDrift(ROOT), null);
    const repoAudit = auditDependencies(ROOT);
    assert.equal(typeof repoAudit.ok, 'boolean');
    assert.equal(classifyEcosystemAdvisoryJson('npm', { name: 'demo-advisory', severity: 'high' }).severity, 'fail');
    assert.equal(classifyEcosystemAdvisoryJson('cargo', { name: 'old-crate', severity: 'low', unmaintained: true }).kind, 'unmaintained_warning');
    assert.equal(classifyEcosystemAdvisoryJson('container', { name: 'base', severity: 'low', yanked: true }).kind, 'yanked_dependency');
  });

  it('ships required documentation and policy files', () => {
    const docs = [
      'docs/security/chunk-59-supply-chain.md',
      'docs/security/dependency-policy.md',
      'docs/security/reproducible-builds.md',
      'docs/security/release-signing.md',
      'docs/security/release-verification.md',
      'docs/security/software-bill-of-materials.md',
      'docs/runbooks/software-supply-chain-incident.md',
      'docs/architecture/chunk-59-supply-chain.md',
      'packages/sunrey-chain/supply-chain/dependency-policy.json',
      'packages/sunrey-chain/supply-chain/crypto-inventory.json',
      '.github/workflows/sunrey-release.yml',
    ];
    for (const rel of docs) {
      assert.equal(existsSync(join(ROOT, rel)), true, rel);
    }
  });
});
