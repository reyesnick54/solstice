import { asUtcInstant, type UtcInstant } from '@solstice/domain';

import type { EmpiricalCalibrationSnapshot } from './types.ts';

/** Fixture-sealed empirical thresholds for ALT06 signals (not production tokenomics). */
export function alt06DefaultEmpiricalCalibration(sealedAt: UtcInstant = asUtcInstant('2026-01-01T00:00:00.000Z')): EmpiricalCalibrationSnapshot {
  return Object.freeze({
    calibrationId: 'alt06.calibration.cpg_demo.v1',
    trainedFromFixture: 'alt06_demo_cpg_timeline',
    minObservations: 2,
    priceIncreaseBpsThreshold: 300,
    availabilityDeclineThreshold: 0.35,
    promotionClearanceBpsThreshold: 1000,
    sealedAt,
  });
}
