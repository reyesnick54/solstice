#!/usr/bin/env node
/**
 * H12 — S3M-Finance qualification harness CLI.
 * Reports honest availability; does not mock deployment into QUALIFIED state.
 */
import { FrozenClock } from '../packages/config/src/clock.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import { runS3mFinanceQualificationHarness } from '../packages/ai-runtime/src/s3m-finance/index.ts';

const now = asUtcInstant(new Date().toISOString());
const report = runS3mFinanceQualificationHarness({
  clock: new FrozenClock(now),
  fixtureQualified: process.argv.includes('--fixture-qualified'),
});

console.log(JSON.stringify(report, null, 2));
process.exit(report.overallPassed ? 0 : 1);
