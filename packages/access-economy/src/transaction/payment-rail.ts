/**
 * ACCESS Wave 3 / Prompt 36 — payment rail abstraction (simulation only).
 *
 * No live card network or bank connectivity. Virtual-card rail is sandbox-only.
 */

import { randomUUID } from 'node:crypto';

import type { UtcInstant } from '../../../domain/src/time.ts';
import type { AccessPaymentRailId, PaymentAuthorizationResult } from './types.ts';

export type AuthorizePaymentInput = {
  readonly transactionId: string;
  readonly amountMinorUnits: bigint;
  readonly currency: string;
  readonly rail: AccessPaymentRailId;
  readonly idempotencyKey: string;
  readonly now: UtcInstant;
  readonly restrictedMerchantAmountMinorUnits?: bigint;
  readonly securityDepositSeparate?: boolean;
};

export type CapturePaymentInput = {
  readonly authorizationId: string;
  readonly amountMinorUnits: bigint;
  readonly idempotencyKey: string;
  readonly now: UtcInstant;
};

export type VoidPaymentInput = {
  readonly authorizationId: string;
  readonly idempotencyKey: string;
  readonly now: UtcInstant;
};

export type RefundPaymentInput = {
  readonly captureId: string;
  readonly amountMinorUnits: bigint;
  readonly idempotencyKey: string;
  readonly now: UtcInstant;
};

export type PaymentRailOutcome<T> =
  | { readonly ok: true; readonly value: T; readonly idempotent?: true }
  | { readonly ok: false; readonly code: string; readonly message: string };

type InternalAuth = PaymentAuthorizationResult & {
  readonly transactionId: string;
  readonly idempotencyKey: string;
};

export type AccessPaymentRailConfig = {
  readonly virtualCardProductionBlocked?: boolean;
  readonly failNextAuthorization?: boolean;
  readonly failNextCapture?: boolean;
  readonly simulateTimeout?: boolean;
};

export class AccessPaymentRail {
  private readonly authorizations = new Map<string, InternalAuth>();
  private readonly byAuthIdempotency = new Map<string, InternalAuth>();
  private readonly byCaptureIdempotency = new Map<string, string>();
  private readonly config: AccessPaymentRailConfig;

  constructor(config?: AccessPaymentRailConfig) {
    this.config = config ?? {};
  }

  getVirtualCardStatus(): { readonly rail: 'PROVIDER_VIRTUAL_CARD'; readonly status: 'SANDBOX_ONLY' | 'BLOCKED' } {
    if (this.config.virtualCardProductionBlocked ?? true) {
      return Object.freeze({ rail: 'PROVIDER_VIRTUAL_CARD', status: 'SANDBOX_ONLY' });
    }
    return Object.freeze({ rail: 'PROVIDER_VIRTUAL_CARD', status: 'BLOCKED' });
  }

  authorize(input: AuthorizePaymentInput): PaymentRailOutcome<PaymentAuthorizationResult> {
    const prior = this.byAuthIdempotency.get(input.idempotencyKey);
    if (prior) {
      return { ok: true, value: prior, idempotent: true };
    }
    if (this.config.failNextAuthorization) {
      return { ok: false, code: 'AUTHORIZATION_DECLINED', message: 'simulated authorization failure' };
    }
    if (input.rail === 'PROVIDER_VIRTUAL_CARD' && this.getVirtualCardStatus().status === 'BLOCKED') {
      return { ok: false, code: 'RAIL_BLOCKED', message: 'virtual card rail is blocked in simulation' };
    }
    const auth: InternalAuth = Object.freeze({
      authorizationId: `auth_${randomUUID()}`,
      amountMinorUnits: input.amountMinorUnits,
      currency: input.currency,
      rail: input.rail,
      captured: false,
      captureId: null,
      voided: false,
      refundedMinorUnits: 0n,
      transactionId: input.transactionId,
      idempotencyKey: input.idempotencyKey,
    });
    this.authorizations.set(auth.authorizationId, auth);
    this.byAuthIdempotency.set(input.idempotencyKey, auth);
    return { ok: true, value: auth };
  }

  capture(input: CapturePaymentInput): PaymentRailOutcome<PaymentAuthorizationResult> {
    const priorCapture = this.byCaptureIdempotency.get(input.idempotencyKey);
    if (priorCapture) {
      const auth = this.authorizations.get(priorCapture);
      if (auth) {
        return { ok: true, value: auth, idempotent: true };
      }
    }
    const auth = this.authorizations.get(input.authorizationId);
    if (!auth || auth.voided) {
      return { ok: false, code: 'NOT_FOUND', message: 'authorization not found or voided' };
    }
    if (this.config.failNextCapture) {
      return { ok: false, code: 'CAPTURE_FAILED', message: 'simulated capture failure' };
    }
    const captureId = `cap_${randomUUID()}`;
    const updated: InternalAuth = Object.freeze({
      ...auth,
      captured: true,
      captureId,
    });
    this.authorizations.set(auth.authorizationId, updated);
    this.byAuthIdempotency.set(auth.idempotencyKey, updated);
    this.byCaptureIdempotency.set(input.idempotencyKey, auth.authorizationId);
    return { ok: true, value: updated };
  }

  void(input: VoidPaymentInput): PaymentRailOutcome<PaymentAuthorizationResult> {
    const auth = this.authorizations.get(input.authorizationId);
    if (!auth) {
      return { ok: false, code: 'NOT_FOUND', message: 'authorization not found' };
    }
    if (auth.captured) {
      return { ok: false, code: 'ALREADY_CAPTURED', message: 'cannot void captured authorization' };
    }
    const updated: InternalAuth = Object.freeze({ ...auth, voided: true });
    this.authorizations.set(auth.authorizationId, updated);
    this.byAuthIdempotency.set(auth.idempotencyKey, updated);
    return { ok: true, value: updated };
  }

  refund(input: RefundPaymentInput): PaymentRailOutcome<PaymentAuthorizationResult> {
    const auth = [...this.authorizations.values()].find((row) => row.captureId === input.captureId);
    if (!auth) {
      return { ok: false, code: 'NOT_FOUND', message: 'capture not found' };
    }
    const newRefundTotal = auth.refundedMinorUnits + input.amountMinorUnits;
    if (newRefundTotal > auth.amountMinorUnits) {
      return { ok: false, code: 'REFUND_EXCEEDS_CAPTURE', message: 'refund exceeds captured amount' };
    }
    const updated: InternalAuth = Object.freeze({
      ...auth,
      refundedMinorUnits: newRefundTotal,
    });
    this.authorizations.set(auth.authorizationId, updated);
    this.byAuthIdempotency.set(auth.idempotencyKey, updated);
    return { ok: true, value: updated };
  }

  getAuthorization(authorizationId: string): PaymentAuthorizationResult | null {
    return this.authorizations.get(authorizationId) ?? null;
  }

  configure(config: Partial<AccessPaymentRailConfig>): void {
    Object.assign(this.config, config);
  }
}
