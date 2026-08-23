#!/usr/bin/env node
/**
 * Build real backend release-candidate artifacts.
 * Does not invent digests. Does not publish to a registry.
 * Does not flip production flags.
 */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const ARTIFACTS_REL = 'docs/productization/sunrey-backend-rc-artifacts.json';
export const RC_VERSION = 'sunrey-backend-v1.0.0-rc.2';
export const REHEARSAL_PLACEHOLDER_DIGEST =
  'sha256:6f1c2e8a9b0d4c7e5a3f1b8d2c0e4a6b8d1f3c5e7a9b0c2d4e6f8a0b1c3d5e7f';

const SOURCE_PATHS = [
  'package-lock.json',
  'package.json',
  'deploy/sunrey-preproduction/docker/sunrey-platform.Dockerfile',
  'deploy/sunrey-testnet/docker/sunrey-node.Dockerfile',
  'deploy/sunrey-testnet/docker/sunrey-rpc.Dockerfile',
  'deploy/sunrey-testnet/docker/sunrey-explorer.Dockerfile',
  'deploy/sunrey-testnet/docker/sunrey-relayer.Dockerfile',
  'deploy/sunrey-testnet/docker/sunrey-faucet.Dockerfile',
  'infra/sunrey-production/releases/preproduction-release.json',
  'packages/sunrey-chain/rust/Cargo.lock',
  'packages/sunrey-chain/node/Cargo.lock',
];

function sha256File(rel) {
  const path = join(ROOT, rel);
  if (!existsSync(path)) {
    return null;
  }
  return `sha256:${createHash('sha256').update(readFileSync(path)).digest('hex')}`;
}

function gitRev() {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : null;
}

function commandAvailable(name) {
  return spawnSync(name, ['--version'], { encoding: 'utf8' }).status === 0;
}

function dockerCmd() {
  if (commandAvailable('docker')) {
    const probe = spawnSync('docker', ['info'], { encoding: 'utf8' });
    if (probe.status === 0) {
      return ['docker'];
    }
  }
  const sudoProbe = spawnSync('sudo', ['-n', 'docker', 'info'], { encoding: 'utf8' });
  if (sudoProbe.status === 0) {
    return ['sudo', 'docker'];
  }
  return null;
}

function runRelease(command) {
  const result = spawnSync(
    process.execPath,
    [join(ROOT, 'scripts/sunrey-release.mjs'), command],
    { cwd: ROOT, encoding: 'utf8' },
  );
  if (result.status !== 0) {
    throw new Error(`sunrey-release ${command} failed: ${result.stderr || result.stdout}`);
  }
  return JSON.parse(result.stdout);
}

