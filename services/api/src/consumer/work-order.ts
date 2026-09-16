import type { EconomicWorkOrderService } from '../../../../packages/platform/src/work-order/service.ts';
import type { CreateEconomicWorkOrderInput, EconomicWorkOrder } from '../../../../packages/platform/src/work-order/types.ts';
import { bffError, type BffErrorEnvelope } from './errors.ts';
import type { BffPrincipal } from './ports.ts';

export type WorkOrderBffPort = {
  list(principal: BffPrincipal, requestId: string): unknown | BffErrorEnvelope;
  get(principal: BffPrincipal, workOrderId: string, requestId: string): unknown | BffErrorEnvelope;
  create(
    principal: BffPrincipal,
    body: Record<string, unknown>,
    requestId: string,
  ): unknown | BffErrorEnvelope;
};

function mapFailure(
  code: string,
  message: string,
  requestId: string,
): BffErrorEnvelope {
  if (code === 'CUSTOMER_MISMATCH' || code === 'ACTOR_UNAUTHORIZED') {
    return bffError({
      errorCode: 'RESOURCE_NOT_OWNED',
      category: 'AUTHORIZATION',
      message,
      retryable: false,
      requestId,
    });
  }
  if (code === 'WORK_ORDER_NOT_FOUND') {
    return bffError({
      errorCode: 'NOT_FOUND',
      category: 'NOT_FOUND',
      message,
      retryable: false,
      requestId,
    });
  }
  return bffError({
    errorCode: 'VALIDATION',
    category: 'VALIDATION',
    message,
    retryable: false,
    requestId,
  });
}

function projectWorkOrder(workOrder: EconomicWorkOrder): Record<string, unknown> {
  return Object.freeze({
    schema: 'sunrey.consumer.grow.work_order.v1',
    workOrderId: workOrder.workOrderId,
    customerId: workOrder.customerId,
    subjectId: workOrder.subjectId,
    state: workOrder.state,
    revision: workOrder.revision,
    planId: workOrder.planId,
    planVersion: workOrder.planVersion,
    objective: workOrder.objective,
    capitalBoundary: workOrder.capitalBoundary,
    researchBoundary: workOrder.researchBoundary,
    actionBoundary: workOrder.actionBoundary,
    completion: workOrder.completion,
    authorityReferences: workOrder.authorityReferences,
    environment: workOrder.environment,
    createsFinancialAuthority: false,
    postsLedger: false,
    productionMoneyMovement: false,
    createdAt: workOrder.createdAt,
    updatedAt: workOrder.updatedAt,
  });
}

export function createWorkOrderBffPort(input: {
  readonly service: EconomicWorkOrderService;
  readonly actorFor: (principal: BffPrincipal) => unknown;
}): WorkOrderBffPort {
  return {
    list(principal, requestId) {
      const listed = input.service.listEconomicWorkOrders(
        input.actorFor(principal),
        principal.customerId,
        principal.identityId,
      );
      if (!listed.ok) {
        return mapFailure(listed.error.code, listed.error.message, requestId);
      }
      return Object.freeze({
        schema: 'sunrey.consumer.grow.work_order_list.v1',
        items: listed.value.map(projectWorkOrder),
        productionMoneyMovement: false,
      });
    },
    get(principal, workOrderId, requestId) {
      const loaded = input.service.getEconomicWorkOrder(
        input.actorFor(principal),
        workOrderId,
        principal.customerId,
      );
      if (!loaded.ok) {
        return mapFailure(loaded.error.code, loaded.error.message, requestId);
      }
      return projectWorkOrder(loaded.value);
    },
    create(principal, body, requestId) {
      const inputBody = body as Partial<CreateEconomicWorkOrderInput>;
      if (!inputBody.idempotencyKey || typeof inputBody.idempotencyKey !== 'string') {
        return bffError({
          errorCode: 'VALIDATION',
          category: 'VALIDATION',
          message: 'idempotencyKey is required',
          retryable: false,
          requestId,
        });
      }
      if (!inputBody.objective || !inputBody.authorityReferences || !inputBody.capitalBoundary) {
        return bffError({
          errorCode: 'VALIDATION',
          category: 'VALIDATION',
          message: 'objective, authorityReferences, and capitalBoundary are required',
          retryable: false,
          requestId,
        });
      }
      const created = input.service.createEconomicWorkOrder(input.actorFor(principal), {
        subjectId: principal.identityId,
        customerId: principal.customerId,
        idempotencyKey: inputBody.idempotencyKey,
        planId: inputBody.planId ?? null,
        planVersion: inputBody.planVersion ?? null,
        objectiveReference: inputBody.objectiveReference ?? null,
        objective: inputBody.objective,
        authorityReferences: inputBody.authorityReferences,
        capitalBoundary: inputBody.capitalBoundary,
        researchBoundary: inputBody.researchBoundary ?? {
          budgetReference: null,
          budgetUnits: Object.freeze([]),
          deadline: null,
          permittedCategories: Object.freeze([]),
          permittedToolClasses: Object.freeze([]),
          permittedModelClasses: Object.freeze([]),
          maxConcurrency: 1,
          stopConditions: Object.freeze([]),
        },
        actionBoundary: inputBody.actionBoundary ?? {
          permittedActionCategories: Object.freeze(['RESEARCH']),
          unrestrictedFinancialMutation: false,
          agentAuthorityEscalation: false,
        },
        completion: inputBody.completion ?? {
          completionCriteria: Object.freeze(['complete']),
          expirationAt: null,
        },
      });
      if (!created.ok) {
        return mapFailure(created.error.code, created.error.message, requestId);
      }
      return projectWorkOrder(created.value);
    },
  };
}
