#!/usr/bin/env node
/**
 * HELIOS MD14 — production-shaped market-data fabric final qualification runner.
 * Read-only research posture; does not enable live trading or Execution Authority.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  HELIOS_PRODUCTION_MARKET_DATA_V1_BLOCKED,
  HELIOS_PRODUCTION_MARKET_DATA_V1_QUALIFIED,
  evaluateMarketDataFabricQualification,
} from '../packages/platform/src/helios/market-data/index.ts';
import { regenerateMarketDataQualificationReports } from '../packages/platform/src/helios/market-data/report-writer.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'performance', 'helios', 'results', 'helios-md14');

const SKIP_SUBPROCESS = process.argv.includes('--skip-subprocess');
const SKIP_CI = process.argv.includes('--skip-ci');

function gitSha(): string {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : '0000000000000000000000000000000000000000';
}

function runTest(label: string, rel: string): boolean {
  if (SKIP_SUBPROCESS) {
    console.log(`[MD14] ${label}: skipped (--skip-subprocess)`);
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
    console.error(`[MD14] ${label} failed`);
    console.error((result.stderr || result.stdout || '').slice(0, 800));
  }
  return result.status === 0;
}

function runNpmScript(label: string, script: string): boolean {
  if (SKIP_SUBPROCESS) {
    console.log(`[MD14] ${label}: skipped (--skip-subprocess)`);
    return true;
  }
  const result = spawnSync('npm', ['run', script], { cwd: ROOT, encoding: 'utf8', env: process.env });
  if (result.status !== 0) {
    console.error(`[MD14] ${label} failed (${script})`);
  }
  return result.status === 0;
}

const sha = gitSha();
const now = asUtcInstant(new Date().toISOString());

const boundaryFindings = lintHeliosBoundary(ROOT).filter((row) => row.file.includes('helios/market-data'));

const ciOk = SKIP_CI || SKIP_SUBPROCESS ? true : runNpmScript('CI', 'ci');
const productionSafetyOk = runNpmScript('production safety', 'check:production-safety');
const architectureOk = runNpmScript('architecture', 'lint:architecture');
const aafOk = runTest('AAF V2', 'tests/helios-aaf-v2-strategy-lab-final-qualification.test.ts');
const earnOk = runTest('EARNINGS', 'tests/helios-earn12-earnings-intelligence-qualification.test.ts');
const healthOk = runTest('HEALTH baseline', 'tests/helios-health06-engineering-baseline-qualification.test.ts');
const valOk = runTest('VALUATION', 'tests/helios-val12-valuation-intelligence-qualification.test.ts');
const evolOk = runTest('EVOLUTION', 'tests/helios-evol14-strategy-self-evolution-qualification.test.ts');
const cfOk = runTest('COUNTERFACTUAL', 'tests/helios-cf14-counterfactual-learning-qualification.test.ts');
const altOk = runTest('ALT14 alternative data', 'tests/helios-alt14-alternative-data-qualification.test.ts');
const strategyLabOk = runTest('Strategy Lab', 'tests/helios-os05-strategy-genome.test.ts');
const execTwinOk = runTest('Execution Twin', 'tests/helios-os02-execution-twin.test.ts');
const fuzzOk =
  runTest('fuzz (HELIOS)', 'tests/helios-h31-adversarial-resilience.test.ts') &&
  runNpmScript('fuzz extended', 'test:fuzz-extended');
const formalOk = runNpmScript('formal extended', 'test:formal-extended');
const md11Ok = runTest('MD11 replay', 'tests/helios-md11-deterministic-replay.test.ts');
const md13Ok = runTest('MD13 resilience', 'tests/helios-md13-live-data-resilience.test.ts');
function runNightlyBench(): boolean {
  if (SKIP_SUBPROCESS) {
    console.log('[MD14] nightly bench: skipped (--skip-subprocess)');
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
    console.error('[MD14] nightly bench failed');
  }
  return result.status === 0;
}
const nightlyBenchOk = runNightlyBench();
const aaf07Ok = runTest('AAF07 market data certify', 'tests/helios-aaf07-external-market-data-certification.test.ts');
const md14Ok = runTest('MD14 acceptance', 'tests/helios-md14-market-data-qualification.test.ts');

let typecheckOk = true;
if (!SKIP_SUBPROCESS) {
  const typecheck = spawnSync('npm', ['run', 'helios:health02:typecheck:qualify'], {
    cwd: ROOT,
    encoding: 'utf8',
    env: process.env,
  });
  typecheckOk = typecheck.status === 0;
  if (!typecheckOk) {
    console.error('[MD14] HELIOS strict typecheck failed');
  }
} else {
  console.log('[MD14] HELIOS strict typecheck: skipped (--skip-subprocess)');
}

const subprocessGatesOk =
  ciOk &&
  productionSafetyOk &&
  architectureOk &&
  typecheckOk &&
  aafOk &&
  earnOk &&
  healthOk &&
  valOk &&
  evolOk &&
  cfOk &&
  altOk &&
  strategyLabOk &&
  execTwinOk &&
  fuzzOk &&
  formalOk &&
  nightlyBenchOk &&
  aaf07Ok &&
  md11Ok &&
  md13Ok &&
  md14Ok;

const qualification = evaluateMarketDataFabricQualification({
  root: ROOT,
  gitSha: sha,
  evaluatedAt: now,
  subprocessGatesOk,
});

const blockers = [...qualification.blockers];
if (boundaryFindings.length > 0) {
  blockers.push(`helios boundary: ${boundaryFindings.map((row) => row.message).join('; ')}`);
}
if (!subprocessGatesOk) {
  if (!ciOk) blockers.push('npm run ci failed');
  if (!productionSafetyOk) blockers.push('check:production-safety failed');
  if (!architectureOk) blockers.push('lint:architecture failed');
  if (!typecheckOk) blockers.push('HELIOS strict typecheck failed');
  if (!aafOk) blockers.push('AAF V2 subprocess gate failed');
  if (!earnOk) blockers.push('EARNINGS subprocess gate failed');
  if (!healthOk) blockers.push('HEALTH baseline subprocess gate failed');
  if (!valOk) blockers.push('VALUATION subprocess gate failed');
  if (!evolOk) blockers.push('EVOLUTION subprocess gate failed');
  if (!cfOk) blockers.push('COUNTERFACTUAL subprocess gate failed');
  if (!altOk) blockers.push('ALT14 subprocess gate failed');
  if (!strategyLabOk) blockers.push('Strategy Lab subprocess gate failed');
  if (!execTwinOk) blockers.push('Execution Twin subprocess gate failed');
  if (!fuzzOk) blockers.push('fuzz qualification (HELIOS or extended) failed');
  if (!formalOk) blockers.push('formal extended failed');
  if (!nightlyBenchOk) blockers.push('nightly bench failed');
  if (!aaf07Ok) blockers.push('AAF07 market-data certification test failed');
  if (!md11Ok) blockers.push('MD11 deterministic replay test failed');
  if (!md13Ok) blockers.push('MD13 live-data resilience test failed');
  if (!md14Ok) blockers.push('MD14 acceptance test failed');
}

const qualified = blockers.length === 0;
const marker = qualified
  ? HELIOS_PRODUCTION_MARKET_DATA_V1_QUALIFIED
  : HELIOS_PRODUCTION_MARKET_DATA_V1_BLOCKED;

regenerateMarketDataQualificationReports({
  root: ROOT,
  gitSha: sha,
  evaluatedAt: now,
  qualification: Object.freeze({
    ...qualification,
    qualified,
    marker,
    blockers: Object.freeze(blockers),
  }),
  subprocessGatesOk,
});

mkdirSync(OUT_DIR, { recursive: true });
const jsonPath = join(OUT_DIR, `helios-md14-qualification-${sha.slice(0, 12)}.json`);
writeFileSync(
  jsonPath,
  `${JSON.stringify(
    {
      marker,
      qualified,
      gitSha: sha,
      evaluatedAt: now,
      e2ePipelineOk: qualification.e2ePipelineOk,
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
      command: 'helios:md14:qualify',
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
