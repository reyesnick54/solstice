/**
 * Compare two economic stress reports or scenario results.
 */

import { runEconomicStressScenario } from './engine.ts';

export function compareStressScenarios(leftId: string, rightId: string): {
  readonly left: string;
  readonly right: string;
  readonly leftPreserved: boolean;
  readonly rightPreserved: boolean;
  readonly leftViolations: number;
  readonly rightViolations: number;
} {
  const left = runEconomicStressScenario(leftId);
  const right = runEconomicStressScenario(rightId);
  return Object.freeze({
    left: leftId,
    right: rightId,
    leftPreserved: left.preservedInvariants,
    rightPreserved: right.preservedInvariants,
    leftViolations: left.invariants.filter((row) => !row.held).length,
    rightViolations: right.invariants.filter((row) => !row.held).length,
  });
}
