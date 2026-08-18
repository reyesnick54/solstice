/**
 * Consume the canonical Chunk 76 smoke campaign without importing
 * packages/sunrey-economics into packages/sunrey-chain.
 */

import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

export type CanonicalSmokeStressReport = {
  readonly ok: boolean;
  readonly campaignId: string;
  readonly commit: string;
  readonly scenarioCount: number;
  readonly seed: number;
  readonly violations: number;
  readonly failClosedResults: number;
  readonly productionAuthorization: boolean;
  readonly openFindings: readonly { readonly findingId: string; readonly severity: string }[];
  readonly results: readonly { readonly inputFixtureHash: string }[];
};

const cache = new Map<string, CanonicalSmokeStressReport>();

export function runCanonicalSmokeStressCampaign(root: string): CanonicalSmokeStressReport {
  const hit = cache.get(root);
  if (hit) {
    return hit;
  }
  const result = spawnSync(
    process.execPath,
    [
      '--experimental-strip-types',
      '--disable-warning=ExperimentalWarning',
      join(root, 'packages/sunrey-economics/src/cli-main.ts'),
      'stress',
      'report',
      '--campaign',
      'smoke',
    ],
    { cwd: root, encoding: 'utf8' },
  );
  if (result.status !== 0 || result.stdout.trim().length === 0) {
    const failed = Object.freeze({
      ok: false,
      campaignId: 'smoke',
      commit: 'UNAVAILABLE',
      scenarioCount: 0,
      seed: 76,
      violations: 1,
      failClosedResults: 0,
      productionAuthorization: false,
      openFindings: Object.freeze([{ findingId: 'chunk76-cli', severity: 'CRITICAL' }]),
      results: Object.freeze([]),
    });
    cache.set(root, failed);
    return failed;
  }
  const parsed = JSON.parse(result.stdout) as CanonicalSmokeStressReport;
  const report = Object.freeze({
    ok: parsed.violations === 0 && parsed.productionAuthorization === false,
    campaignId: parsed.campaignId,
    commit: parsed.commit,
    scenarioCount: parsed.scenarioCount,
    seed: parsed.seed,
    violations: parsed.violations,
    failClosedResults: parsed.failClosedResults,
    productionAuthorization: parsed.productionAuthorization,
    openFindings: Object.freeze(parsed.openFindings ?? []),
    results: Object.freeze(parsed.results ?? []),
  });
  cache.set(root, report);
  return report;
}
