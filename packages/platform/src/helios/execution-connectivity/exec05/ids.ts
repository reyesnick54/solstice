import { createHash } from 'node:crypto';

export type SmartRoutingDecisionId = string & { readonly __brand: 'SmartRoutingDecisionId' };

export function asSmartRoutingDecisionId(value: string): SmartRoutingDecisionId {
  return value as SmartRoutingDecisionId;
}

export function smartRoutingDecisionIdFor(requestId: string, at: string): SmartRoutingDecisionId {
  const digest = createHash('sha256').update(`${requestId}|${at}|exec05`).digest('hex').slice(0, 24);
  return asSmartRoutingDecisionId(`sroute_${digest}`);
}

export function bestExecutionEvidenceIdFor(windowStart: string, windowEnd: string): string {
  const digest = createHash('sha256').update(`${windowStart}|${windowEnd}|exec05_review`).digest('hex').slice(0, 24);
  return `bex_${digest}`;
}
