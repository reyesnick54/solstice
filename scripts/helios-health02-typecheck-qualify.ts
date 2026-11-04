#!/usr/bin/env node
/**
 * HEALTH02 — verify zero TypeScript diagnostics in the HELIOS strict scope.
 */

import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  HELIOS_STRICT_TYPECHECK_BLOCKED,
  HELIOS_STRICT_TYPECHECK_QUALIFIED,
  HELIOS_STRICT_TYPECHECK_SCOPE,
  type HeliosStrictTypecheckScopePath,
} from '../packages/platform/src/helios/hardening/strict-typecheck-qualification.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TSCONFIG = join(ROOT, 'tsconfig.helios-strict.json');

const ERROR_LINE = /^([^(\s]+)\(\d+,\d+\): error TS\d+:/;

function isScoped(path: string): path is HeliosStrictTypecheckScopePath {
  return (HELIOS_STRICT_TYPECHECK_SCOPE as readonly string[]).some((prefix) => path.startsWith(prefix));
}

function main(): void {
  const result = spawnSync(
    'npx',
    ['tsc', '--noEmit', '-p', TSCONFIG, '--pretty', 'false'],
    {
      cwd: ROOT,
      encoding: 'utf8',
      env: { ...process.env, NODE_OPTIONS: process.env.NODE_OPTIONS ?? '--max-old-space-size=6144' },
    },
  );

  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  const scopedErrors = output.split('\n').filter((line) => {
    const match = ERROR_LINE.exec(line);
    return match !== null && isScoped(match[1]!);
  });

  const marker =
    scopedErrors.length === 0 ? HELIOS_STRICT_TYPECHECK_QUALIFIED : HELIOS_STRICT_TYPECHECK_BLOCKED;

  const summary = {
    marker,
    scopedErrorCount: scopedErrors.length,
    scope: HELIOS_STRICT_TYPECHECK_SCOPE,
    tsconfig: 'tsconfig.helios-strict.json',
    compilerExitCode: result.status,
    sampleErrors: scopedErrors.slice(0, 5),
  };

  console.log(JSON.stringify(summary, null, 2));

  if (marker === HELIOS_STRICT_TYPECHECK_BLOCKED) {
    process.exit(1);
  }
}

main();
