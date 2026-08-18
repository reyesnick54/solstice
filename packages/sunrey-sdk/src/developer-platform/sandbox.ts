import { createHash } from 'node:crypto';

import type { SandboxAccount } from './types.ts';

export type SandboxFixtureSet = {
  readonly wallet: { readonly accountId: string; readonly address: string; readonly label: 'NON_PRODUCTION' };
  readonly sunreyCoin: { readonly accountId: string; readonly asset: 'SUNREY_COIN'; readonly network: 'SANDBOX' };
  readonly moonreyCoin: { readonly accountId: string; readonly asset: 'MOONREY_COIN'; readonly network: 'SANDBOX' };
  readonly machine: { readonly machineId: string; readonly identityClass: 'SANDBOX' };
  readonly exchange: { readonly fixtureId: string; readonly marketId: string; readonly nonProduction: true };
  readonly oracle: { readonly fixtureId: string; readonly feedId: string; readonly nonProduction: true };
};

function deterministicId(prefix: string, seed: string): string {
  return `${prefix}_${createHash('sha256').update(seed).digest('hex').slice(0, 16)}`;
}

export function createSandboxAccount(input: {
  readonly appId: string;
  readonly label: string;
  readonly environment?: 'SANDBOX' | 'LOCAL';
  readonly now?: string;
}): { readonly account: SandboxAccount; readonly fixtures: SandboxFixtureSet } {
  const seed = `${input.appId}:${input.label}`;
  const sandboxId = deterministicId('sbx', seed);
  const walletAccountId = deterministicId('sbx.wallet', seed);
  const sunreyCoinAccountId = deterministicId('sbx.sun', seed);
  const moonreyCoinAccountId = deterministicId('sbx.moon', seed);
  const machineId = deterministicId('sbx.machine', seed);
  const exchangeFixtureId = deterministicId('sbx.ex', seed);
  const oracleFixtureId = deterministicId('sbx.oracle', seed);
  const account: SandboxAccount = Object.freeze({
    sandboxId,
    appId: input.appId,
    label: input.label,
    identityClass: 'SANDBOX',
    productionEligible: false,
    environment: input.environment ?? 'SANDBOX',
    walletAccountId,
    sunreyCoinAccountId,
    moonreyCoinAccountId,
    machineId,
    exchangeFixtureId,
    oracleFixtureId,
    createdAt: input.now ?? new Date().toISOString(),
  });
  const fixtures: SandboxFixtureSet = Object.freeze({
    wallet: Object.freeze({
      accountId: walletAccountId,
      address: `srdev1sandbox${sandboxId.slice(-8)}`,
      label: 'NON_PRODUCTION',
    }),
    sunreyCoin: Object.freeze({
      accountId: sunreyCoinAccountId,
      asset: 'SUNREY_COIN',
      network: 'SANDBOX',
    }),
    moonreyCoin: Object.freeze({
      accountId: moonreyCoinAccountId,
      asset: 'MOONREY_COIN',
      network: 'SANDBOX',
    }),
    machine: Object.freeze({ machineId, identityClass: 'SANDBOX' }),
    exchange: Object.freeze({
      fixtureId: exchangeFixtureId,
      marketId: 'mkt.sandbox.sunrey-usd',
      nonProduction: true,
    }),
    oracle: Object.freeze({
      fixtureId: oracleFixtureId,
      feedId: 'feed.sandbox.energy',
      nonProduction: true,
    }),
  });
  return { account, fixtures };
}

export function sandboxCannotBecomeProduction(account: SandboxAccount): { readonly ok: false; readonly reason: 'SANDBOX_IDENTITY' } {
  if (account.identityClass !== 'SANDBOX' || account.productionEligible !== false) {
    throw new Error('sandbox invariant broken');
  }
  return { ok: false, reason: 'SANDBOX_IDENTITY' };
}
