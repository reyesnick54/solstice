import { createHash } from 'node:crypto';

import type { ExecutionTwinEvent, ExecutionTwinGateDecision, ExecutionTwinOrderTransition, ExecutionTwinOutcome } from './types.ts';
import type { ExecutionTwinOrderState, ExecutionTwinRunState } from './taxonomy.ts';
import type { OrderPlanningResult } from '../multi-asset/m22/types.ts';
import type { ExecutionRoutingResult } from '../execution-routing/types.ts';

function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, inner) =>
    typeof inner === 'bigint' ? inner.toString() : inner,
  );
}

export function digestPayload(value: unknown): string {
  return createHash('sha256').update(stableJson(value)).digest('hex').slice(0, 32);
}

export function gateDecisionDigest(decision: ExecutionTwinGateDecision): string {
  return createHash('sha256')
    .update(JSON.stringify({ permitted: decision.permitted, reason: decision.reason, digest: decision.digest }))
    .digest('hex')
    .slice(0, 32);
}

export function computeOutcomeFingerprint(input: {
  readonly planning: OrderPlanningResult | null;
  readonly routing: ExecutionRoutingResult | null;
  readonly orderState: ExecutionTwinOrderState;
  readonly transitions: readonly ExecutionTwinOrderTransition[];
  readonly riskDecision: ExecutionTwinGateDecision;
  readonly mandateDecision: ExecutionTwinGateDecision;
  readonly complianceDecision: ExecutionTwinGateDecision;
  readonly authorityDecision: ExecutionTwinGateDecision;
}): string {
  const material = {
    planningOutcome: input.planning?.outcome ?? null,
    tacticId: input.planning?.tactic?.tacticId ?? null,
    tacticType: input.planning?.tactic?.tacticType ?? null,
    routingOutcome: input.routing?.outcome ?? null,
    selectedProvider: input.routing?.selectedProviderId ?? null,
    orderState: input.orderState,
    transitions: input.transitions.map((row) => `${row.from}->${row.to}:${row.reason}`),
    risk: gateDecisionDigest(input.riskDecision),
    mandate: gateDecisionDigest(input.mandateDecision),
    compliance: gateDecisionDigest(input.complianceDecision),
    authority: gateDecisionDigest(input.authorityDecision),
  };
  return createHash('sha256').update(stableJson(material)).digest('hex');
}

export function buildExecutionTwinOutcome(input: {
  readonly runId: string;
  readonly state: ExecutionTwinRunState;
  readonly planning: OrderPlanningResult | null;
  readonly routing: ExecutionRoutingResult | null;
  readonly orderState: ExecutionTwinOrderState;
  readonly transitions: readonly ExecutionTwinOrderTransition[];
  readonly events: readonly ExecutionTwinEvent[];
  readonly riskDecision: ExecutionTwinGateDecision;
  readonly mandateDecision: ExecutionTwinGateDecision;
  readonly complianceDecision: ExecutionTwinGateDecision;
  readonly authorityDecision: ExecutionTwinGateDecision;
}): ExecutionTwinOutcome {
  const outcomeFingerprint = computeOutcomeFingerprint({
    planning: input.planning,
    routing: input.routing,
    orderState: input.orderState,
    transitions: input.transitions,
    riskDecision: input.riskDecision,
    mandateDecision: input.mandateDecision,
    complianceDecision: input.complianceDecision,
    authorityDecision: input.authorityDecision,
  });
  return Object.freeze({
    ...input,
    outcomeFingerprint,
  });
}
