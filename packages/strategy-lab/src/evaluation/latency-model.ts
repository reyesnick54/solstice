import { err, ok, type Result } from '../../../domain/src/result.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import { addMilliseconds } from './information-time.ts';
import {
  LATENCY_MODEL_VERSION,
  type EvaluationFailure,
  type LatencyModelSpec,
} from './types.ts';

export const DEFAULT_CONSERVATIVE_LATENCY: LatencyModelSpec = Object.freeze({
  version: LATENCY_MODEL_VERSION,
  observationToDecisionMs: 100,
  decisionToProposalMs: 50,
  proposalToExecutionEligibilityMs: 200,
  zeroLatencyAssumed: false,
});

export type ExecutionTimeline = {
  readonly observationAvailableAt: UtcInstant;
  readonly decisionAt: UtcInstant;
  readonly proposalAt: UtcInstant;
  readonly executionEligibilityAt: UtcInstant;
  readonly latencyModelVersion: typeof LATENCY_MODEL_VERSION;
};

export function validateLatencyModel(model: LatencyModelSpec): Result<LatencyModelSpec, EvaluationFailure> {
  if (model.zeroLatencyAssumed) {
    return err({
      code: 'ZERO_LATENCY_FORBIDDEN',
      message: 'zero latency must not be assumed by default in chronological evaluation',
    });
  }
  if (
    model.observationToDecisionMs < 0 ||
    model.decisionToProposalMs < 0 ||
    model.proposalToExecutionEligibilityMs < 0
  ) {
    return err({
      code: 'ZERO_LATENCY_FORBIDDEN',
      message: 'latency components must be non-negative',
    });
  }
  return ok(model);
}

export function buildExecutionTimeline(input: {
  readonly observationAvailableAt: UtcInstant;
  readonly latency: LatencyModelSpec;
}): ExecutionTimeline {
  const decisionAt = addMilliseconds(
    input.observationAvailableAt,
    input.latency.observationToDecisionMs,
  );
  const proposalAt = addMilliseconds(decisionAt, input.latency.decisionToProposalMs);
  const executionEligibilityAt = addMilliseconds(
    proposalAt,
    input.latency.proposalToExecutionEligibilityMs,
  );
  return Object.freeze({
    observationAvailableAt: input.observationAvailableAt,
    decisionAt,
    proposalAt,
    executionEligibilityAt,
    latencyModelVersion: LATENCY_MODEL_VERSION,
  });
}
