/**
 * Durable payment workflow definition for Phase B WorkflowRuntime.
 * A workflow cannot post a journal or issue Execution Authority.
 */

import type { WorkflowDefinition, WorkflowRecord, WorkflowStepResult } from '../../../events/src/workflow.ts';

export const PAYMENT_WORKFLOW_TYPE = 'payment.outbound' as const;

export function paymentOutboundWorkflow(handlers: {
  readonly prepare: (record: WorkflowRecord) => WorkflowStepResult | Promise<WorkflowStepResult>;
  readonly awaitHuman: (record: WorkflowRecord) => WorkflowStepResult | Promise<WorkflowStepResult>;
  readonly awaitCompliance: (record: WorkflowRecord) => WorkflowStepResult | Promise<WorkflowStepResult>;
  readonly awaitProvider: (record: WorkflowRecord) => WorkflowStepResult | Promise<WorkflowStepResult>;
  readonly compensate: (record: WorkflowRecord) => WorkflowStepResult | Promise<WorkflowStepResult>;
}): WorkflowDefinition {
  return Object.freeze({
    workflowType: PAYMENT_WORKFLOW_TYPE,
    steps: Object.freeze([
      { name: 'prepare', kind: 'TASK' as const, run: handlers.prepare },
      { name: 'await_human', kind: 'WAIT_HUMAN' as const, run: handlers.awaitHuman },
      { name: 'await_compliance', kind: 'WAIT_COMPLIANCE' as const, run: handlers.awaitCompliance },
      { name: 'await_provider', kind: 'WAIT_PROVIDER' as const, run: handlers.awaitProvider },
      { name: 'compensate', kind: 'COMPENSATE' as const, compensate: handlers.compensate },
    ]),
  });
}

export function defaultPaymentWorkflowHandlers(): Parameters<typeof paymentOutboundWorkflow>[0] {
  return {
    prepare: (record) => {
      if (record.context['stepUpRequired'] === 'true' || record.context['approvalRequired'] === 'true') {
        return { outcome: 'CONTINUE' };
      }
      return { outcome: 'CONTINUE' };
    },
    awaitHuman: (record) => {
      if (record.context['stepUpSatisfied'] === 'true' || record.context['approvalSatisfied'] === 'true') {
        return { outcome: 'CONTINUE' };
      }
      if (record.context['stepUpRequired'] === 'true' || record.context['approvalRequired'] === 'true') {
        return { outcome: 'WAIT', wait: 'HUMAN' };
      }
      return { outcome: 'CONTINUE' };
    },
    awaitCompliance: (record) => {
      if (record.context['complianceHold'] === 'true') {
        return { outcome: 'WAIT', wait: 'COMPLIANCE' };
      }
      return { outcome: 'CONTINUE' };
    },
    awaitProvider: (record) => {
      if (record.context['providerPending'] === 'true') {
        return { outcome: 'WAIT', wait: 'PROVIDER' };
      }
      return { outcome: 'CONTINUE' };
    },
    compensate: () => ({ outcome: 'CONTINUE' }),
  };
}
