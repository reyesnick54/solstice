/**
 * ALPHA06 — dual-lane forward alpha execution realism engine.
 */

import { ENVIRONMENT, LIVE_INVESTMENT_EXECUTION, LIVE_TRADING_ENABLED } from '@solstice/config';
import type { UtcInstant } from '@solstice/domain';

import { computeSignalOnlyReturn } from './signal-lane.ts';
import { alpha06ResultId, executeImplementableReturn } from './implementable-lane.ts';
import { computeSignalToImplementationDecay } from './decay.ts';
import { evaluateAlpha06Promotion } from './promotion-gate.ts';
import {
  ALPHA06_ENGINE_VERSION,
  ALPHA06_RULE_FLAGS,
  ALPHA06_SCHEMA,
} from './taxonomy.ts';
import type { Alpha06ForwardExecutionResult, Alpha06ForwardScenario } from './types.ts';

export function runAlpha06ForwardExecutionRealism(input: {
  readonly scenario: Alpha06ForwardScenario;
  readonly computedAt?: UtcInstant;
}): Alpha06ForwardExecutionResult {
  const signalLane = computeSignalOnlyReturn(input.scenario);
  const { lane: implementableLane, bundle } = executeImplementableReturn(input.scenario);
  const lanes = Object.freeze([signalLane, implementableLane]);
  const decayBps = computeSignalToImplementationDecay(lanes);
  const promotion = evaluateAlpha06Promotion({ scenario: input.scenario, lanes });
  const computedAt = input.computedAt ?? input.scenario.entry.at;

  return Object.freeze({
    resultId: alpha06ResultId(input.scenario.scenarioId, lanes),
    schema: ALPHA06_SCHEMA,
    methodologyVersion: ALPHA06_ENGINE_VERSION,
    scenarioId: input.scenario.scenarioId,
    lanes,
    signalToImplementationDecayBps: decayBps,
    implementable: bundle,
    promotionOutcome: promotion.outcome,
    promote: promotion.promote,
    rules: ALPHA06_RULE_FLAGS,
    computedAt,
  });
}

export function alpha06SimulationPostureOk(): boolean {
  return (
    ENVIRONMENT === 'simulation' &&
    LIVE_TRADING_ENABLED === false &&
    LIVE_INVESTMENT_EXECUTION === false
  );
}
