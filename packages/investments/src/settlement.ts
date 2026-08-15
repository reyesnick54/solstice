import type { UtcInstant } from '../../domain/src/time.ts';
import type { Money } from '../../money/src/money.ts';
import type { FillId, InvestmentAccountId, SettlementId } from './ids.ts';
import type { InvestmentQuantity } from './quantity.ts';
import type { OrderSide, SettlementState } from './types.ts';

/**
 * Configurable simulation settlement. Not a legally universal T+N period.
 * Each simulated market/provider supplies settlementDelayDays.
 */
export type InvestmentSettlement = {
  readonly settlementId: SettlementId;
  readonly fillId: FillId;
  readonly investmentAccountId: InvestmentAccountId;
  readonly side: OrderSide;
  readonly quantity: InvestmentQuantity;
  readonly cashAmount: Money;
  readonly feeAmount: Money;
  readonly state: SettlementState;
  readonly tradeAt: UtcInstant;
  readonly settleAfter: UtcInstant;
  readonly settledAt: UtcInstant | null;
  readonly cashJournalId: string | null;
  readonly settlementJournalId: string | null;
  readonly settlementDelayDays: bigint;
};

export function freezeSettlement(record: InvestmentSettlement): InvestmentSettlement {
  return Object.freeze({ ...record });
}
