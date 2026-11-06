#!/usr/bin/env node
/**
 * HELIOS VAL12 — valuation intelligence final qualification runner.
 * Does not enable live trading or auto-promote strategy candidates from valuation.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  HELIOS_VALUATION_INTELLIGENCE_V1_BLOCKED,
  HELIOS_VALUATION_INTELLIGENCE_V1_QUALIFIED,
  evaluateValuationIntelligenceQualification,
} from '../packages/platform/src/helios/valuation-intelligence/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'performance', 'helios', 'results', 'helios-val12');
const VALIDATION_DOC = join(ROOT, 'docs/helios/valuation/VALUATION_MODEL_VALIDATION_REPORT.md');

const SKIP_SUBPROCESS = process.argv.includes('--skip-subprocess');

function gitSha(): string {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : '0000000000000000000000000000000000000000';
}

function runTest(label: string, rel: string): boolean {
  if (SKIP_SUBPROCESS) {
    console.log(`[VAL12] ${label}: skipped (--skip-subprocess)`);
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
    console.error(`[VAL12] ${label} failed`);
    console.error((result.stderr || result.stdout || '').slice(0, 600));
  }
  return result.status === 0;
}

function runNpmScript(label: string, script: string): boolean {
  if (SKIP_SUBPROCESS) {
    console.log(`[VAL12] ${label}: skipped (--skip-subprocess)`);
    return true;
  }
  const result = spawnSync('npm', ['run', script], { cwd: ROOT, encoding: 'utf8', env: process.env });
  if (result.status !== 0) {
    console.error(`[VAL12] ${label} failed (${script})`);
  }
  return result.status === 0;
}

const sha = gitSha();
const now = asUtcInstant(new Date().toISOString());

const boundaryFindings = lintHeliosBoundary(ROOT).filter((row) =>
  row.file.includes('helios/valuation-intelligence'),
);

const aafOk = runTest('AAF V2', 'tests/helios-aaf-v2-strategy-lab-final-qualification.test.ts');
const earnOk = runTest('EARNINGS', 'tests/helios-earn12-earnings-intelligence-qualification.test.ts');
const healthOk = runTest('HEALTH baseline', 'tests/helios-health06-engineering-baseline-qualification.test.ts');
const val12Ok = runTest('VAL12 acceptance', 'tests/helios-val12-valuation-intelligence-qualification.test.ts');
const productionSafetyOk = runNpmScript('production safety', 'check:production-safety');

const qualification = evaluateValuationIntelligenceQualification({
  root: ROOT,
  gitSha: sha,
  evaluatedAt: now,
  externalGates: Object.freeze({
    aafV2Qualified: aafOk,
    earningsQualified: earnOk,
    healthBaselineQualified: healthOk,
  }),
});

const blockers = [...qualification.blockers];
if (boundaryFindings.length > 0) {
  blockers.push(`helios boundary: ${boundaryFindings.map((row) => row.message).join('; ')}`);
}
if (!productionSafetyOk) {
  blockers.push('check:production-safety failed');
}
if (!aafOk) blockers.push('AAF V2 subprocess gate failed');
if (!earnOk) blockers.push('EARNINGS subprocess gate failed');
if (!healthOk) blockers.push('HEALTH baseline subprocess gate failed');
if (!val12Ok) blockers.push('VAL12 acceptance test failed');

const qualified = blockers.length === 0;
const marker = qualified
  ? HELIOS_VALUATION_INTELLIGENCE_V1_QUALIFIED
  : HELIOS_VALUATION_INTELLIGENCE_V1_BLOCKED;

mkdirSync(OUT_DIR, { recursive: true });
const jsonPath = join(OUT_DIR, `helios-val12-qualification-${sha.slice(0, 12)}.json`);
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

if (qualification.validationReport && existsSync(VALIDATION_DOC)) {
  const report = qualification.validationReport;
  const md = `# Valuation Model Validation Report

**Generated (UTC):** ${report.generatedAt}  
**Git SHA:** \`${report.gitSha}\`  
**Valuation quality gate:** \`${report.valuationQualityGate}\`  
**Marker:** \`${marker}\`

## HELIOS vs simple DCF (forecast-input error improvement bps)

${report.heliosVsSimpleDcfImprovementBps}

## Benchmarks

${report.benchmarks
  .map(
    (row) =>
      `- **${row.model}**: forecast error ${row.forecastInputErrorBps} bps; stability ${row.valuationStabilityScore}; dispersion ${row.crossModelDispersion}; fundamental accuracy ${row.fundamentalAccuracyScore}`,
  )
  .join('\n')}

## Knowable-at violations

${report.knowableAtViolations}

## Investment alpha claimed

${report.investmentAlphaClaimed}
`;
  writeFileSync(VALIDATION_DOC, md);
}

console.log(
  JSON.stringify(
    {
      command: 'helios:val12:qualify',
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
