import type { UtcInstant } from '@solstice/domain';

import type { HeliosOrder, HeliosOrderValidationPorts } from '../../order-lifecycle/types.ts';
import type { PreTradeExecutionRequest } from './types.ts';

export type PreTradeOrderLifecycleFacts = {
  readonly requestId: string;
  readonly evaluatedAt: UtcInstant;
  readonly jurisdiction: string;
  readonly marketAccessAllowed: boolean;
  readonly marketAccessReasonCodes: readonly string[];
  readonly instrumentEligible: boolean;
  readonly marketDataAuthoritative: boolean;
  readonly marketDataFresh: boolean;
  readonly referencePriceMinor: bigint | null;
  readonly sunreyLimits: PreTradeExecutionRequest['sunreyLimits'];
  readonly brokerLimits: PreTradeExecutionRequest['brokerLimits'];
  readonly sunreyRisk: PreTradeExecutionRequest['sunreyRisk'];
  readonly brokerPreTradeRejection: PreTradeExecutionRequest['brokerPreTradeRejection'];
  readonly capitalReserved: boolean;
  readonly capitalReservationId: string | null;
  readonly duplicateOrderDetected: boolean;
  readonly dailyLossBreached: boolean;
  readonly dailyLossReviewBand: boolean;
  readonly strategyContributionBreached: boolean;
  readonly participationRateBps: bigint;
  readonly liquidityConstraintViolated: boolean;
  readonly priceCollarBps: bigint;
  readonly fatFingerThresholdBps: bigint;
  readonly structuredProductPosture: PreTradeExecutionRequest['structuredProductPosture'];
  readonly orderExtensions?: Partial<PreTradeExecutionRequest['order']>;
};

const DEFAULT_STRUCTURED_POSTURE: PreTradeExecutionRequest['structuredProductPosture'] = Object.freeze({
  shortSaleGoverned: false,
  shortSaleExternallyEnabled: false,
  marginLeverageGoverned: false,
  marginLeverageExternallyEnabled: false,
  derivativesGoverned: false,
  derivativesExternallyEnabled: false,
  nakedOptionsGoverned: false,
  nakedOptionsExternallyEnabled: false,
  uncoveredBorrowingGoverned: false,
  uncoveredBorrowingExternallyEnabled: false,
});

const DEFAULT_SUNREY_LIMITS: PreTradeExecutionRequest['sunreyLimits'] = Object.freeze({
  maxOrderNotionalMinor: 9_007_199_254_740_991n,
  maxOrderQuantity: 9_007_199_254_740_991n,
  maxParticipationRateBps: 10_000n,
  availableBuyingPowerMinor: 9_007_199_254_740_991n,
});

export function buildPreTradeExecutionRequestFromHeliosOrder(input: {
  readonly order: HeliosOrder;
  readonly now: UtcInstant;
  readonly validation: HeliosOrderValidationPorts;
  readonly facts: PreTradeOrderLifecycleFacts;
}): PreTradeExecutionRequest {
  const { order, now, validation, facts } = input;
  const kernel = validation.kernelPermits({
    customerId: order.customerId,
    workOrderId: order.workOrderId,
    proposalId: order.proposalId,
  });

  const quantity = BigInt(order.quantityUnits);
  const notional = BigInt(order.notionalMinorUnits);
  const limitPrice = order.limitPriceMinorUnits ? BigInt(order.limitPriceMinorUnits) : null;

  return Object.freeze({
    requestId: facts.requestId,
    evaluatedAt: facts.evaluatedAt,
    customerId: order.customerId,
    accountId: order.providerAccountId,
    workOrderId: order.workOrderId,
    proposalId: order.proposalId,
    envelopeId: order.envelopeId,
    providerRoute: order.providerRoute,
    environment: order.environment,
    jurisdiction: facts.jurisdiction,
    marketAccess: Object.freeze({
      allowed: facts.marketAccessAllowed,
      reasonCodes: Object.freeze([...facts.marketAccessReasonCodes]),
    }),
    order: Object.freeze({
      operationId: order.operationId,
      idempotencyKey: order.idempotencyKey,
      side: order.side,
      positionEffect:
        facts.orderExtensions?.positionEffect ??
        (order.side === 'BUY' ? 'OPEN_LONG' : 'CLOSE_LONG'),
      orderType: order.orderType,
      quantityUnits: quantity,
      notionalMinorUnits: notional,
      limitPriceMinorUnits: limitPrice,
      currency: order.currency,
      instrumentId: order.instrumentId,
      instrumentAssetClass: facts.orderExtensions?.instrumentAssetClass ?? 'EQUITY',
      instrumentDerivativeKind: facts.orderExtensions?.instrumentDerivativeKind ?? 'NONE',
      optionCoverage: facts.orderExtensions?.optionCoverage ?? 'NOT_APPLICABLE',
      marginLeverageRequested: facts.orderExtensions?.marginLeverageRequested ?? false,
      borrowedSharesRequired: facts.orderExtensions?.borrowedSharesRequired ?? false,
      borrowingCovered: facts.orderExtensions?.borrowingCovered ?? true,
      restrictedSecurity: facts.orderExtensions?.restrictedSecurity ?? false,
    }),
    marketData: Object.freeze({
      authoritative: facts.marketDataAuthoritative,
      fresh: facts.marketDataFresh,
      referencePriceMinor: facts.referencePriceMinor,
      observedAt: facts.evaluatedAt,
    }),
    marketSessionOpen: validation.marketOpen(order.instrumentId),
    instrumentEligible: facts.instrumentEligible,
    customerOwnsAccount: validation.accountOwned(order.customerId, order.providerAccountId),
    mandateActive: validation.mandateActive(order.workOrderId, order.customerId),
    envelopeValid: validation.envelopeValid(order.envelopeId, now),
    kernelAuthorized: kernel.permitted,
    capitalReserved:
      facts.capitalReserved ||
      validation.capitalAvailable(order.customerId, order.providerAccountId, order.notionalMinorUnits, order.currency),
    capitalReservationId: facts.capitalReservationId ?? order.reservationId,
    sunreyLimits: facts.sunreyLimits ?? DEFAULT_SUNREY_LIMITS,
    brokerLimits: facts.brokerLimits,
    sunreyRisk: facts.sunreyRisk ?? Object.freeze({ consulted: false, outcome: null, reasonCodes: [], triggeredLimitIds: [] }),
    brokerPreTradeRejection: facts.brokerPreTradeRejection,
    dailyLossBreached: facts.dailyLossBreached,
    dailyLossReviewBand: facts.dailyLossReviewBand,
    strategyContributionBreached: facts.strategyContributionBreached,
    duplicateOrderDetected: facts.duplicateOrderDetected,
    participationRateBps: facts.participationRateBps,
    liquidityConstraintViolated: facts.liquidityConstraintViolated,
    priceCollarBps: facts.priceCollarBps,
    fatFingerThresholdBps: facts.fatFingerThresholdBps,
    structuredProductPosture: facts.structuredProductPosture ?? DEFAULT_STRUCTURED_POSTURE,
    simulationOnly: true,
    liveGatesEnabled: false,
  });
}
