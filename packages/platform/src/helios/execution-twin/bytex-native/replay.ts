import { createHash } from 'node:crypto';

import type { BytexDeterministicRunInput, BytexDeterministicRunOutcome, BytexRuntimeCheckpoint } from './types.ts';
import { BytexDeterministicEngine } from './deterministic-engine.ts';

export function replayDigest(outcome: BytexDeterministicRunOutcome): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        runId: outcome.runId,
        environment: outcome.environment,
        outcomeDigest: outcome.outcomeDigest,
        eventCount: outcome.eventCount,
        finalStrategyPhase: outcome.finalStrategyPhase,
      }),
    )
    .digest('hex');
}

export function runDeterministicReplay(input: BytexDeterministicRunInput): BytexDeterministicRunOutcome {
  const engine = new BytexDeterministicEngine(input);
  return engine.run();
}

export function runFromCheckpoint(input: {
  readonly base: BytexDeterministicRunInput;
  readonly checkpoint: BytexRuntimeCheckpoint;
  readonly resumeAfterDispatchCount: number;
}): BytexDeterministicRunOutcome {
  const engine = new BytexDeterministicEngine(input.base);
  engine.restoreCheckpoint(input.checkpoint, input.resumeAfterDispatchCount);
  return engine.run();
}

export function assertReplayParity(first: BytexDeterministicRunOutcome, second: BytexDeterministicRunOutcome): boolean {
  return first.outcomeDigest === second.outcomeDigest && first.eventCount === second.eventCount;
}
