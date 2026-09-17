import type { EvidenceVault } from '../../../../evidence/src/vault.ts';
import type { DecisionValidityEnvelope } from './types.ts';

export function sealDecisionValidityEnvelope(
  vault: EvidenceVault | undefined,
  envelope: DecisionValidityEnvelope,
): void {
  vault?.seal('HELIOS_DECISION_VALIDITY_ENVELOPE', {
    envelopeId: envelope.envelopeId,
    candidateId: envelope.candidateId,
    workOrderId: envelope.workOrderId,
    customerId: envelope.customerId,
    overallStatus: envelope.overallStatus,
    validUntil: envelope.validUntil,
    policyVersion: envelope.policyVersion,
    componentChecks: envelope.componentChecks,
    grantsFinancialEffect: false,
    grantsExecutionAuthority: false,
    authorizesFinancialExecution: false,
  });
}
