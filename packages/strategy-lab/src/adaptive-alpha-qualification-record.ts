import type { StrategyLabAdaptiveAlphaQualificationRef } from './evaluation/adaptive-alpha-promotion-gate.ts';

export type AdaptiveAlphaQualificationRecord = StrategyLabAdaptiveAlphaQualificationRef & {
  readonly strategyId: string;
  readonly strategyVersion: string;
  readonly recordedAt: string;
};
