import {
  ENVIRONMENT,
  LIVE_MONEY_ENABLED,
  LIVE_PAYMENTS_ENABLED,
  LIVE_TRADING_ENABLED,
} from '../../../../config/src/flags.ts';
import { err, ok, type Result } from '../../../../domain/src/result.ts';
import { Money } from '../../../../money/src/money.ts';
import {
  evaluateGrowComplianceCheckpoint,
  type GrowComplianceCheckpointInput,
} from '../../grow/lifecycle/compliance-checkpoint.ts';
import { evaluateGrowSuitability, type SuitabilityFacts } from '../../grow/suitability.ts';
import { constraintAmount } from '../../growth/feasibility.ts';
import type { CompiledEconomicMandate } from '../../mandate/types.ts';
import type { EconomicWorkOrder } from '../types.ts';
import { formatMinorUnits, minMinorUnits, parseMinorUnits, subtractMinorUnits } from './ports.ts';
import type { GrowAllocationFailure, GrowSandboxAllocation } from './types.ts';
import type { SandboxAccountPosition } from './ports.ts';

export type AllocationRiskInput = SuitabilityFacts;

export function assertSandboxEnvironment(): Result<true, GrowAllocationFailure> {
  if (ENVIRONMENT !== 'simulation') {
    return err({
      code: 'ENVIRONMENT_NOT_SANDBOX',
      message: 'grow sandbox allocation requires simulation environment',
    });
  }
  if (LIVE_MONEY_ENABLED || LIVE_PAYMENTS_ENABLED || LIVE_TRADING_ENABLED) {
    return err({
      code: 'LIVE_EXECUTION_DISABLED',
      message: 'live execution flags must remain disabled for sandbox allocation',
    });
  }
  return ok(true);
}

export function evaluateAllocationRisk(facts: AllocationRiskInput): Result<true, GrowAllocationFailure> {
  const suitability = evaluateGrowSuitability(facts);
  if (suitability !== 'SUITABLE') {
    return err({
      code: 'RISK_REFUSED',
      message: `risk suitability refused allocation: ${suitability}`,
    });
  }
  return ok(true);
}

export function evaluateAllocationCompliance(
  input: GrowComplianceCheckpointInput,
): Result<true, GrowAllocationFailure> {
  const decision = evaluateGrowComplianceCheckpoint(input);
  if (!decision.allowed) {
    return err({
      code: 'COMPLIANCE_REFUSED',
      message: decision.message,
    });
  }
  return ok(true);
}

export function computeLiquidityRetentionMinorUnits(
  mandate: CompiledEconomicMandate,
  currency: string,
): string {
  const floor =
    constraintAmount(mandate, 'NEVER_SPEND_BELOW_LIQUIDITY_FLOOR') ??
    constraintAmount(mandate, 'MINIMUM_CASH_RESERVE');
  if (!floor || floor.currency !== currency) {
    return '0';
  }
  return floor.minorUnits.toString();
}

export function computeAllocatableMinorUnits(input: {
  readonly requestedMinorUnits: string;
  readonly position: SandboxAccountPosition;
  readonly capitalCeilingMinorUnits: string;
  readonly liquidityRetentionMinorUnits: string;
}): { readonly acceptedMinorUnits: string; readonly refusal: GrowAllocationFailure | null } {
  const availableAfterRetention = subtractMinorUnits(
    input.position.availableMinorUnits,
    input.liquidityRetentionMinorUnits,
  );
  if (parseMinorUnits(availableAfterRetention) <= 0n) {
    if (parseMinorUnits(input.position.availableMinorUnits) <= 0n) {
      return {
        acceptedMinorUnits: '0',
        refusal: {
          code: 'INSUFFICIENT_FUNDS',
          message: 'request exceeds available sandbox funds after retention and ceilings',
        },
      };
    }
    return {
      acceptedMinorUnits: '0',
      refusal: {
        code: 'LIQUIDITY_RETAINED',
        message: 'mandate liquidity retention leaves no allocatable sandbox cash',
      },
    };
  }
  const cappedByCeiling = minMinorUnits(input.requestedMinorUnits, input.capitalCeilingMinorUnits);
  const acceptedMinorUnits = minMinorUnits(cappedByCeiling, availableAfterRetention);
  if (parseMinorUnits(acceptedMinorUnits) <= 0n) {
    return {
      acceptedMinorUnits: '0',
      refusal: {
        code: 'INSUFFICIENT_FUNDS',
        message: 'request exceeds available sandbox funds after retention and ceilings',
      },
    };
  }
  if (parseMinorUnits(acceptedMinorUnits) < parseMinorUnits(input.requestedMinorUnits)) {
    return { acceptedMinorUnits, refusal: null };
  }
  return { acceptedMinorUnits, refusal: null };
}

export function validateWorkOrderForAllocation(
  workOrder: EconomicWorkOrder,
  customerId: string,
  currency: string,
): Result<{ readonly accountId: string; readonly capitalCeilingMinorUnits: string }, GrowAllocationFailure> {
  if (workOrder.customerId !== customerId) {
    return err({ code: 'WORK_ORDER_CUSTOMER_MISMATCH', message: 'work order customer mismatch' });
  }
  if (workOrder.state !== 'ACTIVE') {
    return err({ code: 'WORK_ORDER_NOT_ACTIVE', message: 'work order must be ACTIVE to allocate sandbox capital' });
  }
  if (workOrder.environment !== 'simulation') {
    return err({ code: 'ENVIRONMENT_NOT_SANDBOX', message: 'work order is not sandbox scoped' });
  }
  const accountId = workOrder.capitalBoundary.accountId;
  if (!accountId) {
    return err({ code: 'ACCOUNT_NOT_FOUND', message: 'work order capital boundary requires an account reference' });
  }
  if (workOrder.capitalBoundary.maxCapitalEnvelope.currency !== currency) {
    return err({ code: 'CURRENCY_MISMATCH', message: 'requested currency does not match capital boundary' });
  }
  return ok({
    accountId,
    capitalCeilingMinorUnits: workOrder.capitalBoundary.maxCapitalEnvelope.minorUnits,
  });
}

export function validateMandateCurrency(
  mandate: CompiledEconomicMandate,
  currency: string,
): Result<true, GrowAllocationFailure> {
  if (mandate.currency !== currency) {
    return err({ code: 'CURRENCY_MISMATCH', message: 'mandate currency does not match allocation currency' });
  }
  if (mandate.state !== 'ACTIVE') {
    return err({ code: 'MANDATE_LIMIT', message: 'mandate must be ACTIVE for sandbox allocation' });
  }
  return ok(true);
}

export function validateMandateSingleActionLimit(
  mandate: CompiledEconomicMandate,
  requestedMinorUnits: string,
  currency: string,
): Result<true, GrowAllocationFailure> {
  const maxSingle = constraintAmount(mandate, 'MAXIMUM_SINGLE_PROPOSED_ACTION_AMOUNT');
  if (!maxSingle) {
    return ok(true);
  }
  const requested = Money.fromMinorUnitsString(requestedMinorUnits, currency);
  if (requested.cmp(maxSingle) > 0) {
    return err({
      code: 'MANDATE_LIMIT',
      message: 'accepted amount exceeds mandate single-action limit',
    });
  }
  return ok(true);
}

export function allocationStatusForAccepted(
  requestedMinorUnits: string,
  acceptedMinorUnits: string,
): GrowSandboxAllocation['status'] {
  if (parseMinorUnits(acceptedMinorUnits) < parseMinorUnits(requestedMinorUnits)) {
    return 'PARTIALLY_RESERVED';
  }
  return 'RESERVED';
}
