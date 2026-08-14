import type { DomainEventLog } from '../../../packages/events/src/events.ts';
import type { AuthorizationDecision } from '../../../packages/permissions/src/decision.ts';
import type { ActionIntent } from '../../../packages/permissions/src/action-intent.ts';

export function recordKernelDecisionEvent(
  events: DomainEventLog,
  intent: ActionIntent,
  decision: AuthorizationDecision,
  jurisdiction?: string,
): void {
  events.append({
    eventType: 'KernelDecisionRecorded',
    schemaVersion: 1,
    occurredAt: decision.decidedAt,
    intentId: intent.id,
    correlationId: intent.id,
    causationId: intent.id,
    evidenceId: decision.evidenceRecordId,
    jurisdiction: jurisdiction ?? null,
    payload: {
      intentId: intent.id,
      actionType: intent.actionType,
      status: decision.status,
      evidenceRecordId: decision.evidenceRecordId,
      executionAuthorityId: decision.executionAuthority?.authorityId ?? null,
    },
  });
}
