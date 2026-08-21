import { CAPABILITIES, ENVIRONMENT } from '../../../../packages/config/src/flags.ts';
import type { BffPrincipal, FeatureCapability, FeatureCapabilityMap, OptionalDomainPort } from './ports.ts';
import type { ClientResourceState, ProductAvailability, ProviderAvailability } from './types.ts';

export type CapabilityInputs = {
  readonly principal: BffPrincipal;
  readonly grow?: OptionalDomainPort;
  readonly agent?: OptionalDomainPort;
  readonly exchange?: OptionalDomainPort;
  readonly payments?: OptionalDomainPort;
  readonly cards?: OptionalDomainPort;
  readonly vault?: OptionalDomainPort;
  readonly fx?: OptionalDomainPort;
  readonly providerDown?: Readonly<Record<string, boolean>>;
};

function feature(input: {
  readonly key: string;
  readonly availability: ProductAvailability;
  readonly provider: ProviderAvailability;
  readonly eligible: boolean;
  readonly pendingVerification: boolean;
  readonly providerDown: boolean;
  readonly productized: boolean;
  readonly reasonIfDisabled: string;
}): FeatureCapability {
  if (!input.productized) {
    return Object.freeze({
      key: input.key,
      enabled: false,
      availability: 'NOT_YET_PRODUCTIZED',
      state: 'FEATURE_DISABLED',
      provider: input.provider,
      reason: input.reasonIfDisabled,
    });
  }
  if (input.providerDown) {
    return Object.freeze({
      key: input.key,
      enabled: false,
      availability: input.availability,
      state: 'PROVIDER_UNAVAILABLE',
      provider: 'UNAVAILABLE',
      reason: `${input.key} provider is unavailable`,
    });
  }
  if (input.pendingVerification) {
    return Object.freeze({
      key: input.key,
      enabled: false,
      availability: input.availability,
      state: 'PENDING_VERIFICATION',
      provider: input.provider,
      reason: 'verification must complete before this feature is available',
    });
  }
  if (!input.eligible) {
    return Object.freeze({
      key: input.key,
      enabled: false,
      availability: input.availability,
      state: 'USER_INELIGIBLE',
      provider: input.provider,
      reason: 'user eligibility or restriction forbids this feature',
    });
  }
  const simulation = ENVIRONMENT === 'simulation' || CAPABILITIES.LIVE_MONEY_ENABLED === false;
  const state: ClientResourceState = simulation ? 'SIMULATION_ONLY' : 'READY';
  return Object.freeze({
    key: input.key,
    enabled: true,
    availability: simulation ? 'AVAILABLE_SIMULATION' : input.availability,
    state,
    provider: input.provider,
    reason: simulation ? 'ENVIRONMENT is simulation; live connectivity remains disabled' : 'available',
  });
}

export function computeCapabilities(input: CapabilityInputs): FeatureCapabilityMap {
  const { principal } = input;
  const restricted = principal.restricted || principal.customerStatus === 'SUSPENDED';
  const pending =
    !restricted &&
    (principal.verification !== 'VERIFIED' ||
      principal.customerStatus === 'PENDING_VERIFICATION' ||
      principal.customerStatus === 'PROSPECT');
  const down = input.providerDown ?? {};

  const payments = feature({
    key: 'payments',
    availability: 'AVAILABLE_SIMULATION',
    provider: CAPABILITIES.LIVE_PAYMENTS_ENABLED ? 'SANDBOX' : 'SIMULATED',
    eligible: !restricted && principal.capabilities.includes('PAYMENT_REQUEST'),
    pendingVerification: pending,
    providerDown: down.payments === true,
    productized: true,
    reasonIfDisabled: 'payments are not productized',
  });
  const fx = feature({
    key: 'fx',
    availability: 'AVAILABLE_SIMULATION',
    provider: 'SIMULATED',
    eligible: !restricted && principal.capabilities.includes('FX_QUOTE_REQUEST'),
    pendingVerification: pending,
    providerDown: down.fx === true,
    productized: true,
    reasonIfDisabled: 'fx is not productized',
  });
  const cards = feature({
    key: 'cards',
    availability: 'AVAILABLE_SIMULATION',
    provider: CAPABILITIES.LIVE_MONEY_ENABLED ? 'SANDBOX' : 'SIMULATED',
    eligible: !restricted && principal.capabilities.includes('CARD_MANAGE_REQUEST'),
    pendingVerification: pending,
    providerDown: down.cards === true,
    productized: true,
    reasonIfDisabled: 'cards are not productized',
  });
  const grow = feature({
    key: 'grow',
    availability: 'AVAILABLE_SIMULATION',
    provider: 'SIMULATED',
    eligible: !restricted && principal.capabilities.includes('VIEW_GROWTH_PLAN'),
    pendingVerification: false,
    providerDown: down.grow === true,
    productized: true,
    reasonIfDisabled: 'Grow My Money is not productized',
  });
  const agent = feature({
    key: 'agent',
    availability: 'AVAILABLE_SIMULATION',
    provider: 'SIMULATED',
    eligible: !restricted,
    pendingVerification: false,
    providerDown: false,
    productized: true,
    reasonIfDisabled: 'agent is not productized',
  });
  const exchange = feature({
    key: 'exchange',
    availability: 'AVAILABLE_SIMULATION',
    provider: CAPABILITIES.LIVE_EXCHANGE_ENABLED ? 'SANDBOX' : 'SIMULATED',
    eligible: !restricted && principal.capabilities.includes('EXCHANGE_VIEW'),
    pendingVerification: pending,
    providerDown: down.exchange === true,
    productized: true,
    reasonIfDisabled: 'exchange is not productized',
  });
  const withdrawals = feature({
    key: 'withdrawals',
    availability: 'AVAILABLE_SIMULATION',
    provider: 'SIMULATED',
    eligible: !restricted && principal.capabilities.includes('POST_WITHDRAWAL_REQUEST'),
    pendingVerification: pending,
    providerDown: down.payments === true,
    productized: true,
    reasonIfDisabled: 'withdrawals are not productized',
  });
  const dataVault = feature({
    key: 'dataVault',
    availability: 'AVAILABLE_SIMULATION',
    provider: 'SIMULATED',
    eligible: !restricted && principal.capabilities.includes('VAULT_VIEW_OWN'),
    pendingVerification: false,
    providerDown: down.vault === true,
    productized: true,
    reasonIfDisabled: 'data vault is not productized',
  });

  void input.grow;
  void input.agent;
  void input.exchange;
  void input.payments;
  void input.cards;
  void input.vault;
  void input.fx;

  return Object.freeze({
    paymentsEnabled: payments.enabled,
    fxEnabled: fx.enabled,
    cardsEnabled: cards.enabled,
    growEnabled: grow.enabled,
    agentEnabled: agent.enabled,
    exchangeEnabled: exchange.enabled,
    withdrawalsEnabled: withdrawals.enabled,
    dataVaultEnabled: dataVault.enabled,
    details: Object.freeze({
      payments,
      fx,
      cards,
      grow,
      agent,
      exchange,
      withdrawals,
      dataVault,
    }),
  });
}
