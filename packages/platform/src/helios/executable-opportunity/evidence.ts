import type { EvidenceVault } from '../../../../evidence/src/vault.ts';
import type { ExecutableOpportunity } from './types.ts';

export function sealExecutableOpportunityDecision(
  vault: EvidenceVault | undefined,
  kind:
    | 'HELIOS_EXECUTABLE_OPPORTUNITY_EVIDENCE'
    | 'HELIOS_EXECUTABLE_OPPORTUNITY_ELIGIBILITY'
    | 'HELIOS_EXECUTABLE_OPPORTUNITY_ROUTE'
    | 'HELIOS_EXECUTABLE_OPPORTUNITY_QUALIFIED',
  opportunity: ExecutableOpportunity,
  detail: unknown,
): void {
  vault?.seal(kind, {
    executableOpportunityId: opportunity.executableOpportunityId,
    candidateId: opportunity.candidateId,
    workOrderId: opportunity.workOrderId,
    customerId: opportunity.customerId,
    subjectId: opportunity.subjectId,
    state: opportunity.state,
    grantsExecutionAuthority: false,
    authorizesFinancialExecution: false,
    detail,
  });
}
