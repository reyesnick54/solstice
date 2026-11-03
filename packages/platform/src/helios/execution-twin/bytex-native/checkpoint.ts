import { createHash } from 'node:crypto';

import type { BytexEngineEvent, BytexRuntimeCheckpoint } from './types.ts';
import type { BytexOrderCoordinator } from './order-state.ts';
import type { BytexPortfolioLedger } from './portfolio-state.ts';
import type { BytexSimulationClock } from './clock.ts';
import type { BytexStrategyRuntime } from './strategy-runtime.ts';
import type { BytexRuntimeEnvironment } from './taxonomy.ts';

export function digestEventLog(events: readonly BytexEngineEvent[]): string {
  return createHash('sha256')
    .update(JSON.stringify(events, (_key, value) => (typeof value === 'bigint' ? value.toString() : value)))
    .digest('hex');
}

export function buildRuntimeCheckpoint(input: {
  readonly checkpointId: string;
  readonly environment: BytexRuntimeEnvironment;
  readonly randomSeed: string;
  readonly clock: BytexSimulationClock;
  readonly dispatchedMarketCount: number;
  readonly lastDispatchedKey: { readonly timeNs: bigint; readonly insertionIndex: number } | null;
  readonly strategy: BytexStrategyRuntime;
  readonly orders: BytexOrderCoordinator;
  readonly engineEvents: readonly BytexEngineEvent[];
}): BytexRuntimeCheckpoint {
  return Object.freeze({
    checkpointId: input.checkpointId,
    savedAtNs: input.clock.nowNs(),
    clockNs: input.clock.nowNs(),
    environment: input.environment,
    randomSeed: input.randomSeed,
    dispatchedMarketCount: input.dispatchedMarketCount,
    lastDispatchedKey: input.lastDispatchedKey,
    strategy: input.strategy.state(),
    orders: input.orders.listOrders(),
    eventLogDigest: digestEventLog(input.engineEvents),
  });
}

export function assertCheckpointCompatible(checkpoint: BytexRuntimeCheckpoint, randomSeed: string, capsuleHash: string): void {
  if (checkpoint.randomSeed !== randomSeed) {
    throw new Error('checkpoint random seed mismatch');
  }
  if (checkpoint.strategy.capsuleContentHash !== capsuleHash) {
    throw new Error('checkpoint strategy capsule mismatch');
  }
}
