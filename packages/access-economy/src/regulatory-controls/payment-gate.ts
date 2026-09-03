// @ts-nocheck
/**
 * ACCESS Wave 5 — Payment provider environment gate.
 *
 * Sandbox card issuer must not be enabled accidentally in production.
 */

import type { AccessPaymentProviderState } from './taxonomy.ts';
import type { AccessPaymentProviderGate } from './types.ts';

export function evaluatePaymentProviderGate(input: {
  readonly paymentProviderId: string;
  readonly state: AccessPaymentProviderState;
  readonly environment: 'simulation' | 'sandbox' | 'production';
  readonly credentialsValid: boolean;
  readonly complianceReady: boolean;
}): AccessPaymentProviderGate {
  const { environment } = input;
  const allowsProductionSettlement =
    environment === 'simulation'
      ? input.state === 'SANDBOX_ONLY' || input.state === 'APPROVED_FOR_PRODUCTION'
      : input.state === 'APPROVED_FOR_PRODUCTION' &&
        input.credentialsValid &&
        input.complianceReady &&
        environment !== 'simulation';

  return Object.freeze({
    paymentProviderId: input.paymentProviderId,
    state: input.state,
    environment,
    credentialsValid: input.credentialsValid,
    complianceReady: input.complianceReady,
    allowsProductionSettlement,
  });
}

export function assertProductionSettlementAllowed(gate: AccessPaymentProviderGate): void {
  if (gate.state === 'SANDBOX_ONLY' && gate.environment !== 'simulation') {
    throw new Error(
      `sandbox payment provider ${gate.paymentProviderId} cannot settle in ${gate.environment}`,
    );
  }
  if (!gate.allowsProductionSettlement) {
    throw new Error(
      `payment provider ${gate.paymentProviderId} not approved for production settlement`,
    );
  }
}

export const DEFAULT_PAYMENT_PROVIDER_GATES: readonly AccessPaymentProviderGate[] = Object.freeze([
  evaluatePaymentProviderGate({
    paymentProviderId: 'restricted-virtual-card-sim',
    state: 'SANDBOX_ONLY',
    environment: 'simulation',
    credentialsValid: true,
    complianceReady: true,
  }),
  evaluatePaymentProviderGate({
    paymentProviderId: 'fiat-payments-sim',
    state: 'APPROVED_FOR_PRODUCTION',
    environment: 'simulation',
    credentialsValid: true,
    complianceReady: true,
  }),
]);

export class AccessPaymentProviderGateRegistry {
  private readonly gates: Map<string, AccessPaymentProviderGate>;

  constructor(seed: readonly AccessPaymentProviderGate[] = DEFAULT_PAYMENT_PROVIDER_GATES) {
    this.gates = new Map(seed.map((row) => [row.paymentProviderId, row]));
  }

  get(paymentProviderId: string): AccessPaymentProviderGate | undefined {
    return this.gates.get(paymentProviderId);
  }

  assertSettlement(paymentProviderId: string): void {
    const gate = this.gates.get(paymentProviderId);
    if (!gate) {
      throw new Error(`unknown payment provider ${paymentProviderId}`);
    }
    assertProductionSettlementAllowed(gate);
  }
}
