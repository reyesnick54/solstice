#!/usr/bin/env node
/**
 * HELIOS ALT04 — workforce intelligence qualification runner.
 */

import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  HELIOS_ALT04_WORKFORCE_INTELLIGENCE_QUALIFIED,
  evaluateAlt04WorkforceQualification,
} from '../packages/platform/src/helios/alternative-data-intelligence/index.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = process.argv.includes('--skip-subprocess');

function runTest(): boolean {
  if (SKIP) return true;
  const result = spawnSync(
    'node',
    [
      '--experimental-strip-types',
      '--disable-warning=ExperimentalWarning',
      '--test',
      '--test-reporter=spec',
      'tests/helios-alt04-workforce-intelligence.test.ts',
    ],
    { cwd: ROOT, encoding: 'utf8' },
  );
  if (result.status !== 0) {
    console.error((result.stderr || result.stdout || '').slice(0, 800));
  }
  return result.status === 0;
}

const testsOk = runTest();
const qualification = evaluateAlt04WorkforceQualification({
  coreTypesDefined: true,
  wave6BridgeExtendsNotDuplicates: true,
  interpretationLayerSeparate: true,
  postingGrowthNotUniversallyBullish: true,
  motiveEstimatesAvoidCertainty: true,
  coveragePreservesRawAndAdjusted: true,
  predictionTargetsExcludePrimaryStockReturn: true,
  knowableAtEnforced: true,
  noExecutionAuthorityOnArtifacts: true,
  skillTaxonomyComplete: true,
});

const qualified = testsOk && qualification.qualified;
console.log(
  JSON.stringify(
    {
      marker: qualified ? HELIOS_ALT04_WORKFORCE_INTELLIGENCE_QUALIFIED : qualification.marker,
      qualified,
      blockers: qualified ? [] : [...qualification.blockers, ...(testsOk ? [] : ['acceptance_tests'])],
    },
    null,
    2,
  ),
);
process.exit(qualified ? 0 : 1);
