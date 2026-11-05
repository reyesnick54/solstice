import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const NODE_TEST_ARGS = [
  '--experimental-strip-types',
  '--disable-warning=ExperimentalWarning',
  '--test',
  '--test-reporter=spec',
] as const;

/**
 * Run matching tests from this file in a fresh Node process so long memory-soak
 * work is not skewed by parallel repository suites.
 *
 * Returns true when the caller should execute the test body (child or direct run).
 */
export function shouldRunIsolatedTestBody(envFlag: string): boolean {
  return process.env[envFlag] === '1';
}

export function assertIsolatedTestPass(input: {
  readonly envFlag: string;
  readonly testModuleUrl: string | URL;
  readonly cwd: string;
  readonly testNamePattern: string;
}): void {
  if (shouldRunIsolatedTestBody(input.envFlag)) {
    return;
  }
  const self = fileURLToPath(input.testModuleUrl);
  const result = spawnSync(
    process.execPath,
    [...NODE_TEST_ARGS, `--test-name-pattern=${input.testNamePattern}`, self],
    {
      cwd: input.cwd,
      env: { ...process.env, [input.envFlag]: '1' },
      encoding: 'utf8',
    },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
}
