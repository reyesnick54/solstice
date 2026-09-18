import type { CustomerId } from '../../../../domain/src/customer.ts';
import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { InvestmentLifecyclePort, MandateLifecycleContext, WithdrawableCashSnapshot } from './types.ts';
import type { ReconciliationOutcome } from './taxonomy.ts';

export type WithdrawableCashInput = {
  readonly customerId: CustomerId;
  readonly investmentAccountId: string;
  readonly brokerageAccountId: string;
  readonly currency: string;
  readonly investments: InvestmentLifecyclePort;
  readonly reservedMinor: string;
  readonly restrictedMinor: string;
  readonly latestReconciliationOutcome: ReconciliationOutcome | null;
  readonly reconciliationBlocksAvailability: boolean;
  readonly asOf: UtcInstant;
};

export function computeWithdrawableCash(input: WithdrawableCashInput): WithdrawableCashSnapshot {
  const ledgerSettled = BigInt(input.investments.brokerageCashBalance(input.brokerageAccountId, input.currency));
  const pendingSettlement = BigInt(input.investments.pendingSettlementTotal(input.investmentAccountId, input.currency));
  const positions = input.investments.listPositions(input.investmentAccountId);
  let investedMinor = 0n;
  for (const position of positions) {
    if (BigInt(position.quantityUnits) > 0n) {
      investedMinor += estimateInvestedNotional(position.quantityUnits);
    }
  }
  const reserved = BigInt(input.reservedMinor);
  const restricted = BigInt(input.restrictedMinor);
  const profitOnScreen = investedMinor > 0n ? investedMinor : 0n;

  let reconciledMinor = ledgerSettled;
  if (input.latestReconciliationOutcome !== 'MATCHED' || input.reconciliationBlocksAvailability) {
    reconciledMinor = 0n;
  }

  const base = reconciledMinor - reserved - restricted;
  const withdrawable = base > 0n ? base : 0n;

  return Object.freeze({
    customerId: input.customerId,
    brokerageAccountId: input.brokerageAccountId,
    currency: input.currency,
    ledgerSettledMinor: ledgerSettled.toString(),
    reconciledMinor: reconciledMinor.toString(),
    reservedMinor: reserved.toString(),
    investedMinor: investedMinor.toString(),
    restrictedMinor: restricted.toString(),
    withdrawableMinor: withdrawable.toString(),
    profitOnScreenMinor: profitOnScreen.toString(),
    asOf: input.asOf,
    serverCalculated: true,
  });
}

export function evaluateReinvestmentEligibility(input: {
  readonly mandate: MandateLifecycleContext;
  readonly withdrawable: WithdrawableCashSnapshot;
  readonly requestedMinor: string;
  readonly hasPendingWithdrawal: boolean;
  readonly latestReconciliationOutcome: ReconciliationOutcome | null;
  readonly hasUnsettledProceeds: boolean;
}): {
  readonly eligible: boolean;
  readonly availableMinor: string;
  readonly currency: string;
  readonly refusalCodes: readonly import('./taxonomy.ts').ReinvestmentRefusalCode[];
  readonly requiresNewAuthority: true;
} {
  const refusalCodes: import('./taxonomy.ts').ReinvestmentRefusalCode[] = [];
  const available = BigInt(input.withdrawable.withdrawableMinor);
  const requested = BigInt(input.requestedMinor);

  if (input.hasUnsettledProceeds) {
    refusalCodes.push('UNSETTLED_PROCEEDS');
  }
  if (input.latestReconciliationOutcome !== 'MATCHED') {
    refusalCodes.push('UNRECONCILED');
  }
  if (!input.mandate.mandateActive) {
    refusalCodes.push('MANDATE_INACTIVE');
  }
  if (input.mandate.growPaused) {
    refusalCodes.push('GROW_PAUSED');
  }
  if (available < BigInt(input.mandate.liquidityRetentionMinor)) {
    refusalCodes.push('LIQUIDITY_REQUIREMENT');
  }
  if (input.hasPendingWithdrawal) {
    refusalCodes.push('WITHDRAWAL_PENDING');
  }
  if (BigInt(input.withdrawable.reservedMinor) > 0n && requested > available) {
    refusalCodes.push('CASH_RESERVED');
  }
  if (!input.mandate.reinvestmentPermitted) {
    refusalCodes.push('POLICY_REFUSED');
  }
  if (requested > available) {
    refusalCodes.push('LIQUIDITY_REQUIREMENT');
  }

  return Object.freeze({
    eligible: refusalCodes.length === 0 && requested <= available && requested > 0n,
    availableMinor: available.toString(),
    currency: input.withdrawable.currency,
    refusalCodes: Object.freeze(refusalCodes),
    requiresNewAuthority: true,
  });
}

function estimateInvestedNotional(quantityUnits: string): bigint {
  const units = BigInt(quantityUnits);
  const priceMinor = 10_000n;
  return (units / 100_000_000n) * priceMinor;
}
