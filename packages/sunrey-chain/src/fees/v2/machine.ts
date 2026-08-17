/**
 * Machine transactions remain bound by mandate, native balance, and max fee.
 * Priority fees cannot bypass the spending mandate.
 */

import type { IntegerQuantity } from '../../machine-economy/types.ts';
import type { ProtocolFeePort } from '../../machine-economy/ports.ts';
import type { FeeQuoteV2 } from './types.ts';

export function machineAccountedSpend(purchaseAmount: IntegerQuantity, quote: FeeQuoteV2): IntegerQuantity {
  return purchaseAmount + quote.estimatedTotal;
}

export function machineFeeFitsMandate(
  mandateCeiling: IntegerQuantity,
  purchaseAmount: IntegerQuantity,
  quote: FeeQuoteV2,
): boolean {
  return machineAccountedSpend(purchaseAmount, quote) <= mandateCeiling;
}

export class FeePolicyV2FeeAdapter implements ProtocolFeePort {
  readonly source = 'PROTOCOL_FEE_PORT' as const;
  private readonly estimate: (purchaseAmount: IntegerQuantity) => IntegerQuantity;

  constructor(estimate: (purchaseAmount: IntegerQuantity) => IntegerQuantity) {
    this.estimate = estimate;
  }

  feeFor(purchaseAmount: IntegerQuantity): IntegerQuantity {
    return this.estimate(purchaseAmount);
  }
}
