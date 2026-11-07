#!/usr/bin/env node
/**
 * HELIOS ALT14 — alternative-data intelligence final qualification runner.
 * Research / simulation only; does not enable live trading.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  HELIOS_ALTERNATIVE_DATA_INTELLIGENCE_V1_BLOCKED,
  HELIOS_ALTERNATIVE_DATA_INTELLIGENCE_V1_QUALIFIED,
  evaluateAlternativeDataIntelligenceQualification,
} from '../packages/platform/src/helios/alternative-data-intelligence/alt14-qualification.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'performance', 'helios', 'results', 'helios-alt14');

const SKIP_SUBPROCESS = process.argv.includes('--skip-subprocess');

function gitSha(): string {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : '0000000000000000000000000000000000000000';
}

function runTest(label: string, rel: string): boolean {
  if (SKIP_SUBPROCESS) {
    console.log(`[ALT14] ${label}: skipped (--skip-subprocess)`);
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
  if (result.status !== 0) {
    console.error(`[ALT14] ${label} failed`);
    console.error((result.stderr || result.stdout || '').slice(0, 800));
  }
  return result.status === 0;
}

function runNpmScript(label: string, script: string): boolean {
  if (SKIP_SUBPROCESS) {
    console.log(`[ALT14] ${label}: skipped (--skip-subprocess)`);
    return true;
  }
  const result = spawnSync('npm', ['run', script], { cwd: ROOT, encoding: 'utf8', env: process.env });
  if (result.status !== 0) {
    console.error(`[ALT14] ${label} failed (${script})`);
  }
  return result.status === 0;
}

const sha = gitSha();
const now = asUtcInstant(new Date().toISOString());

const boundaryFindings = lintHeliosBoundary(ROOT).filter((row) =>
  row.file.includes('helios/alternative-data-intelligence'),
);

const productionSafetyOk = runNpmScript('production safety', 'check:production-safety');
const architectureOk = runNpmScript('architecture', 'lint:architecture');
const aafOk = runTest('AAF V2', 'tests/helios-aaf-v2-strategy-lab-final-qualification.test.ts');
const earnOk = runTest('EARNINGS', 'tests/helios-earn12-earnings-intelligence-qualification.test.ts');
const healthOk = runTest('HEALTH baseline', 'tests/helios-health06-engineering-baseline-qualification.test.ts');
const valOk = runTest('VALUATION', 'tests/helios-val12-valuation-intelligence-qualification.test.ts');
const evolOk = runTest('EVOLUTION', 'tests/helios-evol14-strategy-self-evolution-qualification.test.ts');
const cfOk = runTest('COUNTERFACTUAL', 'tests/helios-cf14-counterfactual-learning-qualification.test.ts');
const strategyLabOk = runTest('Strategy Lab', 'tests/helios-os05-strategy-genome.test.ts');
const execTwinOk = runTest('Execution Twin', 'tests/helios-os02-execution-twin.test.ts');
const fuzzOk = runTest('fuzz', 'tests/helios-h31-adversarial-resilience.test.ts');
const formalOk = runNpmScript('formal smoke', 'test:formal-smoke');
function runNightlyBench(): boolean {
  if (SKIP_SUBPROCESS) {
    console.log('[ALT14] nightly bench: skipped (--skip-subprocess)');
    return true;
  }
  const result = spawnSync(
    'npm',
    [
      'run',
      'sunrey-bench',
      '--',
      'seven-validator',
      '--json',
      'packages/sunrey-chain/perf/baseline/nightly-seven.json',
    ],
    { cwd: ROOT, encoding: 'utf8', env: process.env },
  );
  if (result.status !== 0) {
    console.error('[ALT14] nightly bench failed');
  }
  return result.status === 0;
}
const nightlyBenchOk = runNightlyBench();
const meshOk = runTest('ALT14 mesh', 'tests/helios-alt14-alternative-data-research-mesh.test.ts');
const alt14Ok = runTest('ALT14 acceptance', 'tests/helios-alt14-alternative-data-qualification.test.ts');

let typecheckOk = true;
if (!SKIP_SUBPROCESS) {
  const typecheck = spawnSync('npm', ['run', 'helios:health02:typecheck:qualify'], {
    cwd: ROOT,
    encoding: 'utf8',
    env: process.env,
  });
  typecheckOk = typecheck.status === 0;
  if (!typecheckOk) {
    console.error('[ALT14] HELIOS strict typecheck failed');
  }
} else {
  console.log('[ALT14] HELIOS strict typecheck: skipped (--skip-subprocess)');
}

const qualification = evaluateAlternativeDataIntelligenceQualification({
  root: ROOT,
  gitSha: sha,
  evaluatedAt: now,
});

const blockers = [...qualification.blockers];
if (boundaryFindings.length > 0) {
  blockers.push(`helios boundary: ${boundaryFindings.map((row) => row.message).join('; ')}`);
}
if (!productionSafetyOk) blockers.push('check:production-safety failed');
if (!architectureOk) blockers.push('lint:architecture failed');
if (!typecheckOk) blockers.push('HELIOS strict typecheck failed');
if (!aafOk) blockers.push('AAF V2 subprocess gate failed');
if (!earnOk) blockers.push('EARNINGS subprocess gate failed');
if (!healthOk) blockers.push('HEALTH baseline subprocess gate failed');
if (!valOk) blockers.push('VALUATION subprocess gate failed');
if (!evolOk) blockers.push('EVOLUTION subprocess gate failed');
if (!cfOk) blockers.push('COUNTERFACTUAL subprocess gate failed');
if (!strategyLabOk) blockers.push('Strategy Lab subprocess gate failed');
if (!execTwinOk) blockers.push('Execution Twin subprocess gate failed');
if (!fuzzOk) blockers.push('fuzz qualification test failed');
if (!formalOk) blockers.push('formal smoke failed');
if (!nightlyBenchOk) blockers.push('nightly bench failed');
if (!meshOk) blockers.push('ALT14 mesh test failed');
if (!alt14Ok) blockers.push('ALT14 acceptance test failed');

const qualified = blockers.length === 0;
const marker = qualified
  ? HELIOS_ALTERNATIVE_DATA_INTELLIGENCE_V1_QUALIFIED
  : HELIOS_ALTERNATIVE_DATA_INTELLIGENCE_V1_BLOCKED;

mkdirSync(OUT_DIR, { recursive: true });
const jsonPath = join(OUT_DIR, `helios-alt14-qualification-${sha.slice(0, 12)}.json`);
writeFileSync(
  jsonPath,
  `${JSON.stringify(
    {
      marker,
      qualified,
      gitSha: sha,
      evaluatedAt: now,
      adversarialScenariosPassed: qualification.adversarialScenariosPassed,
      blockers,
    },
    null,
    2,
  )}\n`,
);

console.log(
  JSON.stringify(
    {
      command: 'helios:alt14:qualify',
      marker,
      qualified,
      jsonPath,
      blockers,
    },
    null,
    2,
  ),
);

process.exit(qualified ? 0 : 1);
