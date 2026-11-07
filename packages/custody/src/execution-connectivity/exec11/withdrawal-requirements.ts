import { WITHDRAWAL_REQUIREMENT_IDS, type WithdrawalRequirementId } from './taxonomy.ts';
import type { CustodyRailKind, WithdrawalAuthorityEnvelope, WithdrawalRequirementStatus } from './types.ts';

export type WithdrawalRequirementInput = {
  readonly rail: CustodyRailKind;
  readonly customerMandatePresent: boolean;
  readonly destinationValidated: boolean;
  readonly kernelAuthorizationPresent: boolean;
  readonly stepUpSatisfied: boolean;
  readonly complianceScreeningCleared: boolean;
  readonly travelRuleComplete: boolean;
  readonly travelRuleApplicable: boolean;
  readonly custodyProviderAccepted: boolean;
};

function status(requirement: WithdrawalRequirementId, satisfied: boolean, failCode: string): WithdrawalRequirementStatus {
  return Object.freeze({
    requirement,
    satisfied,
    reasonCode: satisfied ? null : failCode,
  });
}

export function evaluateWithdrawalAuthorityRequirements(input: WithdrawalRequirementInput): WithdrawalAuthorityEnvelope {
  const rows: WithdrawalRequirementStatus[] = [
    status('CUSTOMER_MANDATE', input.customerMandatePresent, 'MANDATE_MISSING'),
    status('DESTINATION_VALIDATION', input.destinationValidated, 'DESTINATION_NOT_VALIDATED'),
    status('KERNEL_AUTHORIZATION', input.kernelAuthorizationPresent, 'KERNEL_AUTHORITY_MISSING'),
    status('STEP_UP_AUTHENTICATION', input.stepUpSatisfied, 'STEP_UP_REQUIRED'),
    status('COMPLIANCE_SCREENING', input.complianceScreeningCleared, 'SCREENING_BLOCKED'),
    status(
      'TRAVEL_RULE_WORKFLOW',
      !input.travelRuleApplicable || input.travelRuleComplete,
      'TRAVEL_RULE_INCOMPLETE',
    ),
    status('CUSTODY_PROVIDER_ACCEPTANCE', input.custodyProviderAccepted, 'PROVIDER_NOT_ACCEPTED'),
  ];

  const allSatisfied = rows.every((row) => row.satisfied);
  return Object.freeze({
    requirementStatuses: Object.freeze(rows),
    allSatisfied,
    rail: input.rail,
  });
}

export function withdrawalRequirementsComplete(): readonly WithdrawalRequirementId[] {
  return WITHDRAWAL_REQUIREMENT_IDS;
}