function buildContainer(requireContainer) {
  const docker = dockerCmd();
  if (!docker) {
    if (requireContainer) {
      throw new Error('docker daemon is required to produce a real OCI image digest');
    }
    return {
      built: false,
      publishedToRegistry: false,
      reason: 'docker daemon unavailable in this environment',
      dockerfile: 'deploy/sunrey-preproduction/docker/sunrey-platform.Dockerfile',
      imageRef: `sunrey.local/platform:${RC_VERSION}`,
    };
  }

  const imageRef = `sunrey.local/platform:${RC_VERSION}`;
  const sourceCommit = gitRev() ?? 'unknown';
  const build = spawnSync(
    docker[0],
    [
      ...docker.slice(1),
      'build',
      '--pull=false',
      '-f',
      'deploy/sunrey-preproduction/docker/sunrey-platform.Dockerfile',
      '--build-arg',
      `SOURCE_COMMIT=${sourceCommit}`,
      '-t',
      imageRef,
      '.',
    ],
    { cwd: ROOT, encoding: 'utf8' },
  );
  if (build.status !== 0) {
    throw new Error(`docker build failed: ${build.stderr || build.stdout}`);
  }

  const inspect = spawnSync(
    docker[0],
    [...docker.slice(1), 'inspect', '--format', '{{.Id}}', imageRef],
    { cwd: ROOT, encoding: 'utf8' },
  );
  if (inspect.status !== 0) {
    throw new Error(`docker inspect failed: ${inspect.stderr || inspect.stdout}`);
  }
  const imageId = inspect.stdout.trim();
  if (!/^sha256:[0-9a-f]{64}$/.test(imageId)) {
    throw new Error(`docker inspect did not return a sha256 image id: ${imageId}`);
  }
  if (imageId === REHEARSAL_PLACEHOLDER_DIGEST) {
    throw new Error('refusing to record the rehearsal placeholder as a real image digest');
  }

  const archivePath = join(tmpdir(), `sunrey-platform-${RC_VERSION}.tar`);
  const save = spawnSync(
    docker[0],
    [...docker.slice(1), 'save', '-o', archivePath, imageRef],
    { cwd: ROOT, encoding: 'utf8' },
  );
  if (save.status !== 0) {
    throw new Error(`docker save failed: ${save.stderr || save.stdout}`);
  }
  const hashed = spawnSync('sha256sum', [archivePath], { encoding: 'utf8' });
  if (hashed.status !== 0) {
    throw new Error(`sha256sum failed: ${hashed.stderr || hashed.stdout}`);
  }
  const archiveSha = `sha256:${hashed.stdout.trim().split(/\s+/)[0]}`;
  try {
    unlinkSync(archivePath);
  } catch {
    // best-effort cleanup of the local OCI export
  }

  return {
    built: true,
    publishedToRegistry: false,
    dockerfile: 'deploy/sunrey-preproduction/docker/sunrey-platform.Dockerfile',
    imageRef,
    imageId,
    savedArchiveSha256: archiveSha,
    sourceCommit,
    note: 'Local/CI OCI image. Not a published ghcr.io registry digest.',
  };
}

export function buildBackendRcArtifacts(options = {}) {
  const requireContainer = options.requireContainer === true;
  const sourceHashes = {};
  for (const rel of SOURCE_PATHS) {
    const digest = sha256File(rel);
    if (!digest) {
      throw new Error(`missing source path ${rel}`);
    }
    sourceHashes[rel] = digest;
  }

  const sbom = runRelease('sbom');
  const provenance = runRelease('provenance');
  const container = buildContainer(requireContainer);

  const record = {
    schemaVersion: 1,
    id: 'sunrey.backend.rc.artifacts.v1',
    rcVersion: RC_VERSION,
    kind: 'BACKEND_PRODUCTION_RELEASE_CANDIDATE_ARTIFACTS',
    notAProductionRelease: true,
    publishedToRegistry: false,
    generatedAtUtc: new Date().toISOString(),
    sourceCommit: gitRev(),
    sourceHashes,
    sbom: {
      generated: true,
      command: 'node scripts/sunrey-release.mjs sbom',
      count: sbom.payload?.count ?? null,
      digests: sbom.payload?.digests ?? [],
    },
    provenance: {
      generated: true,
      command: 'node scripts/sunrey-release.mjs provenance',
      digest: provenance.payload?.digest ?? null,
    },
    container,
    rehearsalPlaceholder: {
      digest: REHEARSAL_PLACEHOLDER_DIGEST,
      kind: 'SIMULATION_REHEARSAL_PLACEHOLDER',
      usedAsCompletedRcEvidence: false,
    },
  };

  const out = join(ROOT, ARTIFACTS_REL);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(record, null, 2)}\n`);
  return record;
}

function main() {
  const requireContainer = process.argv.includes('--require-container');
  const record = buildBackendRcArtifacts({ requireContainer });
  console.log(`[RC] wrote ${ARTIFACTS_REL}`);
  console.log(`[RC] sourceCommit ${record.sourceCommit}`);
  if (record.container.built) {
    console.log(`[RC] container imageId ${record.container.imageId}`);
    console.log(`[RC] container archive ${record.container.savedArchiveSha256}`);
  } else {
    console.log(`[RC] container not built: ${record.container.reason}`);
  }
  console.log(`[RC] sbom digests ${record.sbom.digests.length}`);
  console.log(`[RC] publishedToRegistry=false`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
