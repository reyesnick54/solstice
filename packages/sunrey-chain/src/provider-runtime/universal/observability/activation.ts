/**
 * Provider activation policy and kill switches.
 * Global, category, and per-provider disable paths.
 */

import type { ProviderCategory } from '../types.ts';
import type { DeploymentTier } from './types.ts';

export type ProviderActivationConfig = {
  readonly providersEnabled: boolean;
  readonly categoryEnabled: Readonly<Partial<Record<ProviderCategory, boolean>>>;
  readonly providerEnabled: Readonly<Record<string, boolean>>;
  readonly tierActivation: Readonly<Partial<Record<DeploymentTier, Readonly<Record<string, LaunchState>>>>>;
};

export type LaunchState = 'enabled' | 'disabled' | 'blocked';

const CATEGORY_ENV_PREFIX: Record<ProviderCategory, string> = {
  BANKING: 'BANKING',
  PAYMENTS: 'PAYMENT',
  FX: 'FX',
  CARDS: 'CARD',
  IDENTITY: 'IDENTITY',
  KYC: 'KYC',
  KYB: 'KYB',
  AML: 'AML',
  SANCTIONS: 'SANCTIONS',
  FRAUD: 'FRAUD',
  TRAVEL_RULE: 'TRAVEL_RULE',
  CUSTODY: 'CUSTODY',
  BLOCKCHAIN_ANALYTICS: 'BLOCKCHAIN_ANALYTICS',
  MARKET_DATA: 'MARKET',
  ORACLE: 'ORACLE',
  INVESTMENTS: 'INVESTMENT',
};

export function defaultActivationConfig(): ProviderActivationConfig {
  return Object.freeze({
    providersEnabled: true,
    categoryEnabled: Object.freeze({}),
    providerEnabled: Object.freeze({}),
    tierActivation: Object.freeze({}),
  });
}

export function readActivationFromEnv(
  env: Readonly<Record<string, string | undefined>> = process.env,
): ProviderActivationConfig {
  const providersEnabled = parseBool(env.PROVIDERS_ENABLED, true);
  const categoryEnabled: Partial<Record<ProviderCategory, boolean>> = {};
  for (const [category, prefix] of Object.entries(CATEGORY_ENV_PREFIX)) {
    const key = `${prefix}_PROVIDERS_ENABLED`;
    if (env[key] !== undefined) {
      categoryEnabled[category as ProviderCategory] = parseBool(env[key], true);
    }
  }
  const providerEnabled: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(env)) {
    const match = /^PROVIDER_([A-Z0-9_]+)_ENABLED$/.exec(key);
    if (match && value !== undefined) {
      const providerId = match[1]!.toLowerCase().replace(/_/g, '-');
      providerEnabled[providerId] = parseBool(value, true);
    }
  }
  return Object.freeze({
    providersEnabled,
    categoryEnabled: Object.freeze(categoryEnabled),
    providerEnabled: Object.freeze(providerEnabled),
    tierActivation: Object.freeze({}),
  });
}

export function providerEnvKey(providerId: string): string {
  return `PROVIDER_${providerId.toUpperCase().replace(/-/g, '_')}_ENABLED`;
}

export function isProviderActivated(input: {
  readonly config: ProviderActivationConfig;
  readonly providerId: string;
  readonly category: ProviderCategory;
  readonly deploymentTier: DeploymentTier;
  readonly tierState?: LaunchState;
}): { readonly enabled: boolean; readonly blocked: boolean; readonly reason: string } {
  if (!input.config.providersEnabled) {
    return Object.freeze({ enabled: false, blocked: true, reason: 'global external-provider kill switch is off' });
  }
  const categoryFlag = input.config.categoryEnabled[input.category];
  if (categoryFlag === false) {
    return Object.freeze({
      enabled: false,
      blocked: true,
      reason: `category kill switch is off for ${input.category}`,
    });
  }
  const providerFlag = input.config.providerEnabled[input.providerId];
  if (providerFlag === false) {
    return Object.freeze({
      enabled: false,
      blocked: false,
      reason: `provider kill switch is off for ${input.providerId}`,
    });
  }
  const tierOverrides = input.config.tierActivation[input.deploymentTier];
  const tierState = input.tierState ?? tierOverrides?.[input.providerId];
  if (tierState === 'blocked') {
    return Object.freeze({
      enabled: false,
      blocked: true,
      reason: `${input.providerId} is blocked in ${input.deploymentTier}`,
    });
  }
  if (tierState === 'disabled') {
    return Object.freeze({
      enabled: false,
      blocked: false,
      reason: `${input.providerId} is disabled in ${input.deploymentTier}`,
    });
  }
  return Object.freeze({ enabled: true, blocked: false, reason: 'provider is activated for this tier' });
}

export function withTierActivation(
  config: ProviderActivationConfig,
  tier: DeploymentTier,
  providerId: string,
  state: LaunchState,
): ProviderActivationConfig {
  const existing = config.tierActivation[tier] ?? {};
  return Object.freeze({
    ...config,
    tierActivation: Object.freeze({
      ...config.tierActivation,
      [tier]: Object.freeze({ ...existing, [providerId]: state }),
    }),
  });
}

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
    return true;
  }
  if (normalized === 'false' || normalized === '0' || normalized === 'no') {
    return false;
  }
  return fallback;
}
