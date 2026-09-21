#!/usr/bin/env npx tsx
/**
 * HELIOS Multi-Asset M16 — opportunity ranking qualification gate.
 */

import { spawnSync } from 'node:child_process';

import {
  HELIOS_MULTI_ASSET_M16_OPPORTUNITY_RANKING_QUALIFIED,
  evaluateM16Qualification,
} from '../packages/platform/src/helios/intelligence/index.ts';

const test = spawnSync(
  'node',
  [
    '--experimental-strip-types',
    '--disable-warning=ExperimentalWarning',
    '--test',
    '--test-reporter=spec',
    'tests/helios-multi-asset-m16-opportunity-ranking.test.ts',
  ],
  { stdio: 'inherit', cwd: process.cwd() },
);

if (test.status !== 0) {
  process.exit(test.status ?? 1);
}

const result = evaluateM16Qualification({
  deterministicRanking: true,
  versionedPolicy: true,
  explainableScorecard: true,
  reproducibleFingerprint: true,
  auditableEvidence: true,
  noInventedExpectedReturn: true,
  noLlmFinalRank: true,
  rankNotTradePermission: true,
  metaAllocatorGating: true,
  crossStrategyComparison: true,
  expirationHandling: true,
  restartPersistence: true,
  evidenceLineage: true,
});

if (!result.qualified) {
  console.error('M16 qualification blocked:', result.blockers.join(', '));
  process.exit(1);
}

console.log(result.marker);
if (result.marker !== HELIOS_MULTI_ASSET_M16_OPPORTUNITY_RANKING_QUALIFIED) {
  process.exit(1);
}
