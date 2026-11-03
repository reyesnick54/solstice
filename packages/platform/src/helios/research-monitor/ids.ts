import { createHash } from 'node:crypto';

export type ResearchMonitorId = string & { readonly __brand: 'ResearchMonitorId' };
export type ResearchMonitorManifestId = string & { readonly __brand: 'ResearchMonitorManifestId' };
export type ResearchMonitorEvaluationId = string & { readonly __brand: 'ResearchMonitorEvaluationId' };
export type ResearchMonitorTriggerEventId = string & { readonly __brand: 'ResearchMonitorTriggerEventId' };

export function asResearchMonitorId(value: string): ResearchMonitorId {
  return value as ResearchMonitorId;
}

export function asResearchMonitorManifestId(value: string): ResearchMonitorManifestId {
  return value as ResearchMonitorManifestId;
}

export function asResearchMonitorEvaluationId(value: string): ResearchMonitorEvaluationId {
  return value as ResearchMonitorEvaluationId;
}

export function asResearchMonitorTriggerEventId(value: string): ResearchMonitorTriggerEventId {
  return value as ResearchMonitorTriggerEventId;
}

export function researchMonitorEvaluationIdFor(monitorId: string, evaluatedAt: string, sequence: number): ResearchMonitorEvaluationId {
  const digest = createHash('sha256')
    .update(`${monitorId}:${evaluatedAt}:${sequence}`, 'utf8')
    .digest('hex')
    .slice(0, 24);
  return asResearchMonitorEvaluationId(`hrm_eval_${digest}`);
}

export function researchMonitorTriggerEventIdFor(monitorId: string, fingerprint: string): ResearchMonitorTriggerEventId {
  const digest = createHash('sha256').update(`${monitorId}:${fingerprint}`, 'utf8').digest('hex').slice(0, 24);
  return asResearchMonitorTriggerEventId(`hrm_trig_${digest}`);
}
