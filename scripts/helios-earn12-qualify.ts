#!/usr/bin/env node
/**
 * HELIOS EARN12 — earnings intelligence final qualification runner.
 * Does not enable live trading or weaken anti-overfitting gates.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  HELIOS_EARNINGS_INTELLIGENCE_V1_BLOCKED,
  HELIOS_EARNINGS_INTELLIGENCE_V1_QUALIFIED,
  evaluateEarningsIntelligenceQualification,
} from '../packages/platform/src/helios/earnings-intelligence/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'performance', 'helios', 'results', 'helios-earn12');
const VALIDATION_DOC = join(ROOT, 'docs/helios/earnings/EARNINGS_MODEL_VALIDATION_REPORT.md');

const SKIP_SUBPROCESS = process.argv.includes('--skip-subprocess');

function gitSha(): string {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : '0000000000000000000000000000000000000000';
}

function runTest(label: string, rel: string): boolean {
  if (SKIP_SUBPROCESS) {
    console.log(`[EARN12] ${label}: skipped (--skip-subprocess)`);
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
    console.error(`[EARN12] ${label} failed`);
    console.error((result.stderr || result.stdout || '').slice(0, 600));
  }
  return result.status === 0;
}

function runNpmScript(label: string, script: string): boolean {
  if (SKIP_SUBPROCESS) {
    console.log(`[EARN12] ${label}: skipped (--skip-subprocess)`);
    return true;
  }
  const result = spawnSync('npm', ['run', script], { cwd: ROOT, encoding: 'utf8', env: process.env });
  if (result.status !== 0) {
    console.error(`[EARN12] ${label} failed (${script})`);
  }
  return result.status === 0;
}

const sha = gitSha();
const now = asUtcInstant(new Date().toISOString());

const boundaryFindings = lintHeliosBoundary(ROOT).filter((row) =>
  row.file.includes('helios/earnings-intelligence'),
);

const aafOk = runTest('AAF V2', 'tests/helios-aaf-v2-strategy-lab-final-qualification.test.ts');
const twinOk = runTest('Execution Twin OS02', 'tests/helios-os02-execution-twin.test.ts');
const earn12Ok = runTest('EARN12 acceptance', 'tests/helios-earn12-earnings-intelligence-qualification.test.ts');
const productionSafetyOk = runNpmScript('production safety', 'check:production-safety');

const qualification = evaluateEarningsIntelligenceQualification({
  root: ROOT,
  gitSha: sha,
  evaluatedAt: now,
  externalGates: Object.freeze({
    aafV2Qualified: aafOk,
    strategyLabQualified: aafOk,
    executionTwinQualified: twinOk,
  }),
});

const blockers = [...qualification.blockers];
if (boundaryFindings.length > 0) {
  blockers.push(`helios boundary: ${boundaryFindings.map((row) => row.message).join('; ')}`);
}
if (!productionSafetyOk) {
  blockers.push('check:production-safety failed');
}
if (!aafOk) {
  blockers.push('AAF V2 subprocess gate failed');
}
if (!twinOk) {
  blockers.push('Execution Twin subprocess gate failed');
}
if (!earn12Ok) {
  blockers.push('EARN12 acceptance test failed');
}

const qualified = blockers.length === 0;
const marker = qualified
  ? HELIOS_EARNINGS_INTELLIGENCE_V1_QUALIFIED
  : HELIOS_EARNINGS_INTELLIGENCE_V1_BLOCKED;

mkdirSync(OUT_DIR, { recursive: true });
const jsonPath = join(OUT_DIR, `helios-earn12-qualification-${sha.slice(0, 12)}.json`);
writeFileSync(
  jsonPath,
  `${JSON.stringify(
    {
      marker,
      qualified,
      gitSha: sha,
      evaluatedAt: now,
      blockers,
      validationReport: qualification.validationReport,
      evidenceRef: qualification.evidenceRef,
    },
    (_key, value) => (typeof value === 'bigint' ? value.toString() : value),
    2,
  )}\n`,
);

if (qualification.validationReport) {
  const report = qualification.validationReport;
  const md = `# Earnings Model Validation Report

**Generated (UTC):** ${report.generatedAt}  
**Git SHA:** \`${report.gitSha}\`  
**Reality gate:** \`${report.realityGate}\`  
**Marker:** \`${marker}\`

## Holdout chronology

- Train events: ${report.chronology.trainEventCount}
- Validation events: ${report.chronology.validationEventCount}
- Holdout events: ${report.chronology.holdoutEventCount}
- Walk-forward folds: ${report.chronology.walkForwardFoldCount}
- Embargo violations: ${report.chronology.embargoViolations}
- Issuer leakage violations: ${report.chronology.issuerLeakageViolations}

## HELIOS vs naive seasonal (EPS MAE improvement bps)

${report.heliosVsNaiveEpsMaeImprovementBps}

## Anti-overfitting

- Trial count: ${report.antiOverfitting.trialCount}
- Deflated Sharpe: ${report.antiOverfitting.deflatedSharpeRatio ?? 'n/a (sample)'}
- PBO: ${report.antiOverfitting.probabilityOfBacktestOverfitting ?? 'n/a (sample)'}
- Insignificant alpha not promoted: ${report.insignificantAlphaNotPromoted}

## Reality gate notes

${report.realityGateNotes.map((line) => `- ${line}`).join('\n')}
`;
  writeFileSync(VALIDATION_DOC, md);
}

console.log(
  JSON.stringify(
    {
      command: 'helios:earn12:qualify',
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
