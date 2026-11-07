import { createHash } from 'node:crypto';

export function preTradeExecutionDecisionIdFor(requestId: string, evaluatedAt: string): string {
  return `pted_${createHash('sha256').update(`${requestId}|${evaluatedAt}`).digest('hex').slice(0, 24)}`;
}
