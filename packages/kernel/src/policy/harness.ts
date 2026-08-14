import type { UtcInstant } from '../../../domain/src/time.ts';
import type { ActionIntent } from '../../../permissions/src/action-intent.ts';
import type { DecisionStatus } from '../../../permissions/src/decision.ts';
import type { KernelFacts } from '../proofs.ts';
import { PolicyEngine } from './engine.ts';

export type PolicyScenario = {
  readonly name: string;
  readonly intent: ActionIntent;
  readonly facts: KernelFacts;
  readonly at: UtcInstant;
  readonly expected: DecisionStatus;
  readonly expectedReasons?: readonly string[];
};

export type PolicyScenarioResult = {
  readonly name: string;
  readonly expected: DecisionStatus;
  readonly actual: DecisionStatus;
  readonly passed: boolean;
  readonly reasonCodes: readonly string[];
};

export function runPolicyScenarios(
  engine: PolicyEngine,
  scenarios: readonly PolicyScenario[],
): readonly PolicyScenarioResult[] {
  return scenarios.map((scenario) => {
    const result = engine.evaluate(scenario.intent, scenario.facts, scenario.at);
    const reasonsOk =
      !scenario.expectedReasons ||
      scenario.expectedReasons.every((code) => result.reasonCodes.includes(code));
    return Object.freeze({
      name: scenario.name,
      expected: scenario.expected,
      actual: result.decision,
      passed: result.decision === scenario.expected && reasonsOk,
      reasonCodes: result.reasonCodes,
    });
  });
}
