import type { UtcInstant } from '../../../domain/src/time.ts';
import type { CompiledEconomicMandate } from '../mandate/types.ts';
import { isTerminalMandate } from '../mandate/lifecycle.ts';
import type { WorkOrderState } from './taxonomy.ts';
import type { EconomicWorkOrder } from './types.ts';

export type RevocationEffect = {
  readonly allowNewDependentWork: false;
  readonly allowQueuedAuthorization: false;
  readonly stopNonFinancialResearch: boolean;
  readonly preserveAuditHistory: true;
  readonly reverseSubmittedFinancialOperations: false;
  readonly nextState: WorkOrderState;
};

export function revocationEffectForMandate(
  mandate: CompiledEconomicMandate,
  workOrder: EconomicWorkOrder,
): RevocationEffect | null {
  if (!isTerminalMandate(mandate.state)) {
    return null;
  }
  const stopResearch =
    workOrder.effectiveScope?.activityClasses.includes('RESEARCH') === true ||
    workOrder.requestedScope.activityClasses.includes('RESEARCH');
  const nextState: WorkOrderState =
    mandate.state === 'REVOKED' ? 'REVOKED' : mandate.state === 'EXPIRED' ? 'EXPIRED' : 'BLOCKED';
  return Object.freeze({
    allowNewDependentWork: false,
    allowQueuedAuthorization: false,
    stopNonFinancialResearch: stopResearch,
    preserveAuditHistory: true,
    reverseSubmittedFinancialOperations: false,
    nextState,
  });
}

export function applyRevocationToWorkOrder(
  workOrder: EconomicWorkOrder,
  nextState: WorkOrderState,
  now: UtcInstant,
): EconomicWorkOrder {
  return Object.freeze({
    ...workOrder,
    state: nextState,
    effectiveScope: workOrder.state === 'ACTIVE' ? workOrder.effectiveScope : null,
    updatedAt: now,
  });
}
