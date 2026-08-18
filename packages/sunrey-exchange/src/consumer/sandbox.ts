import { createHash } from 'node:crypto';

import type { ConsumerEnvironment } from './taxonomy.ts';

export type ConsumerSandboxAccount = {
  readonly sandboxId: string;
  readonly appId: string;
  readonly label: string;
  readonly identityClass: 'SANDBOX';
  readonly productionEligible: false;
  readonly environment: 'SANDBOX';
};

export type ConsumerSandboxContext = {
  readonly account: ConsumerSandboxAccount;
  readonly environment: 'SANDBOX';
  readonly productionLabel: 'NON_PRODUCTION';
  readonly syntheticAssetsOnly: true;
  readonly canTradeProduction: false;
  readonly portfolioMarkedNonProduction: true;
};

function deterministicId(prefix: string, seed: string): string {
  return `${prefix}_${createHash('sha256').update(seed).digest('hex').slice(0, 16)}`;
}

export function createConsumerSandbox(input: {
  readonly appId: string;
  readonly label: string;
  readonly now?: string;
}): ConsumerSandboxContext {
  void input.now;
  const sandboxId = deterministicId('sbx', `${input.appId}:${input.label}`);
  const account: ConsumerSandboxAccount = Object.freeze({
    sandboxId,
    appId: input.appId,
    label: input.label,
    identityClass: 'SANDBOX',
    productionEligible: false,
    environment: 'SANDBOX',
  });
  return Object.freeze({
    account,
    environment: 'SANDBOX',
    productionLabel: 'NON_PRODUCTION',
    syntheticAssetsOnly: true,
    canTradeProduction: false,
    portfolioMarkedNonProduction: true,
  });
}

export function sandboxEnvironmentGuard(environment: ConsumerEnvironment): {
  readonly allowed: boolean;
  readonly reason: string | null;
} {
  if (environment === 'PRODUCTION') {
    return Object.freeze({ allowed: false, reason: 'SANDBOX_CANNOT_TRADE_PRODUCTION' });
  }
  return Object.freeze({ allowed: true, reason: null });
}
