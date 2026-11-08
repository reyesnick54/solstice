import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { LIVE_TRADING_ENABLED } from '@solstice/config';
import type { UtcInstant } from '@solstice/domain';

import {
  ALPHA_DECOMPOSITION_BUCKETS,
  FORWARD_BENCHMARK_KINDS,
  HELIOS_ALPHA05_BENCHMARK_ATTRIBUTION_BLOCKED,
  HELIOS_ALPHA05_BENCHMARK_ATTRIBUTION_QUALIFIED,
  HELIOS_ALPHA05_SCHEMA,
  type Alpha05QualificationMarker,
} from './taxonomy.ts';

export type Alpha05BenchmarkAttributionQualificationInput = {
  readonly root: string;
  readonly gitSha: string;
  readonly evaluatedAt: UtcInstant;
  readonly qualificationTestPresent?: boolean;
};

export type Alpha05BenchmarkAttributionQualificationResult = {
  readonly schema: typeof HELIOS_ALPHA05_SCHEMA;
  readonly marker: Alpha05QualificationMarker;
  readonly qualified: boolean;
  readonly gitSha: string;
  readonly evaluatedAt: UtcInstant;
  readonly blockers: readonly string[];
};

const MODULE_MARKER_FILES = Object.freeze([
  'packages/platform/src/helios/forward-alpha/alpha05/forward-benchmark.ts',
  'packages/platform/src/helios/forward-alpha/alpha05/benchmark-portfolio.ts',
  'packages/platform/src/helios/forward-alpha/alpha05/benchmark-comparison.ts',
  'packages/platform/src/helios/forward-alpha/alpha05/alpha-attribution.ts',
  'packages/platform/src/helios/forward-alpha/alpha05/alpha-decomposition.ts',
]);

export function evaluateAlpha05BenchmarkAttributionQualification(
  input: Alpha05BenchmarkAttributionQualificationInput,
): Alpha05BenchmarkAttributionQualificationResult {
  const blockers: string[] = [];

  if (FORWARD_BENCHMARK_KINDS.length !== 10) {
    blockers.push('FORWARD_BENCHMARK_KINDS must enumerate ten benchmark types');
  }
  if (ALPHA_DECOMPOSITION_BUCKETS.length !== 8) {
    blockers.push('ALPHA_DECOMPOSITION_BUCKETS must enumerate eight attribution buckets');
  }

  for (const rel of MODULE_MARKER_FILES) {
    if (!existsSync(join(input.root, rel))) {
      blockers.push(`missing module: ${rel}`);
    }
  }

  const testPath = join(input.root, 'tests/helios-alpha05-benchmark-attribution.test.ts');
  if (input.qualificationTestPresent !== false && !existsSync(testPath)) {
    blockers.push('tests/helios-alpha05-benchmark-attribution.test.ts missing');
  }

  if (LIVE_TRADING_ENABLED) {
    blockers.push('LIVE_TRADING_ENABLED must remain false for forward alpha attribution qualification');
  }

  const qualified = blockers.length === 0;

  return Object.freeze({
    schema: HELIOS_ALPHA05_SCHEMA,
    marker: qualified
      ? HELIOS_ALPHA05_BENCHMARK_ATTRIBUTION_QUALIFIED
      : HELIOS_ALPHA05_BENCHMARK_ATTRIBUTION_BLOCKED,
    qualified,
    gitSha: input.gitSha,
    evaluatedAt: input.evaluatedAt,
    blockers: Object.freeze(blockers),
  });
}
