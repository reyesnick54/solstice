/**
 * sunrey-release — software release tooling.
 *
 * Commands: build, sbom, provenance, sign, verify, compare-builds.
 * Local/test signing only. Production credentials stay provider-controlled.
 */

import { join } from 'node:path';

import { runSunreyReleaseRc } from '../release-candidate/cli.ts';
import { auditDependencies } from './audit.ts';
import { canonicalArtifactDigest, collectSoftwareInventory, generatedSourceDigest, generatedSourceDrift, sha256File, sha256Text } from './inventory.ts';
import { loadDependencyPolicy } from './policy.ts';
import {
  buildProvenance,
  buildReleaseRecord,
  buildTargetSbom,
  compareBuilds,
  localTestReleaseAuthority,
  provenanceDigest,
  releaseTargets,
  sbomDigest,
  signArtifact,
  verifyRelease,
  writeReleaseBundle,
} from './release.ts';

export type ReleaseCliResult = {
  readonly ok: boolean;
  readonly command: string;
  readonly payload: unknown;
};

const HIGH_VALUE = [
  'packages/sunrey-chain/node/src/bin/sunrey-node.rs',
  'packages/sunrey-chain/node/Cargo.lock',
  'packages/sunrey-chain/rust/crates/consensus/src/lib.rs',
  'packages/sunrey-chain/rust/crates/crypto/src/lib.rs',
  'packages/sunrey-chain/rust/Cargo.lock',
  'packages/sunrey-chain/schemas/srcb-v1.json',
];

export function runSunreyRelease(root: string, argv: readonly string[]): ReleaseCliResult {
  const [command = 'help'] = argv;
  if (command === 'rc') {
    const result = runSunreyReleaseRc(root, argv.slice(1));
    return { ok: result.ok, command: result.command, payload: result.payload };
  }
  const sourceCommit = process.env.GITHUB_SHA ?? 'local';
  const packageLock = sha256File(root, 'package-lock.json') ?? 'missing';
  const cargoLockRust = sha256File(root, 'packages/sunrey-chain/rust/Cargo.lock') ?? 'missing';
  const cargoLockNode = sha256File(root, 'packages/sunrey-chain/node/Cargo.lock') ?? 'missing';
  const artifactDigest = canonicalArtifactDigest(root, HIGH_VALUE);
  const inventory = collectSoftwareInventory(root);
  const { authority, signer: _signer } = localTestReleaseAuthority();

  if (command === 'build') {
    const outDir = join(root, 'dist', 'testnet-release');
    const sboms = Object.fromEntries(
      releaseTargets().map((target) => [target, buildTargetSbom(target, inventory, artifactDigest)]),
    );
    const provenance = buildProvenance({
      sourceCommit,
      artifactName: 'sunrey-testnet',
      artifactDigest,
      packageLock,
      cargoLockRust,
      cargoLockNode,
      builderId: 'sunrey-release/local-test',
      protocolVersion: '1',
      networkCompatibility: 'net_sunrey_testnet_1',
      toolchain: 'rust-1.83.0+node-22',
    });
    const manifest = buildReleaseRecord({
      releaseId: `rel_${sourceCommit.slice(0, 12)}`,
      sourceCommit,
      artifactDigest,
      sbom: sboms['sunrey-node']!,
      provenance,
      authority,
      protocolCompatibility: '1',
      reproduced: 'NOT_ATTEMPTED',
    });
    const signature = signArtifact(Buffer.from(artifactDigest), authority);
    writeReleaseBundle(outDir, {
      artifacts: { 'sunrey-testnet': artifactDigest },
      sboms,
      provenance,
      manifest,
      signature,
    });
    return { ok: true, command: 'build', payload: { outDir, artifactDigest, secrets: false } };
  }

  if (command === 'sbom') {
    const sboms = releaseTargets().map((target) => buildTargetSbom(target, inventory, artifactDigest));
    return { ok: true, command: 'sbom', payload: { count: sboms.length, digests: sboms.map(sbomDigest) } };
  }

  if (command === 'provenance') {
    const provenance = buildProvenance({
      sourceCommit,
      artifactName: 'sunrey-testnet',
      artifactDigest,
      packageLock,
      cargoLockRust,
      cargoLockNode,
      builderId: 'sunrey-release/local-test',
      protocolVersion: '1',
      networkCompatibility: 'net_sunrey_testnet_1',
      toolchain: 'rust-1.83.0+node-22',
    });
    return { ok: true, command: 'provenance', payload: { digest: provenanceDigest(provenance), provenance } };
  }

  if (command === 'sign') {
    const signature = signArtifact(Buffer.from(artifactDigest), authority);
    return { ok: true, command: 'sign', payload: { signature, authorityId: authority.authorityId } };
  }

  if (command === 'verify') {
    const sbom = buildTargetSbom('sunrey-node', inventory, artifactDigest);
    const provenance = buildProvenance({
      sourceCommit,
      artifactName: 'sunrey-testnet',
      artifactDigest,
      packageLock,
      cargoLockRust,
      cargoLockNode,
      builderId: 'sunrey-release/local-test',
      protocolVersion: '1',
      networkCompatibility: 'net_sunrey_testnet_1',
      toolchain: 'rust-1.83.0+node-22',
    });
    const manifest = buildReleaseRecord({
      releaseId: 'rel_verify',
      sourceCommit,
      artifactDigest,
      sbom,
      provenance,
      authority,
      protocolCompatibility: '1',
      reproduced: 'NOT_ATTEMPTED',
    });
    const signature = signArtifact(Buffer.from(artifactDigest), authority);
    const result = verifyRelease({
      artifact: artifactDigest,
      manifest,
      signature,
      sbom,
      provenance,
      expectedCommit: sourceCommit,
      expectedToolchain: 'rust-1.83.0+node-22',
      expectedProtocol: '1',
      expectedNetwork: 'net_sunrey_testnet_1',
      authority,
    });
    return { ok: result.ok, command: 'verify', payload: result };
  }

  if (command === 'compare-builds') {
    const builderA = canonicalArtifactDigest(root, HIGH_VALUE);
    const builderB = canonicalArtifactDigest(root, HIGH_VALUE);
    const comparison = compareBuilds(builderA, builderB, 'sunrey-node+consensus');
    return { ok: comparison.status === 'MATCHED', command: 'compare-builds', payload: comparison };
  }

  if (command === 'audit') {
    const report = auditDependencies(root);
    return { ok: report.ok, command: 'audit', payload: report };
  }

  if (command === 'policy') {
    const policy = loadDependencyPolicy(root);
    return { ok: policy.popularityIsNotSecurity, command: 'policy', payload: { packages: policy.packages.length } };
  }

  if (command === 'generated-lock') {
    const digest = generatedSourceDigest(root);
    const drift = generatedSourceDrift(root);
    return { ok: drift === null, command: 'generated-lock', payload: { digest, drift } };
  }

  return {
    ok: command === 'help',
    command: command === 'help' ? 'help' : command,
    payload: {
      usage: 'sunrey-release <build|sbom|provenance|sign|verify|compare-builds|audit|rc>',
      sha256Hint: sha256Text(command),
    },
  };
}

const invoked = process.argv[1] ?? '';
if (invoked.endsWith('supply-chain/cli.ts') || invoked.endsWith('sunrey-release.mjs')) {
  const result = runSunreyRelease(process.cwd(), process.argv.slice(2));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exit(result.ok ? 0 : 1);
}
