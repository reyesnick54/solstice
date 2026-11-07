/**
 * Nighttime-light calibration — luminosity is not a production proxy.
 */

import type { NighttimeLightCalibration } from './types.ts';

export function calibratedNighttimeActivityIndexBps(input: {
  readonly rawIndexMinor: bigint;
  readonly calibration: NighttimeLightCalibration | null;
}): { readonly indexBps: number; readonly calibrationApplied: boolean } {
  const base = Number(input.rawIndexMinor);
  if (base <= 0) {
    return Object.freeze({ indexBps: 0, calibrationApplied: false });
  }
  if (!input.calibration) {
    return Object.freeze({ indexBps: Math.min(10_000, Math.floor(base / 10)), calibrationApplied: false });
  }
  const urban = (input.calibration.urbanizationIndexBps ?? 5_000) / 10_000;
  const access = (input.calibration.electricityAccessIndexBps ?? 5_000) / 10_000;
  const adjusted = base * (0.55 + 0.25 * access) * (0.65 + 0.2 * (1 - urban));
  return Object.freeze({
    indexBps: Math.min(10_000, Math.max(0, Math.floor(adjusted / 10))),
    calibrationApplied: true,
  });
}
