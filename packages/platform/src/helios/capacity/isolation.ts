/**
 * HELIOS H33 — multi-customer isolation under concurrent load.
 */

import { asCustomerId, type UtcInstant } from '@solstice/domain';
import {
  HeliosMetaAllocatorService,
  InMemoryHeliosMetaAllocatorStore,
  initialBudgetSnapshot,
  metaAllocationRunIdFor,
  workOrderIdFor,
  type EconomicWorkOrder,
  type WorkOrderScope,
} from '../index.ts';
import { buildPortfolioInteractionCandidate } from './portfolio-interaction.ts';
import type { CustomerIsolationResult } from './types.ts';

function activeWorkOrder(
  customerId: string,
  subjectId: string,
  scope: WorkOrderScope,
  now: UtcInstant,
  mandateRef: EconomicWorkOrder['mandateRef'],
): EconomicWorkOrder {
  return Object.freeze({
    workOrderId: workOrderIdFor(customerId, `h33_iso_${subjectId}`),
    customerId: asCustomerId(customerId),
    subjectId,
    growObjectiveId: `grow_${customerId}`,
    state: 'ACTIVE',
    requestedScope: scope,
    effectiveScope: scope,
    mandateRef,
    approvalRef: null,
    requiredApprovalClass: 'NONE',
    activatedAt: now,
    updatedAt: now,
    createdAt: now,
    contentHash: `hash_${customerId}`,
    grantsExecutionAuthority: false as const,
    authorizesFinancialExecution: false as const,
  });
}

export async function runMultiCustomerIsolationTest(input: {
  readonly customerCount: number;
  readonly scope: WorkOrderScope;
  readonly now: UtcInstant;
  readonly mandateRef: EconomicWorkOrder['mandateRef'];
}): Promise<CustomerIsolationResult> {
  const store = new InMemoryHeliosMetaAllocatorStore();
  const service = new HeliosMetaAllocatorService({ store });
  const crossCustomerLeaks: string[] = [];
  const balanceCorruption: string[] = [];
  const proposalLeakage: string[] = [];

  const budget = initialBudgetSnapshot({
    ceilingAmount: '5000',
    unitKind: 'MONETARY_MINOR',
    currency: 'USD',
  });

  const customerIds = Array.from({ length: input.customerCount }, (_, index) => `cust_h33_iso_${index}`);

  await Promise.all(
    customerIds.map(async (customerId, index) => {
      const workOrder = activeWorkOrder(customerId, `subj_${index}`, input.scope, input.now, input.mandateRef);
      const availableMinor = `${(index + 1) * 100000}`;
      const result = service.evaluate({
        runId: metaAllocationRunIdFor(workOrder.workOrderId, 'iso_run'),
        workOrder,
        candidates: [
          buildPortfolioInteractionCandidate(workOrder, 'iso_c1', '50000'),
        ],
        researchBudget: budget,
        accountState: Object.freeze({
          accountId: `acct_${customerId}`,
          availableCashMinor: availableMinor,
          currency: 'USD',
          reservedCashMinor: '0',
          accountSizeMinor: availableMinor,
          stateVersion: 'acct_v1',
          capturedAt: input.now,
        }),
        portfolio: Object.freeze({
          exposures: Object.freeze([]),
          sectorConcentrationBps: Object.freeze({}),
          currencyConcentrationBps: Object.freeze({ USD: 0 }),
          liquidityRequirementMinor: '10000',
          mandateConstraintRefs: Object.freeze([]),
          stateVersion: 'port_v1',
        }),
        maxSectorConcentrationBps: 8000,
        now: input.now,
      });

      if (!result.ok) {
        crossCustomerLeaks.push(`${customerId}: evaluation failed ${result.error.message}`);
        return;
      }

      for (const decision of result.value.decisions) {
        if (decision.customerId !== workOrder.customerId) {
          crossCustomerLeaks.push(
            `decision ${decision.decisionId} customer ${decision.customerId} != work order ${workOrder.customerId}`,
          );
        }
      }

      for (const claim of result.value.coordinationClaims) {
        const candidate = result.value.decisions.find((row) => row.candidateId === claim.candidateId);
        if (candidate && candidate.customerId !== workOrder.customerId) {
          proposalLeakage.push(`claim ${claim.candidateId} crossed customers`);
        }
      }

      const runs = store.listRunsForCustomer(asCustomerId(customerId));
      for (const run of runs) {
        if (run.customerId !== asCustomerId(customerId)) {
          crossCustomerLeaks.push(`run ${run.runId} stored under wrong customer`);
        }
        for (const decision of run.decisions) {
          if (decision.customerId !== asCustomerId(customerId)) {
            proposalLeakage.push(`stored decision ${decision.decisionId} leaked`);
          }
        }
      }
    }),
  );

  for (const customerId of customerIds) {
    const runs = store.listRunsForCustomer(asCustomerId(customerId));
    for (const otherId of customerIds) {
      if (otherId === customerId) continue;
      const otherRuns = store.listRunsForCustomer(asCustomerId(otherId));
      for (const run of runs) {
        for (const otherRun of otherRuns) {
          if (run.runId === otherRun.runId) {
            crossCustomerLeaks.push(`shared run id ${run.runId}`);
          }
        }
      }
    }
  }

  return Object.freeze({
    passed:
      crossCustomerLeaks.length === 0 &&
      balanceCorruption.length === 0 &&
      proposalLeakage.length === 0,
    customersTested: input.customerCount,
    crossCustomerLeaks: Object.freeze(crossCustomerLeaks),
    balanceCorruption: Object.freeze(balanceCorruption),
    proposalLeakage: Object.freeze(proposalLeakage),
  });
}
