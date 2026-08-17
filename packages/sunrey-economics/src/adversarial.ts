/**
 * Selected Chunk 57 range scenarios integrated with the dual-economy lab.
 */

import { runScenarioIsolated } from '../../sunrey-range/src/catalog.ts';
import { ADVERSARIAL_RANGE_IDS } from './ids.ts';

export function runAdversarialSmoke(): {
  readonly scenarioIds: readonly string[];
  readonly passed: number;
  readonly failed: number;
  readonly results: readonly { readonly scenarioId: string; readonly passed: boolean; readonly attackBlocked: boolean }[];
} {
  const results = ADVERSARIAL_RANGE_IDS.map((scenarioId) => {
    const result = runScenarioIsolated(scenarioId);
    return Object.freeze({
      scenarioId,
      passed: result.passed,
      attackBlocked: result.attackBlocked,
    });
  });
  return Object.freeze({
    scenarioIds: ADVERSARIAL_RANGE_IDS,
    passed: results.filter((row) => row.passed).length,
    failed: results.filter((row) => !row.passed).length,
    results: Object.freeze(results),
  });
}
