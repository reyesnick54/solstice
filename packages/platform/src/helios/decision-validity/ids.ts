import type { EconomicWorkOrderId } from '../ids.ts';
import type { OpportunityCandidateId } from '../executable-opportunity/ids.ts';

export type DecisionValidityEnvelopeId = `dve_${string}`;

export function asDecisionValidityEnvelopeId(value: string): DecisionValidityEnvelopeId {
  if (!value.startsWith('dve_')) {
    throw new Error(`invalid DecisionValidityEnvelopeId: ${value}`);
  }
  return value as DecisionValidityEnvelopeId;
}

export function envelopeIdFor(
  candidateId: OpportunityCandidateId,
  key: string,
): DecisionValidityEnvelopeId {
  return asDecisionValidityEnvelopeId(`dve_${candidateId}_${key}`);
}

export function envelopeIdForWorkOrder(
  workOrderId: EconomicWorkOrderId,
  candidateId: OpportunityCandidateId,
  revision: number,
): DecisionValidityEnvelopeId {
  return asDecisionValidityEnvelopeId(`dve_${workOrderId}_${candidateId}_r${revision}`);
}
