import type { UtcInstant } from '../../../domain/src/time.ts';
import { Money } from '../../../money/src/money.ts';
import type { InstrumentId } from '../ids.ts';
import type { InvestmentQuantity } from '../quantity.ts';
import {
  canTransitionProductOrder,
  type InvestmentOrderSide,
  type InvestmentOrderState,
  type InvestmentSizingMode,
} from './types.ts';
import { asInvestmentProposalId, type InvestmentProposalId, type PortfolioId } from './ids.ts';

/**
 * Canonical investment order / proposal. A simulation fill is not a live
 * securities execution.
 */
export type InvestmentOrderProposal = {
  readonly proposalId: InvestmentProposalId;
  readonly portfolioId: PortfolioId;
  readonly ownerId: string;
  readonly instrumentId: InstrumentId;
  readonly side: InvestmentOrderSide;
  readonly sizing: InvestmentSizingMode;
  readonly quantity: InvestmentQuantity | null;
  readonly amount: Money | null;
  readonly status: InvestmentOrderState;
  readonly filledQuantity: InvestmentQuantity | null;
  readonly filledAmount: Money | null;
  readonly paperOrderId: string | null;
  readonly reservationId: string | null;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
  readonly idempotencyKey: string;
  readonly simulation: true;
  readonly liveExecution: false;
  readonly fillIsLiveSecuritiesExecution: false;
};

export function freezeOrderProposal(row: InvestmentOrderProposal): InvestmentOrderProposal {
  if (row.side !== 'BUY' && row.side !== 'SELL') {
    throw new Error('only BUY and SELL are permitted');
  }
  if (row.simulation !== true || row.liveExecution !== false) {
    throw new Error('live investment orders are forbidden');
  }
  return Object.freeze({ ...row, fillIsLiveSecuritiesExecution: false });
}

export function transitionOrderProposal(
  row: InvestmentOrderProposal,
  next: InvestmentOrderState,
  extras: Partial<InvestmentOrderProposal> = {},
): InvestmentOrderProposal {
  if (!canTransitionProductOrder(row.status, next)) {
    throw new Error(`illegal product-order transition ${row.status} → ${next}`);
  }
  return freezeOrderProposal({ ...row, ...extras, status: next });
}

export function newOrderProposal(input: {
  readonly proposalId: string;
  readonly portfolioId: PortfolioId;
  readonly ownerId: string;
  readonly instrumentId: InstrumentId;
  readonly side: InvestmentOrderSide;
  readonly sizing: InvestmentSizingMode;
  readonly quantity: InvestmentQuantity | null;
  readonly amount: Money | null;
  readonly createdAt: UtcInstant;
  readonly idempotencyKey: string;
}): InvestmentOrderProposal {
  return freezeOrderProposal({
    proposalId: asInvestmentProposalId(input.proposalId),
    portfolioId: input.portfolioId,
    ownerId: input.ownerId,
    instrumentId: input.instrumentId,
    side: input.side,
    sizing: input.sizing,
    quantity: input.quantity,
    amount: input.amount,
    status: 'PROPOSED',
    filledQuantity: null,
    filledAmount: null,
    paperOrderId: null,
    reservationId: null,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    idempotencyKey: input.idempotencyKey,
    simulation: true,
    liveExecution: false,
    fillIsLiveSecuritiesExecution: false,
  });
}
