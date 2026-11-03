import type { CustomerId } from '../../../../domain/src/customer.ts';
import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { EconomicWorkOrderId } from '../ids.ts';
import type { AgentActionAudit } from './types.ts';
import { newAgentActionAuditId, type AgentCapabilityGrantId, type AgentResearchSessionId } from './ids.ts';
import type { AgentActionAuditKind } from './taxonomy.ts';

export function recordAgentActionAudit(input: {
  readonly kind: AgentActionAuditKind;
  readonly customerId: CustomerId;
  readonly sessionId?: AgentResearchSessionId | null;
  readonly grantId?: AgentCapabilityGrantId | null;
  readonly workOrderId?: EconomicWorkOrderId | null;
  readonly detail: string;
  readonly payload?: Readonly<Record<string, string | number | boolean | null>>;
  readonly now: UtcInstant;
}): AgentActionAudit {
  return Object.freeze({
    auditId: newAgentActionAuditId(),
    kind: input.kind,
    customerId: input.customerId,
    sessionId: input.sessionId ?? null,
    grantId: input.grantId ?? null,
    workOrderId: input.workOrderId ?? null,
    detail: input.detail,
    payload: Object.freeze({ ...(input.payload ?? {}) }),
    recordedAt: input.now,
  });
}
