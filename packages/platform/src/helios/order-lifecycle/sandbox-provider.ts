import { asUtcInstant, type UtcInstant } from '../../../../domain/src/time.ts';
import type {
  HeliosProviderOrderPort,
  ProviderCancelResult,
  ProviderFillEvent,
  ProviderQueryResult,
  ProviderSubmitRequest,
  ProviderSubmitResult,
  ProviderWebhookPayload,
  ProviderWebhookVerificationResult,
} from './provider-port.ts';

export type SandboxProviderScenario =
  | 'ACKNOWLEDGE_THEN_FILL'
  | 'ACKNOWLEDGE_THEN_PARTIAL_THEN_FILL'
  | 'REJECT'
  | 'TIMEOUT_ON_SUBMIT'
  | 'PENDING'
  | 'CANCEL_SUCCESS'
  | 'CANCEL_REJECTED'
  | 'CANCEL_FILL_RACE'
  | 'UNAVAILABLE'
  | 'SETTLEMENT_DELAYED';

type ProviderOrderState = {
  readonly externalOperationId: string;
  readonly providerOrderId: string;
  readonly request: ProviderSubmitRequest;
  readonly status: 'ACKNOWLEDGED' | 'PARTIAL' | 'FILLED' | 'REJECTED' | 'CANCELLED' | 'PENDING';
  readonly fills: readonly ProviderFillEvent[];
  readonly cancelRequested: boolean;
  readonly submittedAt: UtcInstant;
};

/**
 * Deterministic sandbox provider for HELIOS H23 certification.
 * Injected/fake transport only. Not a live broker connection.
 */
export class SandboxHeliosProviderPort implements HeliosProviderOrderPort {
  readonly providerId = 'sandbox_helios_investment_v1';
  readonly environment = 'SANDBOX' as const;
  readonly liveProviderConnected = false as const;

  private scenario: SandboxProviderScenario = 'ACKNOWLEDGE_THEN_FILL';
  private readonly orders = new Map<string, ProviderOrderState>();
  private readonly processedWebhooks = new Set<string>();
  private readonly webhookSecret = 'sandbox_webhook_secret_h23';
  private orderCounter = 0;
  private fillCounter = 0;

  setScenario(scenario: SandboxProviderScenario): void {
    this.scenario = scenario;
  }

  submit(request: ProviderSubmitRequest): ProviderSubmitResult {
    if (this.scenario === 'UNAVAILABLE') {
      return { outcome: 'UNAVAILABLE', message: 'sandbox provider is unavailable' };
    }
    if (this.scenario === 'TIMEOUT_ON_SUBMIT') {
      return { outcome: 'TIMEOUT', evidenceRef: `ev_timeout_${request.externalOperationId}` };
    }

    const existing = this.orders.get(request.externalOperationId);
    if (existing) {
      return {
        outcome: existing.status === 'REJECTED' ? 'REJECTED' : 'ACKNOWLEDGED',
        providerOrderId: existing.providerOrderId,
        evidenceRef: `ev_replay_${request.externalOperationId}`,
      };
    }

    this.orderCounter += 1;
    const providerOrderId = `sbx_ord_${String(this.orderCounter).padStart(6, '0')}`;

    if (this.scenario === 'REJECT') {
      const state: ProviderOrderState = Object.freeze({
        externalOperationId: request.externalOperationId,
        providerOrderId,
        request,
        status: 'REJECTED',
        fills: Object.freeze([]),
        cancelRequested: false,
        submittedAt: asUtcInstant(new Date().toISOString()),
      });
      this.orders.set(request.externalOperationId, state);
      return { outcome: 'REJECTED', providerOrderId, evidenceRef: `ev_reject_${providerOrderId}` };
    }

    if (this.scenario === 'PENDING') {
      const state: ProviderOrderState = Object.freeze({
        externalOperationId: request.externalOperationId,
        providerOrderId,
        request,
        status: 'PENDING',
        fills: Object.freeze([]),
        cancelRequested: false,
        submittedAt: asUtcInstant(new Date().toISOString()),
      });
      this.orders.set(request.externalOperationId, state);
      return { outcome: 'PENDING', providerOrderId, evidenceRef: `ev_pending_${providerOrderId}` };
    }

    const state: ProviderOrderState = Object.freeze({
      externalOperationId: request.externalOperationId,
      providerOrderId,
      request,
      status: 'ACKNOWLEDGED',
      fills: Object.freeze([]),
      cancelRequested: false,
      submittedAt: asUtcInstant(new Date().toISOString()),
    });
    this.orders.set(request.externalOperationId, state);
    return { outcome: 'ACKNOWLEDGED', providerOrderId, evidenceRef: `ev_ack_${providerOrderId}` };
  }

  query(externalOperationId: string): ProviderQueryResult {
    const order = this.orders.get(externalOperationId);
    if (!order) {
      return { found: false, evidenceRef: null };
    }

    const fills = this.resolveFills(order);
    let status: ProviderQueryResult extends { found: true; status: infer S } ? S : never = 'ACKNOWLEDGED' as never;
    if (order.status === 'REJECTED') status = 'REJECTED' as never;
    else if (order.status === 'CANCELLED') status = 'CANCELLED' as never;
    else if (order.status === 'FILLED') status = 'FILL' as never;
    else if (order.status === 'PARTIAL') status = 'PARTIAL_FILL' as never;
    else if (order.status === 'PENDING') status = 'PENDING' as never;

    return {
      found: true,
      providerOrderId: order.providerOrderId,
      status,
      fills,
      evidenceRef: `ev_query_${order.providerOrderId}`,
    };
  }

