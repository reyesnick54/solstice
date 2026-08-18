/**
 * Replay a failed scenario from scenario ID, seed, policy versions,
 * and input fixture hash.
 */

import { runEconomicStressScenario } from './engine.ts';
import { fixtureHash } from './invariants.ts';
import type { EconomicStressResult } from './types.ts';

export function replayStressScenario(input: {
  readonly scenarioId: string;
  readonly seed: number;
  readonly expectedFixtureHash?: string;
}): EconomicStressResult {
  const result = runEconomicStressScenario(input.scenarioId, { seed: input.seed });
  const expected = input.expectedFixtureHash ?? fixtureHash(result.scenarioId, result.seed, result.policyVersions);
  if (result.inputFixtureHash !== expected) {
    throw new Error(`replay fixture hash mismatch for ${input.scenarioId}`);
  }
  return result;
}
