/**
 * Simulation rail adapter that implements the production rail contract.
 * Wraps SimulatedRailAdapter so simulation and production share one port.
 */

import { asUtcInstant } from '../../../domain/src/time.ts';
import { SimulatedRailAdapter } from '../../rail-adapters.ts';
import type { RailCapability } from '../../rail-capability.ts';
import type { RailReturnMessage } from '../../rail-port.ts';
import { emptyRailReferences } from '../../rail-ids.ts';
import type { AdapterHealth } from '../types.ts';
import type { PaymentRailProductKind } from './kinds.ts';
import { mapRailProductKind } from './kinds.ts';
import type {
  PaymentQuoteRouteInfo,
  ProductionRailAdapter,
  RetrievedPaymentReturn,
  RetrievedPaymentTransaction,
} from './port.ts';
import { normalizePaymentProviderStatus, type NormalizedPaymentState } from './status.ts';

export class SimulatedProductionRailAdapter extends SimulatedRailAdapter implements ProductionRailAdapter {
  readonly lifecycle = 'SIMULATED' as const;
  readonly productKind: PaymentRailProductKind;
  readonly canPostLedger = false as const;
  readonly canIssueExecutionAuthority = false as const;
  private readonly returns = new Map<string, RailReturnMessage>();

  constructor(capability: RailCapability, productKind: PaymentRailProductKind) {
    super(capability);
    const mapped = mapRailProductKind(productKind);
    if (mapped.engineeringRailClass !== capability.rail) {
      throw new TypeError(
        `product kind ${productKind} maps to ${mapped.engineeringRailClass}, not ${capability.rail}`,
      );
    }
    this.productKind = productKind;
  }

  quoteRoute(): PaymentQuoteRouteInfo {
    return Object.freeze({
      kind: this.productKind,
      providerId: this.capability.provider,
      estimatedSettlementClass: this.capability.expectedSettlementClass,
      cancellationSupported: this.capability.cancellationSupported,
      liveConnected: false,
      namedNetworkMembership: false,
    });
  }

  retrieveTransaction(paymentId: string): RetrievedPaymentTransaction {
    const queried = this.queryPayment({
      paymentId: paymentId as never,
      idempotencyKey: `idemp_${paymentId}` as never,
      providerPaymentId: null,
    });
    const normalized = this.normalizeStatus(queried.providerStatus);
    return Object.freeze({
      found: queried.found,
      status: queried.status,
      normalized: normalized.canonical,
      references: queried.found ? queried.references : emptyRailReferences(),
      originalProviderStatus: queried.providerStatus,
    });
  }

  retrieveReturn(paymentId: string): RetrievedPaymentReturn {
    const message = this.returns.get(paymentId) ?? null;
    return Object.freeze({ found: message !== null, message });
  }

  retrieveSettlementReference(paymentId: string): string | null {
    const tx = this.retrieveTransaction(paymentId);
    return tx.found ? tx.references.settlementReference : null;
  }

  normalizeStatus(providerStatus: string): NormalizedPaymentState {
    return normalizePaymentProviderStatus(providerStatus);
  }

  override applyReturn(message: RailReturnMessage): RailReturnMessage {
    this.returns.set(message.paymentId, message);
    return super.applyReturn(message);
  }

  productionHealth(): AdapterHealth {
    const snapshot = this.health();
    return Object.freeze({
      providerId: snapshot.provider,
      domain: this.productKind === 'INTERNATIONAL_REMITTANCE' ? 'INTERNATIONAL_REMITTANCE' : 'PAYMENT_RAIL',
      lifecycle: this.lifecycle,
      healthy: snapshot.health === 'AVAILABLE' || snapshot.health === 'DEGRADED',
      connectivity: 'SIMULATION',
      checkedAt: asUtcInstant(snapshot.checkedAt),
      live: false,
    });
  }
}
