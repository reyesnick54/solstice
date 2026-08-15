import type { UtcInstant } from '../../domain/src/time.ts';
import type { FillId, InstrumentId, PaperOrderId } from './ids.ts';
import type { InstrumentPrice } from './price.ts';
import type { InvestmentQuantity } from './quantity.ts';
import type { OrderSide } from './types.ts';
import type { Money } from '../../money/src/money.ts';

export type PaperFill = {
  readonly fillId: FillId;
  readonly orderId: PaperOrderId;
  readonly instrumentId: InstrumentId;
  readonly side: OrderSide;
  readonly quantity: InvestmentQuantity;
  readonly price: InstrumentPrice;
  readonly grossNotional: Money;
  readonly explicitFee: Money;
  readonly filledAt: UtcInstant;
  readonly providerFillRef: string;
  readonly simulation: true;
};

export function freezePaperFill(fill: PaperFill): PaperFill {
  if (fill.simulation !== true) {
    throw new Error('live fills are forbidden');
  }
  return Object.freeze({ ...fill });
}
