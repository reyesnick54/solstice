/**
 * Strategy Lab ↔ HELIOS native BYTEX deterministic runtime bridge.
 * Research/backtest path only — no live execution authority.
 */

import { asUtcInstant, type UtcInstant } from '@solstice/domain';
import {
  BytexDeterministicEngine,
  runDeterministicReplay,
  utcInstantToUnixNanos,
  type BytexDeterministicRunInput,
  type BytexDeterministicRunOutcome,
  type BytexRuntimeEnvironment,
} from '../index.ts';

export type StrategyLabBytexObservation = {
  readonly observationId: string;
  readonly instrumentId: string;
  readonly knowableAt: UtcInstant;
  readonly kind: 'QUOTE' | 'TRADE' | 'BAR' | 'BOOK';
  readonly payloadDigest: string;
};

export function strategyLabRunInputFrom(input: {
  readonly runId: string;
  readonly environment: BytexRuntimeEnvironment;
  readonly randomSeed: string;
  readonly capsuleContentHash: string;
  readonly executionAssumptionsDigest: string;
  readonly startAt: UtcInstant;
  readonly observations: readonly StrategyLabBytexObservation[];
}): BytexDeterministicRunInput {
  return Object.freeze({
    runId: input.runId,
    environment: input.environment,
    randomSeed: input.randomSeed,
    capsuleContentHash: input.capsuleContentHash,
    executionAssumptionsDigest: input.executionAssumptionsDigest,
    startAt: input.startAt,
    marketData: Object.freeze(
      input.observations.map((obs) =>
        Object.freeze({
          elementId: obs.observationId,
          createdTimeNs: utcInstantToUnixNanos(obs.knowableAt),
          kind: obs.kind,
          instrumentId: obs.instrumentId,
          payloadDigest: obs.payloadDigest,
        }),
      ),
    ),
  });
}

export function runStrategyLabBytexSimulation(input: {
  readonly runId: string;
  readonly randomSeed: string;
  readonly capsuleContentHash: string;
  readonly executionAssumptionsDigest: string;
  readonly observations: readonly StrategyLabBytexObservation[];
  readonly environment?: BytexRuntimeEnvironment;
}): BytexDeterministicRunOutcome {
  const sorted = [...input.observations].sort((a, b) => Date.parse(a.knowableAt) - Date.parse(b.knowableAt));
  const runInput = strategyLabRunInputFrom({
    runId: input.runId,
    environment: input.environment ?? 'BACKTEST',
    randomSeed: input.randomSeed,
    capsuleContentHash: input.capsuleContentHash,
    executionAssumptionsDigest: input.executionAssumptionsDigest,
    startAt: sorted[0]?.knowableAt ?? asUtcInstant('2026-01-01T00:00:00.000Z'),
    observations: sorted,
  });
  return runDeterministicReplay(runInput);
}

export function runStrategyLabEnvironmentParity(input: {
  readonly runId: string;
  readonly randomSeed: string;
  readonly capsuleContentHash: string;
  readonly executionAssumptionsDigest: string;
  readonly observations: readonly StrategyLabBytexObservation[];
}): readonly BytexDeterministicRunOutcome[] {
  const runInput = strategyLabRunInputFrom({
    runId: input.runId,
    environment: 'BACKTEST',
    randomSeed: input.randomSeed,
    capsuleContentHash: input.capsuleContentHash,
    executionAssumptionsDigest: input.executionAssumptionsDigest,
    startAt: input.observations[0]?.knowableAt ?? asUtcInstant('2026-01-01T00:00:00.000Z'),
    observations: input.observations,
  });
  const engine = new BytexDeterministicEngine(runInput);
  return engine.runWithEnvironmentParity(['BACKTEST', 'SANDBOX', 'LIVE']);
}
