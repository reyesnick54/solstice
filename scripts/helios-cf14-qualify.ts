#!/usr/bin/env node
/**
 * HELIOS CF14 — counterfactual learning final qualification runner.
 * Research / simulation only; does not enable live trading.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  HELIOS_COUNTERFACTUAL_LEARNING_V1_BLOCKED,
  HELIOS_COUNTERFACTUAL_LEARNING_V1_QUALIFIED,
  evaluateCounterfactualLearningQualification,
} from '../packages/platform/src/helios/counterfactual-learning/cf14-qualification.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'performance', 'helios', 'results', 'helios-cf14');

const SKIP_SUBPROCESS = process.argv.includes('--skip-subprocess');

function gitSha(): string {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : '0000000000000000000000000000000000000000';
}

function runTest(label: string, rel: string): boolean {
  if (SKIP_SUBPROCESS) {
    console.log(`[CF14] ${label}: skipped (--skip-subprocess)`);
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
    console.error(`[CF14] ${label} failed`);
    console.error((result.stderr || result.stdout || '').slice(0, 600));
  }
  return result.status === 0;
}

function runNpmScript(label: string, script: string): boolean {
  if (SKIP_SUBPROCESS) {
    console.log(`[CF14] ${label}: skipped (--skip-subprocess)`);
    return true;
  }
  const result = spawnSync('npm', ['run', script], { cwd: ROOT, encoding: 'utf8', env: process.env });
  if (result.status !== 0) {
    console.error(`[CF14] ${label} failed (${script})`);
  }
  return result.status === 0;
}

const sha = gitSha();
const now = asUtcInstant(new Date().toISOString());

const boundaryFindings = lintHeliosBoundary(ROOT).filter((row) =>
  row.file.includes('helios/counterfactual-learning'),
);

const productionSafetyOk = runNpmScript('production safety', 'check:production-safety');
const aafOk = runTest('AAF V2', 'tests/helios-aaf-v2-strategy-lab-final-qualification.test.ts');
const earnOk = runTest('EARNINGS', 'tests/helios-earn12-earnings-intelligence-qualification.test.ts');
const healthOk = runTest('HEALTH baseline', 'tests/helios-health06-engineering-baseline-qualification.test.ts');
const valOk = runTest('VALUATION', 'tests/helios-val12-valuation-intelligence-qualification.test.ts');
const execTwinOk = runTest('Execution Twin', 'tests/helios-os02-execution-twin.test.ts');
const cf04Ok = runTest('CF04 outcome model', 'tests/helios-cf04-counterfactual-outcome-model.test.ts');
const cf06Ok = runTest('CF06 distributional OPE', 'tests/helios-cf06-distributional-ope.test.ts');
const cf08Ok = runTest('CF08 market response twin', 'tests/helios-cf08-market-response-twin.test.ts');
const evolOk = runTest('EVOL14 self-evolution', 'tests/helios-evol14-strategy-self-evolution-qualification.test.ts');
const cf14Ok = runTest('CF14 acceptance', 'tests/helios-cf14-counterfactual-learning-qualification.test.ts');

const qualification = evaluateCounterfactualLearningQualification({
  root: ROOT,
  gitSha: sha,
  evaluatedAt: now,
});

const blockers = [...qualification.blockers];
if (boundaryFindings.length > 0) {
  blockers.push(`helios boundary: ${boundaryFindings.map((row) => row.message).join('; ')}`);
}
if (!productionSafetyOk) blockers.push('check:production-safety failed');
if (!aafOk) blockers.push('AAF V2 subprocess gate failed');
if (!earnOk) blockers.push('EARNINGS subprocess gate failed');
if (!healthOk) blockers.push('HEALTH baseline subprocess gate failed');
if (!valOk) blockers.push('VALUATION subprocess gate failed');
if (!execTwinOk) blockers.push('Execution Twin subprocess gate failed');
if (!cf04Ok) blockers.push('CF04 counterfactual outcome model test failed');
if (!cf06Ok) blockers.push('CF06 distributional OPE test failed');
if (!cf08Ok) blockers.push('CF08 market response twin test failed');
if (!evolOk) blockers.push('EVOL14 strategy self-evolution qualification test failed');
if (!cf14Ok) blockers.push('CF14 acceptance test failed');

const qualified = blockers.length === 0;
const marker = qualified
  ? HELIOS_COUNTERFACTUAL_LEARNING_V1_QUALIFIED
  : HELIOS_COUNTERFACTUAL_LEARNING_V1_BLOCKED;

mkdirSync(OUT_DIR, { recursive: true });
const jsonPath = join(OUT_DIR, `helios-cf14-qualification-${sha.slice(0, 12)}.json`);
writeFileSync(
  jsonPath,
  `${JSON.stringify(
    {
      marker,
      qualified,
      gitSha: sha,
      evaluatedAt: now,
      blockers,
    },
    null,
    2,
  )}\n`,
);

console.log(
  JSON.stringify(
    {
      command: 'helios:cf14:qualify',
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
