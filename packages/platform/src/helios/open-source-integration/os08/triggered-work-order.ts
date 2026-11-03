import type { UtcInstant } from '@solstice/domain';
import type { EconomicWorkOrder } from '../../types.ts';
import type { ResearchMonitorTriggerEvent } from '../os07/research-monitor-contract.ts';
import { triggeredResearchWorkOrderIdFor } from './ids.ts';
import { routeTriggerSpecialistClasses } from './specialist-routing.ts';
import type { TriggeredResearchWorkOrder } from './types.ts';

export function buildTriggeredResearchWorkOrder(input: {
  readonly trigger: ResearchMonitorTriggerEvent;
  readonly economicWorkOrder: EconomicWorkOrder;
  readonly approvedBudgetMinor: string;
  readonly now: UtcInstant;
}): TriggeredResearchWorkOrder {
  if (input.economicWorkOrder.customerId !== input.trigger.customerId) {
    throw new Error('trigger customer must match economic work order');
  }
  if (input.economicWorkOrder.state !== 'ACTIVE') {
    throw new Error('economic work order must be ACTIVE for triggered research');
  }
  const routedMeshRoles = routeTriggerSpecialistClasses(input.trigger.requestedSpecialistClasses);
  return Object.freeze({
    triggeredWorkOrderId: triggeredResearchWorkOrderIdFor(input.trigger.idempotencyKey),
    economicWorkOrderId: input.economicWorkOrder.workOrderId,
    triggerEventId: input.trigger.triggerEventId,
    monitorId: input.trigger.monitorId,
    customerId: input.trigger.customerId,
    subjectId: input.trigger.subjectId,
    researchOnly: true,
    grantsExecutionAuthority: false,
    authorizesFinancialExecution: false,
    approvedBudgetMinor: input.approvedBudgetMinor,
    approvedBudgetCurrency: input.trigger.requestedBudgetCurrency,
    requestedSpecialistClasses: Object.freeze([...input.trigger.requestedSpecialistClasses]),
    routedMeshRoles,
    economicWorkOrder: input.economicWorkOrder,
    createdAt: input.now,
  });
}

export function assertResearchOnlyWorkOrder(workOrder: EconomicWorkOrder): void {
  const objectiveClasses = workOrder.effectiveScope?.objectiveClasses ?? workOrder.requestedScope.objectiveClasses;
  if (objectiveClasses.some((row) => row === 'FINANCIAL_PROPOSAL' || row === 'EXECUTION_PREP')) {
    throw new Error('triggered research work orders must not include execution prep or proposal objectives');
  }
  if (workOrder.grantsExecutionAuthority || workOrder.authorizesFinancialExecution) {
    throw new Error('triggered research work orders must not authorize financial execution');
  }
}
