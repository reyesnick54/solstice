#!/usr/bin/env node
/**
 * H33 — HELIOS capacity, latency, and portfolio interaction qualification CLI.
 * Full profiles are intended for manual/scheduled runs; use --profile SMALL for fast checks.
 */
import { FrozenClock } from '../packages/config/src/clock.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  ALL_HELIOS_LOAD_PROFILE_IDS,
  assertSimulationPosture,
  runHeliosCapacityQualification,
  type HeliosLoadProfileId,
} from '../packages/platform/src/helios/capacity/index.ts';
import { writeHeliosCapacityReport } from '../performance/helios/lib/report.ts';

function parseProfileArg(): HeliosLoadProfileId | 'ALL' {
  const profileIndex = process.argv.indexOf('--profile');
  if (profileIndex >= 0) {
    const value = process.argv[profileIndex + 1]?.toUpperCase();
    if (value === 'ALL') return 'ALL';
    if (value && ALL_HELIOS_LOAD_PROFILE_IDS.includes(value as HeliosLoadProfileId)) {
      return value as HeliosLoadProfileId;
    }
    throw new Error(`Unknown profile ${value}. Use SMALL|MEDIUM|LARGE_SANDBOX|BURST|ALL`);
  }
  return 'MEDIUM';
}

async function main(): Promise<void> {
  assertSimulationPosture();
  const now = asUtcInstant(new Date().toISOString());
  const clock = new FrozenClock(now);
  const profileArg = parseProfileArg();
  const profiles: HeliosLoadProfileId[] =
    profileArg === 'ALL' ? [...ALL_HELIOS_LOAD_PROFILE_IDS] : [profileArg];

  const reports = [];
  for (const profileId of profiles) {
    const result = await runHeliosCapacityQualification({ profileId, now: clock.now() });
    const outDir = writeHeliosCapacityReport(result.report);
    reports.push({
      profileId,
      marker: result.marker,
      qualified: result.qualified,
      blockers: result.blockers,
      outputDir: outDir,
      safeOperatingEnvelope: result.report.safeOperatingEnvelope,
    });
  }

  const overallQualified = reports.every((row) => row.qualified);
  console.log(
    JSON.stringify(
      {
        chunk: 'H33',
        marker: overallQualified ? 'HELIOS_RESILIENCE_ECONOMIC_QUALIFIED' : 'HELIOS_RESILIENCE_ECONOMIC_BLOCKED',
        qualified: overallQualified,
        profiles: reports,
      },
      null,
      2,
    ),
  );
  process.exit(overallQualified ? 0 : 1);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
