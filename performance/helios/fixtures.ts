/**
 * HELIOS H33 qualification fixtures — lives outside platform to avoid package-boundary imports.
 */

import { interpretMandateLanguage } from '../../packages/agent/src/interpretation.ts';
import { asCustomerId } from '../../packages/domain/src/customer.ts';
import { asJurisdiction } from '../../packages/domain/src/jurisdiction.ts';
import type { UtcInstant } from '../../packages/domain/src/time.ts';
import {
  createEconomicWorkOrderDraft,
  mandateBindingRefFromCompiled,
  workOrderIdFor,
  type EconomicWorkOrder,
  type WorkOrderScope,
} from '../../packages/platform/src/helios/index.ts';
import { compileEconomicMandate, mandateDraftFromInterpretation } from '../../packages/platform/src/mandate/compiler.ts';

export function heliosH33BaseScope(): WorkOrderScope {
  return Object.freeze({
    objectiveClasses: Object.freeze(['RESEARCH', 'FINANCIAL_PROPOSAL'] as const),
    activityClasses: Object.freeze(['RESEARCH', 'FINANCIAL_PROPOSAL'] as const),
    productClasses: Object.freeze(['CASH', 'EQUITIES', 'ETF'] as const),
    capitalCeiling: { minorUnits: '1000000', currency: 'USD' },
    accountIds: Object.freeze(['acct_h33']),
    jurisdiction: asJurisdiction('US'),
    horizonDays: 30,
    toolIds: Object.freeze(['tool_research']),
    modelIds: Object.freeze(['mdl_s3m']),
  });
}

export function heliosH33ActiveWorkOrder(
  customerId: string,
  subjectId: string,
  now: UtcInstant,
  key = 'h33',
): EconomicWorkOrder {
  const interpretation = interpretMandateLanguage({
    subjectId,
    sourceText: 'Keep at least $2,000 liquid. Ask me before any movement over $1,000.',
    now,
  });
  if (!interpretation.ok) throw new Error('interpretation failed');
  const draft = mandateDraftFromInterpretation(interpretation.value, now);
  const compiled = compileEconomicMandate({ draft, now });
  if (!compiled.ok) throw new Error('mandate compile failed');
  const mandate = Object.freeze({ ...compiled.value, state: 'ACTIVE' as const });
  const scope = heliosH33BaseScope();
  const workOrderId = workOrderIdFor(customerId, key);
  return Object.freeze({
    ...createEconomicWorkOrderDraft({
      workOrderId,
      customerId: asCustomerId(customerId),
      subjectId,
      growObjectiveId: 'grow_h33',
      requestedScope: scope,
      mandateRef: mandateBindingRefFromCompiled(mandate, asCustomerId(customerId), now),
      approvalRef: null,
      requiredApprovalClass: 'NONE',
      now,
    }),
    state: 'ACTIVE',
    effectiveScope: scope,
    activatedAt: now,
    updatedAt: now,
  });
}
