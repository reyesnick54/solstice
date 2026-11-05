/**
 * Bridge HEALTH08 harness results into Wave 9 DR suite cases.
 */

import {
  evaluateHeliosRestartRecoveryQualification,
  type HeliosRestartRecoveryQualification,
} from '../../../packages/platform/src/helios/hardening/restart-recovery-qualification.ts';
import { runHeliosDrSimulationHarness } from './helios-dr-harness.ts';

export function runHeliosDrQualification(input?: {
  readonly postgresTierAttempted?: boolean;
  readonly postgresTierPass?: boolean;
}): HeliosRestartRecoveryQualification {
  const report = runHeliosDrSimulationHarness(input);
  return evaluateHeliosRestartRecoveryQualification(report);
}

export function heliosDrCaseStatus(qualification: HeliosRestartRecoveryQualification): 'TARGET_MET' | 'TARGET_NOT_MET' {
  return qualification.qualified ? 'TARGET_MET' : 'TARGET_NOT_MET';
}
