/**
 * Risk Engine read-only facts from native BYTEX simulation runs (pre-trade / in-run snapshots).
 * Does not replace portfolio risk engine — exposes deterministic inputs only.
 */

import type { BytexDeterministicRunOutcome, BytexOrderLifecycleEvent } from '../types.ts';

export type BytexSimulationRiskFacts = {
  readonly openOrderCount: number;
  readonly filledOrderCount: number;
  readonly portfolioEventCount: number;
  readonly runOutcomeDigest: string;
};

export function riskFactsFromBytexSimulation(outcome: BytexDeterministicRunOutcome): BytexSimulationRiskFacts {
  const filled = outcome.orderEvents.filter((event) => event.toStatus === 'FILLED').length;
  const open = outcome.orderEvents.filter((event) => isOpenOrderEvent(event)).length;
  return Object.freeze({
    openOrderCount: open,
    filledOrderCount: filled,
    portfolioEventCount: outcome.portfolioEvents.length,
    runOutcomeDigest: outcome.outcomeDigest,
  });
}

function isOpenOrderEvent(event: BytexOrderLifecycleEvent): boolean {
  return (
    event.toStatus === 'ACCEPTED' ||
    event.toStatus === 'PARTIALLY_FILLED' ||
    event.toStatus === 'SUBMITTED' ||
    event.toStatus === 'TRIGGERED' ||
    event.toStatus === 'PENDING_UPDATE' ||
    event.toStatus === 'PENDING_CANCEL'
  );
}
