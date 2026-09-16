import { Money } from '../../../money/src/money.ts';
import type { CreateEconomicWorkOrderInput, WorkOrderFailure } from './types.ts';

export function validateCapitalBoundary(
  boundary: CreateEconomicWorkOrderInput['capitalBoundary'],
): WorkOrderFailure | null {
  if (!boundary.isAuthorizationEnvelope || boundary.isBalance) {
    return { code: 'CAPITAL_ENVELOPE_INVALID', message: 'capital boundary must be an authorization envelope, not a balance' };
  }
  try {
    const amount = Money.fromMinorUnitsString(
      boundary.maxCapitalEnvelope.minorUnits,
      boundary.maxCapitalEnvelope.currency,
    );
    if (amount.minorUnits < 0n) {
      return { code: 'CAPITAL_ENVELOPE_INVALID', message: 'capital envelope cannot be negative' };
    }
  } catch {
    return { code: 'CAPITAL_ENVELOPE_INVALID', message: 'invalid money representation for capital envelope' };
  }
  return null;
}

export function validateCreateInput(input: CreateEconomicWorkOrderInput): WorkOrderFailure | null {
  if (!input.authorityReferences.mandateId) {
    return { code: 'MANDATE_REFERENCE_REQUIRED', message: 'mandate reference is required' };
  }
  if (!input.actionBoundary.unrestrictedFinancialMutation) {
    // enforced by type — always false
  }
  if (input.actionBoundary.agentAuthorityEscalation) {
    return { code: 'ENVELOPE_WIDENING_FORBIDDEN', message: 'agent authority escalation is forbidden' };
  }
  const capitalError = validateCapitalBoundary(input.capitalBoundary);
  if (capitalError) {
    return capitalError;
  }
  return null;
}
