import { createHash } from 'node:crypto';

import type { Brand } from '../../../../../domain/src/brand.ts';

export type TriggeredResearchWorkOrderId = Brand<string, 'TriggeredResearchWorkOrderId'>;
export type ResearchTriggerRunId = Brand<string, 'ResearchTriggerRunId'>;

export function asTriggeredResearchWorkOrderId(value: string): TriggeredResearchWorkOrderId {
  if (!value.startsWith('trwo_')) {
    throw new Error('TriggeredResearchWorkOrderId must use trwo_ prefix');
  }
  return value as TriggeredResearchWorkOrderId;
}

export function asResearchTriggerRunId(value: string): ResearchTriggerRunId {
  if (!value.startsWith('rtrun_')) {
    throw new Error('ResearchTriggerRunId must use rtrun_ prefix');
  }
  return value as ResearchTriggerRunId;
}

export function triggeredResearchWorkOrderIdFor(idempotencyKey: string): TriggeredResearchWorkOrderId {
  const digest = createHash('sha256').update(`trwo:${idempotencyKey}`).digest('hex').slice(0, 24);
  return asTriggeredResearchWorkOrderId(`trwo_${digest}`);
}

export function researchTriggerRunIdFor(triggerEventId: string, workOrderId: string): ResearchTriggerRunId {
  const digest = createHash('sha256').update(`${triggerEventId}:${workOrderId}`).digest('hex').slice(0, 24);
  return asResearchTriggerRunId(`rtrun_${digest}`);
}
