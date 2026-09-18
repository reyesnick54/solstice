import type { UtcInstant } from '../../../../domain/src/time.ts';
import { fillIdFor, type HeliosOperationId, type HeliosOrderId } from './ids.ts';
import type { HeliosFill, HeliosOrder } from './types.ts';
import type { HeliosProviderOutcomeKind } from './taxonomy.ts';

export type ProviderSubmitRequest = {
  readonly externalOperationId: string;
  readonly operationId: HeliosOperationId;
  readonly orderId: HeliosOrderId;
  readonly instrumentId: string;
  readonly side: 'BUY' | 'SELL';
  readonly quantityUnits: string;
  readonly orderType: 'MARKET' | 'LIMIT';
  readonly limitPriceMinorUnits: string | null;
  readonly currency: string;
  readonly timeInForce: string;
};

export type ProviderSubmitResult =
  | {
      readonly outcome: 'ACKNOWLEDGED' | 'REJECTED' | 'PENDING';
      readonly providerOrderId: string;
      readonly evidenceRef: string;
    }
  | { readonly outcome: 'TIMEOUT'; readonly evidenceRef: string | null }
  | { readonly outcome: 'UNAVAILABLE'; readonly message: string };

export type ProviderQueryResult =
  | {
      readonly found: true;
      readonly providerOrderId: string;
      readonly status: HeliosProviderOutcomeKind;
      readonly fills: readonly ProviderFillEvent[];
      readonly evidenceRef: string;
    }
  | { readonly found: false; readonly evidenceRef: string | null };

export type ProviderFillEvent = {
  readonly providerFillId: string;
  readonly instrumentId: string;
  readonly quantityUnits: string;
  readonly priceMinorUnits: string;
  readonly feeMinorUnits: string;
  readonly currency: string;
  readonly venue: string | null;
  readonly liquidityRole: 'MAKER' | 'TAKER' | null;
  readonly providerTimestamp: UtcInstant;
};

export type ProviderCancelResult =
  | { readonly outcome: 'CANCEL_ACKNOWLEDGED' | 'CANCEL_REJECTED' | 'PENDING'; readonly evidenceRef: string }
  | { readonly outcome: 'UNAVAILABLE'; readonly message: string };

export type ProviderWebhookPayload = {
  readonly eventId: string;
  readonly signature: string | null;
  readonly rawBody: string;
  readonly parsed: {
    readonly kind: string;
    readonly externalOperationId: string | null;
    readonly providerOrderId: string | null;
    readonly providerFillId: string | null;
    readonly customerId: string | null;
    readonly fill?: ProviderFillEvent;
  };
};

export type ProviderWebhookVerificationResult =
  | { readonly verified: true; readonly payload: ProviderWebhookPayload['parsed'] }
  | { readonly verified: false; readonly reason: 'INVALID_SIGNATURE' | 'MALFORMED' | 'REPLAY' };

/**
 * Provider-neutral order execution port.
 * Real licensed brokers attach later through Provider Runtime.
 * This interface cannot issue Execution Authority.
 */
export interface HeliosProviderOrderPort {
  readonly providerId: string;
  readonly environment: 'SIMULATION' | 'SANDBOX' | 'PAPER';
  readonly liveProviderConnected: false;
  submit(request: ProviderSubmitRequest): ProviderSubmitResult;
  query(externalOperationId: string): ProviderQueryResult;
  cancel(providerOrderId: string, externalOperationId: string): ProviderCancelResult;
  verifyWebhook(payload: ProviderWebhookPayload): ProviderWebhookVerificationResult;
}

export function providerFillToHeliosFill(
  order: HeliosOrder,
  event: ProviderFillEvent,
  arrivedAt: UtcInstant,
  evidenceRef: string | null,
): HeliosFill {
  const notional = (BigInt(event.quantityUnits) * BigInt(event.priceMinorUnits)).toString();
  return Object.freeze({
    fillId: fillIdFor(order.orderId, event.providerFillId),
    orderId: order.orderId,
    providerFillId: event.providerFillId,
    instrumentId: event.instrumentId,
    quantityUnits: event.quantityUnits,
    priceMinorUnits: event.priceMinorUnits,
    notionalMinorUnits: notional,
    feeMinorUnits: event.feeMinorUnits,
    currency: event.currency,
    venue: event.venue,
    liquidityRole: event.liquidityRole,
    providerTimestamp: event.providerTimestamp,
    arrivedAt,
    evidenceRef,
    simulation: true,
    liveSecuritiesExecution: false,
  });
}
