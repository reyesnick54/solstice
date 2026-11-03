/**
 * H20 Value-of-Information gate for monitor-triggered research budgets.
 */

import { evaluateResearchValue, researchSpendFromAssessment } from '../../meta-allocator/research-value.ts';
import type { ResearchBudgetSnapshot } from '../../execution-types.ts';
import type { ResearchSpendDecision } from '../../meta-allocator/taxonomy.ts';
import type { ResearchValueAssessment, ResearchValueInput } from '../../meta-allocator/types.ts';
import type { ResearchMonitorTriggerEvent } from '../os07/research-monitor-contract.ts';
import type { ResearchTriggerRouterInput } from './types.ts';

export type TriggerVoiDecision = {
  readonly assessment: ResearchValueAssessment;
  readonly spendDecision: ResearchSpendDecision;
  readonly approvedBudgetMinor: string;
  readonly denied: boolean;
  readonly reduced: boolean;
};

export function evaluateTriggerValueOfInformation(input: {
  readonly trigger: ResearchMonitorTriggerEvent;
  readonly researchBudget: ResearchBudgetSnapshot;
  readonly voiContext: ResearchTriggerRouterInput['voiContext'];
}): TriggerVoiDecision {
  const valueInput: ResearchValueInput = Object.freeze({
    estimatedResearchCostMinor: input.trigger.requestedBudgetMinor,
    evidenceQuality: input.trigger.availableInformation.evidenceQuality,
    dataAvailable: input.trigger.availableInformation.dataAvailable,
    confidenceState: input.trigger.confidenceBefore,
    ...input.voiContext,
  });
  const assessment = evaluateResearchValue(valueInput, input.researchBudget, null);
  const spend = researchSpendFromAssessment(assessment, valueInput, input.researchBudget);
  const requested = BigInt(input.trigger.requestedBudgetMinor);
  const approvedCap = BigInt(spend.maxSpendMinor);
  let approvedBudgetMinor = spend.maxSpendMinor;
  let reduced = false;
  if (approvedCap > 0n && approvedCap < requested) {
    reduced = true;
    approvedBudgetMinor = spend.maxSpendMinor;
  }
  const denied =
    spend.decision === 'DO_NOT_RESEARCH' ||
    spend.decision === 'WAIT_FOR_DATA' ||
    approvedCap <= 0n;
  return Object.freeze({
    assessment,
    spendDecision: spend.decision,
    approvedBudgetMinor,
    denied,
    reduced,
  });
}
