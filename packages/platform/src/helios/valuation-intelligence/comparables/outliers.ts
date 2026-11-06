import {
  DEFAULT_MAD_Z_THRESHOLD,
  DEFAULT_WINSORIZE_FRACTION,
} from './taxonomy.ts';
import { mad, median, robustZ, winsorizeValue } from './numeric.ts';
import type { OutlierEvidence } from './types.ts';

export type OutlierPolicy = {
  readonly madZThreshold: number;
  readonly winsorizeFraction: number;
};

export const defaultOutlierPolicy = (): OutlierPolicy =>
  Object.freeze({
    madZThreshold: DEFAULT_MAD_Z_THRESHOLD,
    winsorizeFraction: DEFAULT_WINSORIZE_FRACTION,
  });

export function analyzeOutlier(
  value: number,
  sample: readonly number[],
  policy: OutlierPolicy,
): OutlierEvidence {
  const center = median(sample);
  const scale = mad(sample, center);
  const z = robustZ(value, center, scale);
  const sorted = [...sample].sort((a, b) => a - b);
  const loIdx = Math.floor(policy.winsorizeFraction * (sorted.length - 1));
  const hiIdx = Math.ceil((1 - policy.winsorizeFraction) * (sorted.length - 1));
  const lower = sorted[loIdx] ?? sorted[0]!;
  const upper = sorted[hiIdx] ?? sorted[sorted.length - 1]!;
  const winsorized = winsorizeValue(value, lower, upper);
  const winsorizeApplied = winsorized !== value;

  return Object.freeze({
    madScore: scale > 0 ? Math.abs(value - center) / scale : 0,
    robustZ: z,
    winsorizedMultiple: winsorized,
    winsorizeApplied,
    preserved: true,
  });
}

export function isExtremeOutlier(evidence: OutlierEvidence, policy: OutlierPolicy): boolean {
  return Math.abs(evidence.robustZ) > policy.madZThreshold;
}
