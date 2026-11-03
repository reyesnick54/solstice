import { createHash } from 'node:crypto';

import { type Brand, brandAs } from '@solstice/domain';

export type TriggeredResearchWorkOrderId = Brand<string, 'TriggeredResearchWorkOrderId'>;
export type ResearchTriggerRunId = Brand<string, 'ResearchTriggerRunId'>;

const PREFIX = {
  TriggeredResearchWorkOrderId: 'trwo_',
  ResearchTriggerRunId: 'rtrun_',
} as const;

function brandPrefixed<Name extends keyof typeof PREFIX>(value: string, name: Name): Brand<string, Name> {
  if (value.length === 0 || !value.startsWith(PREFIX[name])) {
    throw new TypeError(`${name} must start with ${PREFIX[name]}`);
  }
  return brandAs<string, Name>(value);
}

export function asTriggeredResearchWorkOrderId(value: string): TriggeredResearchWorkOrderId {
  return brandPrefixed(value, 'TriggeredResearchWorkOrderId');
}

export function asResearchTriggerRunId(value: string): ResearchTriggerRunId {
  return brandPrefixed(value, 'ResearchTriggerRunId');
}

export function triggeredResearchWorkOrderIdFor(idempotencyKey: string): TriggeredResearchWorkOrderId {
  const digest = createHash('sha256').update(`trwo:${idempotencyKey}`).digest('hex').slice(0, 24);
  return asTriggeredResearchWorkOrderId(`trwo_${digest}`);
}

export function researchTriggerRunIdFor(triggerEventId: string, workOrderId: string): ResearchTriggerRunId {
  const digest = createHash('sha256').update(`${triggerEventId}:${workOrderId}`).digest('hex').slice(0, 24);
  return asResearchTriggerRunId(`rtrun_${digest}`);
}
