#!/usr/bin/env node
/**
 * HELIOS MD13 — live market-data resilience qualification (simulation only).
 */

import {
  evaluateMd13LiveDataResilienceQualification,
  HELIOS_MD13_LIVE_DATA_RESILIENCE_QUALIFIED,
} from '../packages/platform/src/helios/market-data-live/md13/index.ts';

const qualification = evaluateMd13LiveDataResilienceQualification();
const report = {
  command: 'helios:md13:qualify',
  marker: qualification.marker,
  qualified: qualification.qualified,
  blockers: qualification.blockers,
  scenarioCount: qualification.report.scenarios.length,
  sloDimensions: qualification.report.sloDimensionsDeclared,
  feedScopedSlo: qualification.report.feedScopedSlo,
};
console.log(JSON.stringify(report, null, 2));
process.exit(qualification.marker === HELIOS_MD13_LIVE_DATA_RESILIENCE_QUALIFIED ? 0 : 1);
