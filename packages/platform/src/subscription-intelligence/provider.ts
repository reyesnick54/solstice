import type { ActionCapabilities } from './models.ts';
import type { ActionCapabilityLevel, SubscriptionCategory } from './taxonomy.ts';

export type ProviderActionRequest = {
  readonly actionId: string;
  readonly obligationId: string;
  readonly merchantNormalized: string;
  readonly actionType: string;
  readonly idempotencyKey: string;
};

export type ProviderActionResult =
  | {
      readonly outcome: 'CONFIRMED';
      readonly providerId: string;
      readonly evidenceRef: string;
      readonly message: string;
    }
  | {
      readonly outcome: 'REQUEST_SENT';
      readonly providerId: string;
      readonly evidenceRef: string;
      readonly message: string;
    }
  | {
      readonly outcome: 'FAILED';
      readonly providerId: string | null;
      readonly code: 'ACTION_NOT_AVAILABLE' | 'PROVIDER_TIMEOUT' | 'PROVIDER_FAILURE' | 'PROVIDER_REJECTED';
      readonly message: string;
    };

export type SubscriptionActionProvider = {
  readonly providerId: string;
  readonly supportedMerchants: readonly string[];
  readonly cancelSubscription: (request: ProviderActionRequest) => Promise<ProviderActionResult>;
  readonly renegotiateBill: (request: ProviderActionRequest) => Promise<ProviderActionResult>;
};

export function defaultActionCapabilities(category: SubscriptionCategory): ActionCapabilities {
  const streaming = category === 'STREAMING' || category === 'MEDIA' || category === 'SOFTWARE';
  const telecom = category === 'TELECOMMUNICATIONS';
  const utility = category === 'UTILITIES';
  return Object.freeze({
    cancel: streaming ? 'PROVIDER_REQUIRED' : utility ? 'MANUAL_USER_ACTION' : 'ADVISORY_ONLY',
    downgrade: streaming ? 'PROVIDER_REQUIRED' : 'ADVISORY_ONLY',
    renegotiate: telecom ? 'PROVIDER_REQUIRED' : 'ADVISORY_ONLY',
    switchProvider: telecom || utility ? 'MANUAL_USER_ACTION' : 'ADVISORY_ONLY',
  });
}

export function capabilityForAction(
  capabilities: ActionCapabilities,
  actionType: string,
): ActionCapabilityLevel {
  switch (actionType) {
    case 'CANCEL':
      return capabilities.cancel;
    case 'DOWNGRADE':
      return capabilities.downgrade;
    case 'RENEGOTIATE':
      return capabilities.renegotiate;
    case 'SWITCH_PROVIDER':
      return capabilities.switchProvider;
    default:
      return 'ADVISORY_ONLY';
  }
}

/**
 * Unavailable provider — truthfully returns ACTION_NOT_AVAILABLE.
 */
export class UnavailableSubscriptionActionProvider implements SubscriptionActionProvider {
  readonly providerId = 'unavailable';
  readonly supportedMerchants = Object.freeze([] as const);

  async cancelSubscription(): Promise<ProviderActionResult> {
    return Object.freeze({
      outcome: 'FAILED',
      providerId: null,
      code: 'ACTION_NOT_AVAILABLE',
      message: 'No certified subscription cancellation provider is configured',
    });
  }

  async renegotiateBill(): Promise<ProviderActionResult> {
    return Object.freeze({
      outcome: 'FAILED',
      providerId: null,
      code: 'ACTION_NOT_AVAILABLE',
      message: 'No certified bill negotiation provider is configured',
    });
  }
}

/**
 * Simulation provider for certified rehearsal only. Not a live integration.
 */
export class SimulationSubscriptionActionProvider implements SubscriptionActionProvider {
  readonly providerId = 'simulation_subscription_provider';
  readonly supportedMerchants = Object.freeze([
    'netflix',
    'spotify',
    'hulu',
    'disney',
    'microsoft_365',
    'adobe_creative_cloud',
  ]);

  private readonly confirmed = new Set<string>();

  async cancelSubscription(request: ProviderActionRequest): Promise<ProviderActionResult> {
    const key = request.merchantNormalized.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    if (!this.supportedMerchants.some((merchant) => key.includes(merchant.replace(/_/g, '')))) {
      return Object.freeze({
        outcome: 'FAILED',
        providerId: this.providerId,
        code: 'ACTION_NOT_AVAILABLE',
        message: `Simulation provider does not support ${request.merchantNormalized}`,
      });
    }
    if (request.idempotencyKey.endsWith('_timeout')) {
      return Object.freeze({
        outcome: 'FAILED',
        providerId: this.providerId,
        code: 'PROVIDER_TIMEOUT',
        message: 'Simulation provider timeout',
      });
    }
    if (request.idempotencyKey.endsWith('_fail')) {
      return Object.freeze({
        outcome: 'FAILED',
        providerId: this.providerId,
        code: 'PROVIDER_FAILURE',
        message: 'Simulation provider failure',
      });
    }
    const evidenceRef = `sim_cancel_${request.actionId}`;
    this.confirmed.add(evidenceRef);
    return Object.freeze({
      outcome: 'CONFIRMED',
      providerId: this.providerId,
      evidenceRef,
      message: 'Simulation cancellation confirmed with provider evidence',
    });
  }

  async renegotiateBill(): Promise<ProviderActionResult> {
    return Object.freeze({
      outcome: 'FAILED',
      providerId: this.providerId,
      code: 'ACTION_NOT_AVAILABLE',
      message: 'Bill negotiation is not available in simulation',
    });
  }
}

export function resolveProvider(
  providers: readonly SubscriptionActionProvider[],
  merchantNormalized: string,
): SubscriptionActionProvider {
  const key = merchantNormalized.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  for (const provider of providers) {
    if (provider.supportedMerchants.some((merchant) => key.includes(merchant.replace(/_/g, '')))) {
      return provider;
    }
  }
  return new UnavailableSubscriptionActionProvider();
}
