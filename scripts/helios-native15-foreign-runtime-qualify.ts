#!/usr/bin/env node
/**
 * HELIOS NATIVE15 — foreign runtime independence qualification runner.
 * Writes parity matrix, provenance manifest, and qualification summary under docs/helios/native-assimilation/.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  buildNativeAssimilationProvenanceManifest,
  buildNativeCapabilityParityMatrix,
  evaluateForeignRuntimeIndependenceQualification,
  renderNativeCapabilityParityMarkdown,
} from '../packages/platform/src/helios/native-assimilation/index.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'docs/helios/native-assimilation');
const MATRIX_REL = 'docs/helios/native-assimilation/NATIVE_CAPABILITY_PARITY_MATRIX.md';
const PROVENANCE_REL = 'docs/helios/native-assimilation/NATIVE_ASSIMILATION_PROVENANCE_MANIFEST.json';
const SUMMARY_REL = 'docs/helios/native-assimilation/native15-qualification-summary.json';

function gitSha(): string {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : '0000000000000000000000000000000000000000';
}

function main(): void {
  mkdirSync(OUT_DIR, { recursive: true });
  const sha = gitSha();
  const evaluatedAt = asUtcInstant(new Date().toISOString());

  const provenance = buildNativeAssimilationProvenanceManifest({
    root: ROOT,
    gitSha: sha,
    recordedAt: evaluatedAt,
  });
  writeFileSync(join(ROOT, PROVENANCE_REL), `${JSON.stringify(provenance, null, 2)}\n`);

  const parityMatrix = buildNativeCapabilityParityMatrix(ROOT);
  writeFileSync(join(ROOT, MATRIX_REL), renderNativeCapabilityParityMarkdown(parityMatrix));

  const qualification = evaluateForeignRuntimeIndependenceQualification({
    root: ROOT,
    gitSha: sha,
    evaluatedAt,
  });

  const summary = {
    marker: qualification.marker,
    qualified: qualification.qualified,
    blockers: qualification.blockers,
    vendorAssimilationPresent: qualification.vendorAudit.present,
    runtimeImportViolations: qualification.runtimeImportViolations,
    matrix: MATRIX_REL,
    provenance: PROVENANCE_REL,
  };
  writeFileSync(join(ROOT, SUMMARY_REL), `${JSON.stringify(summary, null, 2)}\n`);

  console.log(JSON.stringify(summary, null, 2));
  if (!qualification.qualified) {
    process.exitCode = 1;
  }
}

main();
