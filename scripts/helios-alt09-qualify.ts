#!/usr/bin/env node
/**
 * HELIOS ALT09 — innovation intelligence qualification runner.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  HELIOS_ALT09_INNOVATION_INTELLIGENCE_BLOCKED,
  HELIOS_ALT09_INNOVATION_INTELLIGENCE_QUALIFIED,
  evaluateAlt09InnovationIntelligenceQualification,
  runAlt09InnovationIntelligencePipeline,
} from '../packages/platform/src/helios/alternative-data-intelligence/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'performance', 'helios', 'results', 'helios-alt09');
const SKIP_SUBPROCESS = process.argv.includes('--skip-subprocess');

function gitSha(): string {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : '0000000000000000000000000000000000000000';
}

function runTest(rel: string): boolean {
  if (SKIP_SUBPROCESS) {
    return true;
  }
  const result = spawnSync(
    'node',
    [
      '--experimental-strip-types',
      '--disable-warning=ExperimentalWarning',
      '--test',
      '--test-reporter=spec',
      rel,
    ],
    { cwd: ROOT, encoding: 'utf8' },
  );
  return result.status === 0;
}

const sha = gitSha();
const now = asUtcInstant(new Date().toISOString());
const boundaryFindings = lintHeliosBoundary(ROOT).filter((row) =>
  row.file.includes('helios/alternative-data-intelligence'),
);
const acceptanceOk = runTest('tests/helios-alt09-innovation-intelligence-qualification.test.ts');
const qualification = evaluateAlt09InnovationIntelligenceQualification();
const pipeline = runAlt09InnovationIntelligencePipeline();

const blockers = [...qualification.blockers];
if (boundaryFindings.length > 0) {
  blockers.push(`helios boundary: ${boundaryFindings.map((row) => row.message).join('; ')}`);
}
if (!acceptanceOk) {
  blockers.push('ALT09 acceptance test failed');
}

const qualified = blockers.length === 0 && qualification.qualified;
const marker = qualified
  ? HELIOS_ALT09_INNOVATION_INTELLIGENCE_QUALIFIED
  : HELIOS_ALT09_INNOVATION_INTELLIGENCE_BLOCKED;

if (!existsSync(OUT_DIR)) {
  mkdirSync(OUT_DIR, { recursive: true });
}
writeFileSync(
  join(OUT_DIR, `alt09-qualification-${sha.slice(0, 8)}.json`),
  JSON.stringify(
    {
      marker,
      qualified,
      gitSha: sha,
      evaluatedAt: now,
      blockers,
      pipelineStages: pipeline.stages,
      pipelineOk: pipeline.ok,
    },
    null,
    2,
  ),
  'utf8',
);

console.log(marker);
if (!qualified) {
  console.error(blockers.join('\n'));
  process.exit(1);
}
