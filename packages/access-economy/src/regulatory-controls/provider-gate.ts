/**
 * ACCESS Wave 5 — Provider contract gate for production fulfillment.
 */

import type { AccessProviderContractState } from './taxonomy.ts';
import type { AccessProviderContractGate } from './types.ts';

const PRODUCTION_FULFILLMENT_STATES: readonly AccessProviderContractState[] = Object.freeze([
  'SIGNED',
  'APPROVED_FOR_PRODUCTION',
]);

const DISCOVERY_ONLY_STATES: readonly AccessProviderContractState[] = Object.freeze([
  'SANDBOX',
  'DISCOVERY_ONLY',
]);

export function evaluateProviderContractGate(input: {
  readonly providerId: string;
  readonly contractState: AccessProviderContractState;
  readonly evidenceReference?: string | null;
}): AccessProviderContractGate {
  const allowsProductionFulfillment = PRODUCTION_FULFILLMENT_STATES.includes(input.contractState);
  const allowsDiscoveryOnly = DISCOVERY_ONLY_STATES.includes(input.contractState);
  return Object.freeze({
    providerId: input.providerId,
    contractState: input.contractState,
    allowsProductionFulfillment,
    allowsDiscoveryOnly,
    evidenceReference: input.evidenceReference ?? null,
  });
}

export function assertProductionFulfillmentAllowed(gate: AccessProviderContractGate): void {
  if (!gate.allowsProductionFulfillment) {
    throw new Error(
      `production booking blocked for provider ${gate.providerId}; contract state=${gate.contractState}`,
    );
  }
}

export function isBlockedProviderState(state: AccessProviderContractState): boolean {
  return state === 'TERMINATED' || state === 'BLOCKED';
}

export const DEFAULT_PROVIDER_CONTRACT_GATES: readonly AccessProviderContractGate[] = Object.freeze([
  evaluateProviderContractGate({ providerId: 'turo', contractState: 'APPROVED_FOR_PRODUCTION', evidenceReference: 'contract:turo-sim' }),
  evaluateProviderContractGate({ providerId: 'expedia', contractState: 'SANDBOX', evidenceReference: 'contract:expedia-sandbox' }),
  evaluateProviderContractGate({ providerId: 'airbnb', contractState: 'DISCOVERY_ONLY' }),
  evaluateProviderContractGate({ providerId: 'doordash', contractState: 'SIGNED', evidenceReference: 'contract:doordash-sim' }),
  evaluateProviderContractGate({ providerId: 'amazon', contractState: 'BLOCKED' }),
]);

export class AccessProviderContractGateRegistry {
  private readonly gates: Map<string, AccessProviderContractGate>;

  constructor(seed: readonly AccessProviderContractGate[] = DEFAULT_PROVIDER_CONTRACT_GATES) {
    this.gates = new Map(seed.map((row) => [row.providerId, row]));
  }

  get(providerId: string): AccessProviderContractGate | undefined {
    return this.gates.get(providerId);
  }

  assertProductionBooking(providerId: string): void {
    const gate = this.gates.get(providerId);
    if (!gate) {
      throw new Error(`unknown provider ${providerId}`);
    }
    if (isBlockedProviderState(gate.contractState)) {
      throw new Error(`provider ${providerId} is ${gate.contractState}`);
    }
    assertProductionFulfillmentAllowed(gate);
  }
}
