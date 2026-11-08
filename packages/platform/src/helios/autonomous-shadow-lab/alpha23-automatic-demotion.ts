/**
 * ALPHA23 — automatic strategy demotion from forward decay signals.
 */

export const HELIOS_ALPHA23_AUTOMATIC_DEMOTION = 'HELIOS_ALPHA23_AUTOMATIC_DEMOTION' as const;

export type DemotionDecision = {
  readonly strategyId: string;
  readonly reason: string;
  readonly liveExecutionPermitted: false;
};

export function automaticDemotionDecision(strategyId: string, reason: string): DemotionDecision {
  return Object.freeze({
    strategyId,
    reason,
    liveExecutionPermitted: false,
  });
}
