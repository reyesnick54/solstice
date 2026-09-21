import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { ExecutionPlan, ExecutionPlanFailure, ExecutionPlanValidationPorts } from './types.ts';

export type ValidationOutcome =
  | { readonly ok: true }
  | { readonly ok: false; readonly failure: ExecutionPlanFailure };

function fail(code: ExecutionPlanFailure['code'], message: string): ValidationOutcome {
  return Object.freeze({ ok: false, failure: Object.freeze({ code, message }) });
}

export function validateExecutionPlanCreation(
  plan: ExecutionPlan,
  ports: ExecutionPlanValidationPorts,
  now: UtcInstant,
): ValidationOutcome {
  if (now >= plan.decisionValidUntil) {
    return fail('ENVELOPE_EXPIRED', 'Decision-Validity Envelope has expired');
  }
  if (!ports.envelopeValid(plan.envelopeId, now)) {
    return fail('ENVELOPE_EXPIRED', 'Decision-Validity Envelope is not valid');
  }
  if (!ports.mandateActive(plan.mandateId, plan.customerId)) {
    return fail('MANDATE_PAUSED', 'Customer mandate is paused or inactive');
  }
  if (
    !ports.strategyVersionMatches(
      plan.strategyCapsuleRef,
      plan.strategyCapsuleId,
      plan.strategyCapsuleVersion,
    )
  ) {
    return fail('STRATEGY_VERSION_MISMATCH', 'Strategy capsule version does not match bound reference');
  }

  for (const leg of plan.legs) {
    if (!ports.instrumentExecutable(leg.instrumentId, leg.assetClass)) {
      return fail('INSTRUMENT_NOT_EXECUTABLE', `Instrument ${leg.instrumentId} is not executable`);
    }
    if (!ports.marketStateValid(leg.instrumentId, now)) {
      return fail('MARKET_STATE_INVALID', `Market state invalid for ${leg.instrumentId}`);
    }
    if (!ports.withinApprovedSize(leg)) {
      return fail('PLAN_EXCEEDS_APPROVED_SIZE', `Leg ${leg.legId} exceeds approved size`);
    }
    const provider = leg.constraints.venueProvider.preferredProvider;
    if (provider && !ports.providerCapable(provider, leg.instrumentId)) {
      return fail('PROVIDER_CAPABILITY_UNAVAILABLE', `Provider ${provider} cannot execute ${leg.instrumentId}`);
    }
  }

  return Object.freeze({ ok: true });
}

export function validateRiskApproval(
  plan: ExecutionPlan,
  ports: ExecutionPlanValidationPorts,
): ValidationOutcome {
  const risk = ports.riskApproved({
    executionPlanId: plan.executionPlanId,
    customerId: plan.customerId,
    workOrderId: plan.workOrderId,
    legs: plan.legs,
  });
  if (!risk.approved) {
    return fail('RISK_APPROVAL_MISSING', 'Risk authorization is missing or denied');
  }
  return Object.freeze({ ok: true });
}

export function validateComplianceApproval(
  plan: ExecutionPlan,
  ports: ExecutionPlanValidationPorts,
): ValidationOutcome {
  const compliance = ports.complianceApproved({
    executionPlanId: plan.executionPlanId,
    customerId: plan.customerId,
    workOrderId: plan.workOrderId,
    envelopeId: plan.envelopeId,
  });
  if (!compliance.approved) {
    return fail('COMPLIANCE_APPROVAL_MISSING', 'Compliance authorization is missing or denied');
  }
  return Object.freeze({ ok: true });
}

export function validateCapitalReservation(
  plan: ExecutionPlan,
  ports: ExecutionPlanValidationPorts,
): ValidationOutcome {
  const totalNotional = plan.legs.reduce((sum, leg) => sum + BigInt(leg.targetNotionalMinorUnits), 0n);
  const currency = plan.legs[0]?.executionCurrency ?? 'USD';
  const capital = ports.capitalReserved({
    executionPlanId: plan.executionPlanId,
    customerId: plan.customerId,
    totalNotionalMinorUnits: totalNotional.toString(),
    currency,
  });
  if (!capital.reserved) {
    return fail('CAPITAL_RESERVATION_MISSING', 'Capital reservation is missing or insufficient');
  }
  return Object.freeze({ ok: true });
}

export function validatePlanStillValid(
  plan: ExecutionPlan,
  ports: ExecutionPlanValidationPorts,
  now: UtcInstant,
): ValidationOutcome {
  if (now >= plan.decisionValidUntil) {
    return fail('ENVELOPE_EXPIRED', 'Decision-Validity Envelope has expired');
  }
  if (!ports.envelopeValid(plan.envelopeId, now)) {
    return fail('ENVELOPE_EXPIRED', 'Decision-Validity Envelope is not valid');
  }
  if (!ports.mandateActive(plan.mandateId, plan.customerId)) {
    return fail('MANDATE_PAUSED', 'Customer mandate is paused or inactive');
  }
  for (const leg of plan.legs) {
    if (!ports.marketStateValid(leg.instrumentId, now)) {
      return fail('MARKET_STATE_INVALID', `Market state invalid for ${leg.instrumentId}`);
    }
  }
  return Object.freeze({ ok: true });
}
