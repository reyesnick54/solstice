/**
 * Simulator throughput benchmark. Separate from blockchain performance.
 * Large simulation complexity must not alter consensus code.
 */

import { performance } from 'node:perf_hooks';

import { simulateScenario } from './engine.ts';

export function benchmarkSimulator(epochs = 12): {
  readonly epochs: number;
  readonly elapsedMs: number;
  readonly epochsPerSecond: number;
  readonly consensusUntouched: true;
} {
  const started = performance.now();
  simulateScenario('baseline', { epochs, seed: 75 });
  const elapsedMs = performance.now() - started;
  return Object.freeze({
    epochs,
    elapsedMs,
    epochsPerSecond: elapsedMs === 0 ? epochs : epochs / (elapsedMs / 1000),
    consensusUntouched: true,
  });
}
