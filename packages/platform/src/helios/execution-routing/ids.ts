import { createHash } from 'node:crypto';

export type ExecutionRoutingDecisionId = string & { readonly __brand: 'ExecutionRoutingDecisionId' };

export function asExecutionRoutingDecisionId(value: string): ExecutionRoutingDecisionId {
  return value as ExecutionRoutingDecisionId;
}

export function executionRoutingDecisionIdFor(requestId: string, at: string): ExecutionRoutingDecisionId {
  const digest = createHash('sha256').update(`${requestId}:${at}`).digest('hex').slice(0, 24);
  return asExecutionRoutingDecisionId(`eroute_${digest}`);
}

export function executionRoutingEvidenceRef(decisionId: ExecutionRoutingDecisionId): string {
  return `ev_exec_route_${decisionId.slice('eroute_'.length)}`;
}
