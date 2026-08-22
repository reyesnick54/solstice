/**
 * Card authorization bridge.
 *
 * Provider request → signature/auth validation → normalize →
 * card/domain policy → balance/hold decision → response mapping.
 *
 * Timing is measured. Controls are never bypassed for latency.
 */

import type { CardAuthorizationRequest } from '../authorization.ts';
import type { ProcessorAuthorizationDecision } from '../processor.ts';

export const AUTHORIZATION_BRIDGE_STEPS = [
  'SIGNATURE_VALIDATION',
  'NORMALIZE',
  'CARD_POLICY',
  'BALANCE_HOLD_DECISION',
  'RESPONSE_MAPPING',
] as const;
export type AuthorizationBridgeStep = (typeof AUTHORIZATION_BRIDGE_STEPS)[number];

export type AuthorizationBridgeStepTrace = {
  readonly step: AuthorizationBridgeStep;
  readonly startedAtNs: bigint;
  readonly elapsedNs: bigint;
};

export type AuthorizationBridgeResult = {
  readonly request: CardAuthorizationRequest;
  readonly decision: ProcessorAuthorizationDecision;
  readonly steps: readonly AuthorizationBridgeStepTrace[];
  readonly totalElapsedNs: bigint;
  readonly bypassedControls: false;
};

export type AuthorizationBridgePorts = {
  readonly validateSignature: (request: CardAuthorizationRequest) => boolean;
  readonly normalize: (request: CardAuthorizationRequest) => CardAuthorizationRequest;
  readonly evaluatePolicy: (request: CardAuthorizationRequest) => ProcessorAuthorizationDecision | null;
  readonly decideBalanceHold: (request: CardAuthorizationRequest) => ProcessorAuthorizationDecision;
  readonly mapResponse: (decision: ProcessorAuthorizationDecision) => ProcessorAuthorizationDecision;
};

export function runAuthorizationBridge(
  request: CardAuthorizationRequest,
  ports: AuthorizationBridgePorts,
  nowNs: () => bigint = defaultNowNs,
): AuthorizationBridgeResult {
  const steps: AuthorizationBridgeStepTrace[] = [];
  const started = nowNs();

  const valid = timed('SIGNATURE_VALIDATION', nowNs, steps, () => ports.validateSignature(request));
  if (!valid) {
    const decision = ports.mapResponse({ approved: false, externalReason: 'INVALID_SIGNATURE' });
    return finish(request, decision, steps, started, nowNs);
  }

  const normalized = timed('NORMALIZE', nowNs, steps, () => ports.normalize(request));
  const policy = timed('CARD_POLICY', nowNs, steps, () => ports.evaluatePolicy(normalized));
  const hold = policy ?? timed('BALANCE_HOLD_DECISION', nowNs, steps, () => ports.decideBalanceHold(normalized));
  if (policy) {
    timed('BALANCE_HOLD_DECISION', nowNs, steps, () => hold);
  }
  const mapped = timed('RESPONSE_MAPPING', nowNs, steps, () => ports.mapResponse(hold));
  return finish(normalized, mapped, steps, started, nowNs);
}

function timed<T>(
  step: AuthorizationBridgeStep,
  nowNs: () => bigint,
  steps: AuthorizationBridgeStepTrace[],
  fn: () => T,
): T {
  const startedAtNs = nowNs();
  const value = fn();
  steps.push(Object.freeze({ step, startedAtNs, elapsedNs: nowNs() - startedAtNs }));
  return value;
}

function finish(
  request: CardAuthorizationRequest,
  decision: ProcessorAuthorizationDecision,
  steps: AuthorizationBridgeStepTrace[],
  started: bigint,
  nowNs: () => bigint,
): AuthorizationBridgeResult {
  return Object.freeze({
    request,
    decision,
    steps: Object.freeze([...steps]),
    totalElapsedNs: nowNs() - started,
    bypassedControls: false,
  });
}

function defaultNowNs(): bigint {
  return process.hrtime.bigint();
}
