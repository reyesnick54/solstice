import { asSettlementRef, type PaymentId, type SettlementRef } from './ids.ts';

export type SettlementOutcome =
  | {
      readonly kind: 'SUCCESS';
      readonly settlementRef: SettlementRef;
      readonly providerAmountMinorUnits: string;
      readonly providerCurrency: string;
    }
  | { readonly kind: 'FAIL_BEFORE_SUBMIT'; readonly reason: string }
  | { readonly kind: 'FAIL_AFTER_SUBMIT'; readonly reason: string; readonly settlementRef: SettlementRef }
  | { readonly kind: 'PENDING'; readonly settlementRef: SettlementRef }
  | {
      readonly kind: 'RETURNED';
      readonly settlementRef: SettlementRef;
      readonly providerAmountMinorUnits: string;
      readonly providerCurrency: string;
    };

export type SettlementRequest = {
  readonly paymentId: PaymentId;
  readonly idempotencyKey: string;
  readonly destinationCountry: string;
  readonly destinationCurrency: string;
  readonly destinationAmountMinorUnits: string;
  readonly routeId: string;
};

export type SimulatedSettlementRail = {
  submit(request: SettlementRequest): SettlementOutcome;
  complete(paymentId: PaymentId): SettlementOutcome;
};

export type RailMode = 'SUCCESS' | 'FAIL_BEFORE_SUBMIT' | 'FAIL_AFTER_SUBMIT' | 'PENDING' | 'RETURNED';

/**
 * In-process simulated rail. No external network. Chunk 10 adds real rails.
 */
export class InProcessSettlementRail implements SimulatedSettlementRail {
  private readonly modes = new Map<string, RailMode>();
  private readonly pending = new Map<string, SettlementRequest>();

  setMode(paymentId: string, mode: RailMode): void {
    this.modes.set(paymentId, mode);
  }

  submit(request: SettlementRequest): SettlementOutcome {
    const mode = this.modes.get(request.paymentId) ?? 'SUCCESS';
    const settlementRef = asSettlementRef(`sim_${request.idempotencyKey}`);
    if (mode === 'FAIL_BEFORE_SUBMIT') {
      return { kind: 'FAIL_BEFORE_SUBMIT', reason: 'simulated provider rejected before submission' };
    }
    if (mode === 'FAIL_AFTER_SUBMIT') {
      return {
        kind: 'FAIL_AFTER_SUBMIT',
        reason: 'simulated provider failed after submission',
        settlementRef,
      };
    }
    if (mode === 'PENDING') {
      this.pending.set(request.paymentId, request);
      return { kind: 'PENDING', settlementRef };
    }
    if (mode === 'RETURNED') {
      return {
        kind: 'RETURNED',
        settlementRef,
        providerAmountMinorUnits: request.destinationAmountMinorUnits,
        providerCurrency: request.destinationCurrency,
      };
    }
    return {
      kind: 'SUCCESS',
      settlementRef,
      providerAmountMinorUnits: request.destinationAmountMinorUnits,
      providerCurrency: request.destinationCurrency,
    };
  }

  complete(paymentId: PaymentId): SettlementOutcome {
    const request = this.pending.get(paymentId);
    if (!request) {
      return { kind: 'FAIL_BEFORE_SUBMIT', reason: 'no pending simulated submission' };
    }
    this.pending.delete(paymentId);
    return {
      kind: 'SUCCESS',
      settlementRef: asSettlementRef(`sim_${request.idempotencyKey}`),
      providerAmountMinorUnits: request.destinationAmountMinorUnits,
      providerCurrency: request.destinationCurrency,
    };
  }
}
