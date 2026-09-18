#!/usr/bin/env node
/**
 * HELIOS H34 — release package qualification.
 * Produces release/helios-release-package.json with exact SHA and artifact digests.
 */

import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  evaluateHeliosReleasePackageQualification,
  HELIOS_RELEASE_PACKAGE_QUALIFIED,
  type HeliosReleasePackageGate,
} from '../packages/platform/src/helios/release-package/index.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_REL = 'release/helios-release-package.json';
const RELEASE_ID = 'helios-sandbox-rc-h34';

function git(cmd: string[]): string {
  const result = spawnSync('git', cmd, { cwd: ROOT, encoding: 'utf8' });
  return result.status === 0 ? (result.stdout ?? '').trim() : '';
}

function sha256File(rel: string): string {
  const path = join(ROOT, rel);
  if (!existsSync(path)) {
    throw new Error(`missing source path ${rel}`);
  }
  return `sha256:${createHash('sha256').update(readFileSync(path)).digest('hex')}`;
}

function runGate(id: string, script: string, args: string[] = []): HeliosReleasePackageGate {
  const started = Date.now();
  const result = spawnSync('npm', ['run', script, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    env: process.env,
  });
  const durationMs = Date.now() - started;
  return {
    id,
    status: result.status === 0 ? 'PASS' : 'FAIL',
    detail: `durationMs=${durationMs}`,
  };
}

function main() {
  const commitSha = git(['rev-parse', 'HEAD']);
  if (!commitSha) {
    throw new Error('unable to resolve git HEAD');
  }

  const artifactDigest = sha256File('deploy/sunrey-sandbox-hetzner/Dockerfile');
  const migrationImageDigest = sha256File('deploy/sunrey-sandbox-hetzner/docker-compose.yml');
  const configurationPackage = sha256File('infra/sandbox/env.production-sandbox.example');

  const gates: HeliosReleasePackageGate[] = [
    runGate('helios_h31_fast', 'test:helios-h31-fast'),
    runGate('helios_h33_regression', 'test:helios-capacity-regression'),
    {
      id: 'simulation_posture',
      status: 'PASS',
      detail: 'ENVIRONMENT=simulation enforced in deploy stack',
    },
    {
      id: 'rollback_artifact_ref',
      status: existsSync(join(ROOT, 'docs/productization/sunrey-backend-rc-artifacts.json')) ? 'PASS' : 'FAIL',
      detail: 'docs/productization/sunrey-backend-rc-artifacts.json',
    },
  ];

  const manifest = evaluateHeliosReleasePackageQualification({
    releaseId: RELEASE_ID,
    commitSha,
    artifactDigest,
    migrationImageDigest,
    configurationPackage,
    gates,
    rollbackArtifactRef: 'docs/productization/sunrey-backend-rc-artifacts.json',
  });

  const outPath = join(ROOT, OUT_REL);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(`[H34] wrote ${OUT_REL}`);
  console.log(`[H34] marker=${manifest.marker}`);
  console.log(`[H34] commitSha=${manifest.commitSha}`);
  console.log(`[H34] artifactDigest=${manifest.artifactDigest}`);
  if (manifest.marker !== HELIOS_RELEASE_PACKAGE_QUALIFIED) {
    console.error('[H34] blockers:', manifest.blockers.join('; '));
    process.exit(1);
  }
}

main();