  cancel(providerOrderId: string, externalOperationId: string): ProviderCancelResult {
    const order = this.orders.get(externalOperationId);
    if (!order || order.providerOrderId !== providerOrderId) {
      return { outcome: 'UNAVAILABLE', message: 'order not found for cancellation' };
    }

    if (this.scenario === 'CANCEL_REJECTED') {
      return { outcome: 'CANCEL_REJECTED', evidenceRef: `ev_cancel_reject_${providerOrderId}` };
    }

    if (this.scenario === 'CANCEL_FILL_RACE') {
      const halfQty = (BigInt(order.request.quantityUnits) / 2n).toString();
      const fill = this.createFill(order, halfQty);
      const updated: ProviderOrderState = Object.freeze({
        ...order,
        status: 'PARTIAL',
        fills: Object.freeze([...order.fills, fill]),
        cancelRequested: true,
      });
      this.orders.set(externalOperationId, updated);
      return { outcome: 'CANCEL_ACKNOWLEDGED', evidenceRef: `ev_cancel_race_${providerOrderId}` };
    }

    const updated: ProviderOrderState = Object.freeze({
      ...order,
      status: 'CANCELLED',
      cancelRequested: true,
    });
    this.orders.set(externalOperationId, updated);
    return { outcome: 'CANCEL_ACKNOWLEDGED', evidenceRef: `ev_cancel_${providerOrderId}` };
  }

  verifyWebhook(payload: ProviderWebhookPayload): ProviderWebhookVerificationResult {
    if (this.processedWebhooks.has(payload.eventId)) {
      return { verified: false, reason: 'REPLAY' };
    }
    if (!payload.parsed.externalOperationId && !payload.parsed.providerOrderId) {
      return { verified: false, reason: 'MALFORMED' };
    }
    if (payload.signature !== null && payload.signature !== this.webhookSecret) {
      return { verified: false, reason: 'INVALID_SIGNATURE' };
    }
    return { verified: true, payload: payload.parsed };
  }

  markWebhookProcessed(eventId: string): void {
    this.processedWebhooks.add(eventId);
  }

  /** Simulate provider emitting a fill event (for webhook/polling tests). */
  emitFill(externalOperationId: string, quantityUnits: string, now: UtcInstant): ProviderFillEvent | null {
    const order = this.orders.get(externalOperationId);
    if (!order) return null;
    const fill = this.createFill(order, quantityUnits, now);
    const totalFilled = [...order.fills, fill].reduce((sum, f) => sum + BigInt(f.quantityUnits), 0n);
    const requested = BigInt(order.request.quantityUnits);
    const status = totalFilled >= requested ? 'FILLED' : 'PARTIAL';
    this.orders.set(
      externalOperationId,
      Object.freeze({ ...order, fills: Object.freeze([...order.fills, fill]), status }),
    );
    return fill;
  }

  /** Simulate partial fill for multi-fill scenarios. */
  emitPartialFill(externalOperationId: string, quantityUnits: string, now: UtcInstant): ProviderFillEvent | null {
    return this.emitFill(externalOperationId, quantityUnits, now);
  }

  advanceScenarioFill(externalOperationId: string, now: UtcInstant): readonly ProviderFillEvent[] {
    const order = this.orders.get(externalOperationId);
    if (!order) return Object.freeze([]);

    if (this.scenario === 'ACKNOWLEDGE_THEN_FILL') {
      const fill = this.emitFill(externalOperationId, order.request.quantityUnits, now);
      return fill ? Object.freeze([fill]) : Object.freeze([]);
    }

    if (this.scenario === 'ACKNOWLEDGE_THEN_PARTIAL_THEN_FILL') {
      const requested = BigInt(order.request.quantityUnits);
      const alreadyFilled = order.fills.reduce((sum, f) => sum + BigInt(f.quantityUnits), 0n);
      if (alreadyFilled === 0n) {
        const partialQty = (requested / 2n).toString();
        const fill = this.emitPartialFill(externalOperationId, partialQty, now);
        return fill ? Object.freeze([fill]) : Object.freeze([]);
      }
      const remaining = (requested - alreadyFilled).toString();
      const fill = this.emitFill(externalOperationId, remaining, now);
      return fill ? Object.freeze([fill]) : Object.freeze([]);
    }

    return Object.freeze([]);
  }

  getOrderState(externalOperationId: string): ProviderOrderState | null {
    return this.orders.get(externalOperationId) ?? null;
  }

  private resolveFills(order: ProviderOrderState): readonly ProviderFillEvent[] {
    if (order.fills.length > 0) {
      return order.fills;
    }
    return Object.freeze([]);
  }

  private createFill(order: ProviderOrderState, quantityUnits: string, now?: UtcInstant): ProviderFillEvent {
    this.fillCounter += 1;
    const ts = now ?? asUtcInstant(new Date().toISOString());
    return Object.freeze({
      providerFillId: `sbx_fill_${String(this.fillCounter).padStart(6, '0')}`,
      instrumentId: order.request.instrumentId,
      quantityUnits,
      priceMinorUnits: '10000',
      feeMinorUnits: '25',
      currency: order.request.currency,
      venue: 'SANDBOX_VENUE',
      liquidityRole: 'TAKER',
      providerTimestamp: ts,
    });
  }
}
