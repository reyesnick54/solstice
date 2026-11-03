#!/usr/bin/env node
/**
 * HELIOS AAFV2.1 — universal evidence-time feature fabric qualification runner.
 */

import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  HELIOS_AAFV2_01_UNIVERSAL_FEATURE_FABRIC_QUALIFIED,
} from '../packages/platform/src/helios/feature-fabric/universal/qualification.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function gitSha(): string {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : '0000000000000000000000000000000000000000';
}

function run(command: string, args: string[]): { readonly ok: boolean; readonly detail: string } {
  const result = spawnSync(command, args, { cwd: ROOT, encoding: 'utf8', env: process.env });
  return {
    ok: result.status === 0,
    detail: result.status === 0 ? 'ok' : (result.stderr || result.stdout || 'failed').slice(0, 400),
  };
}

function main(): void {
  const boundaryFindings = lintHeliosBoundary(ROOT).filter((f) => f.file.includes('helios/feature-fabric'));
  const gates = [
    { gate: 'helios_boundary', ok: boundaryFindings.length === 0, detail: boundaryFindings.map((f) => f.message).join('; ').slice(0, 200) },
    { gate: 'aafv2_tests', ...run('node', ['--experimental-strip-types', '--disable-warning=ExperimentalWarning', '--test', '--test-reporter=spec', 'tests/helios-aafv2-01-universal-feature-fabric.test.ts']) },
    { gate: 'os10_regression', ...run('node', ['--experimental-strip-types', '--disable-warning=ExperimentalWarning', '--test', '--test-reporter=spec', 'tests/helios-os10-point-in-time-fundamentals.test.ts']) },
    { gate: 'native10_regression', ...run('node', ['--experimental-strip-types', '--disable-warning=ExperimentalWarning', '--test', '--test-reporter=spec', 'tests/helios-native10-tradingagents-data-memory.test.ts']) },
  ];

  const qualified = gates.every((g) => g.ok);
  const report = {
    command: 'helios:aafv2:01:qualify',
    gitSha: gitSha(),
    marker: qualified ? HELIOS_AAFV2_01_UNIVERSAL_FEATURE_FABRIC_QUALIFIED : 'HELIOS_AAFV2_01_UNIVERSAL_FEATURE_FABRIC_BLOCKED',
    qualified,
    gates,
  };
  console.log(JSON.stringify(report, null, 2));
  process.exit(qualified ? 0 : 1);
}

main();
