import type { CustomerId, UtcInstant } from '@solstice/domain';
import type { FinancingAllocationCaps, FinancingState } from './types.ts';
import { DEFAULT_GROW_FINANCING_POSTURE, HELIOS_EXEC10_SCHEMA } from './taxonomy.ts';
import { buildCashBalanceState, type BuildCashBalanceInput } from './cash-balance.ts';
import { buildBuyingPowerState } from './buying-power.ts';
import { buildMarginState } from './margin.ts';
import { buildBorrowState } from './borrow.ts';

export type BuildFinancingStateInput = {
  readonly customerId: CustomerId;
  readonly brokerageAccountId: string;
  readonly currency: string;
  readonly providerId: string;
  readonly brokerReportedAvailableMinor: string;
  readonly brokerReportedMarginExcessMinor: string | null;
  readonly caps: FinancingAllocationCaps;
  readonly cash: Omit<BuildCashBalanceInput, 'customerId' | 'brokerageAccountId' | 'currency' | 'asOf'>;
  readonly asOf: UtcInstant;
};

export function buildFinancingState(input: BuildFinancingStateInput): FinancingState {
  const cash = buildCashBalanceState({
    customerId: input.customerId,
    brokerageAccountId: input.brokerageAccountId,
    currency: input.currency,
    asOf: input.asOf,
    ...input.cash,
  });

  const posture = DEFAULT_GROW_FINANCING_POSTURE;

  const buyingPower = buildBuyingPowerState({
    customerId: input.customerId,
    brokerageAccountId: input.brokerageAccountId,
    currency: input.currency,
    providerId: input.providerId,
    brokerReportedAvailableMinor: input.brokerReportedAvailableMinor,
    caps: input.caps,
    cash,
    posture,
    asOf: input.asOf,
  });

  const margin = buildMarginState({
    brokerReportedExcessMinor: input.brokerReportedMarginExcessMinor,
    asOf: input.asOf,
  });

  const borrow = buildBorrowState({ asOf: input.asOf });

  return Object.freeze({
    schemaVersion: HELIOS_EXEC10_SCHEMA,
    customerId: input.customerId,
    brokerageAccountId: input.brokerageAccountId,
    currency: input.currency,
    posture,
    cash,
    buyingPower,
    margin,
    borrow,
    executableBuyingPowerMinor: buyingPower.executableBuyingPowerMinor,
    providerBuyingPowerInformationalOnly: true,
    asOf: input.asOf,
  });
}
