import type { CustomerId, UtcInstant } from '@solstice/domain';
import type { CashBalanceState } from './types.ts';
import { HELIOS_EXEC10_SCHEMA } from './taxonomy.ts';

export type BuildCashBalanceInput = {
  readonly customerId: CustomerId;
  readonly brokerageAccountId: string;
  readonly currency: string;
  readonly settledCashMinor: string;
  readonly unsettledCashMinor: string;
  readonly reservedCashMinor: string;
  /** When true, trade and withdraw availability are zeroed (reconciliation fail-closed). */
  readonly reconciliationBlocks: boolean;
  readonly asOf: UtcInstant;
};

function nonNegativeMinor(value: bigint): string {
  return (value > 0n ? value : 0n).toString();
}

/**
 * Derive distinguished cash fields from ledger-anchored components.
 * Unsettled buy obligations reduce trade and withdraw availability.
 */
export function buildCashBalanceState(input: BuildCashBalanceInput): CashBalanceState {
  const settled = BigInt(input.settledCashMinor);
  const unsettled = BigInt(input.unsettledCashMinor);
  const reserved = BigInt(input.reservedCashMinor);
  const cash = settled + unsettled;

  const unsettledObligation = unsettled > 0n ? unsettled : 0n;

  let availableToTrade = settled - reserved - unsettledObligation;
  let availableToWithdraw = settled - reserved - unsettledObligation;

  if (input.reconciliationBlocks) {
    availableToTrade = 0n;
    availableToWithdraw = 0n;
  }

  return Object.freeze({
    schemaVersion: HELIOS_EXEC10_SCHEMA,
    customerId: input.customerId,
    brokerageAccountId: input.brokerageAccountId,
    currency: input.currency,
    cashMinor: cash.toString(),
    settledCashMinor: settled.toString(),
    unsettledCashMinor: unsettled.toString(),
    reservedCashMinor: reserved.toString(),
    availableToTradeMinor: nonNegativeMinor(availableToTrade),
    availableToWithdrawMinor: nonNegativeMinor(availableToWithdraw),
    asOf: input.asOf,
    serverCalculated: true,
  });
}
