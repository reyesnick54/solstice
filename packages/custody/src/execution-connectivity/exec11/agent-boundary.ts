import {
  aiApproveWithdrawal,
  aiModifyAllowlist,
} from '../../provider-candidate/signing-policy.ts';
import type { AgentAllowedWithdrawalAction, AgentForbiddenWithdrawalAction } from './taxonomy.ts';
import type { AgentWithdrawalBoundaryResult } from './types.ts';

export function authorizeAgentWithdrawalAction(
  action: AgentAllowedWithdrawalAction | AgentForbiddenWithdrawalAction,
): AgentWithdrawalBoundaryResult {
  if (action === 'PREPARE_WITHDRAWAL_PROPOSAL') {
    return Object.freeze({ outcome: 'ALLOWED', action: 'PREPARE_WITHDRAWAL_PROPOSAL' });
  }
  if (action === 'EXPLAIN_WITHDRAWAL_STATUS') {
    return Object.freeze({ outcome: 'ALLOWED', action: 'EXPLAIN_WITHDRAWAL_STATUS' });
  }

  const forbidden = action as AgentForbiddenWithdrawalAction;
  switch (forbidden) {
    case 'CREATE_DESTINATION': {
      const denied = aiModifyAllowlist();
      return Object.freeze({
        outcome: 'DENIED',
        action: forbidden,
        code: denied.ok ? 'UNEXPECTED' : denied.error.code,
      });
    }
    case 'CHANGE_BENEFICIARY':
      return Object.freeze({
        outcome: 'DENIED',
        action: forbidden,
        code: 'AI_CANNOT_CHANGE_BENEFICIARY',
      });
    case 'BYPASS_STEP_UP':
      return Object.freeze({
        outcome: 'DENIED',
        action: forbidden,
        code: 'AI_CANNOT_BYPASS_STEP_UP',
      });
    case 'OVERRIDE_COMPLIANCE':
      return Object.freeze({
        outcome: 'DENIED',
        action: forbidden,
        code: 'AI_CANNOT_OVERRIDE_COMPLIANCE',
      });
    case 'OVERRIDE_TRAVEL_RULE':
      return Object.freeze({
        outcome: 'DENIED',
        action: forbidden,
        code: 'AI_CANNOT_OVERRIDE_TRAVEL_RULE',
      });
    case 'APPROVE_OWN_WITHDRAWAL': {
      const denied = aiApproveWithdrawal();
      return Object.freeze({
        outcome: 'DENIED',
        action: forbidden,
        code: denied.ok ? 'UNEXPECTED' : denied.error.code,
      });
    }
    default: {
      const _exhaustive: never = forbidden;
      return _exhaustive;
    }
  }
}
