import type { SimulationRuntime } from '../../../accounts/src/runtime.ts';
import { ConsumerBff, memoryPreferenceStore } from './orchestrator.ts';
import { createAccountsReadAdapter } from './accounts-adapter.ts';
import type { BffErrorEnvelope } from './errors.ts';

/**
 * Transitional productization adapter for the hosted internal sandbox.
 *
 * Account/ledger-derived reads are served from the durable runtime while
 * non-financial product surfaces continue to use the existing preview world.
 * This deliberately does not claim that wallets, Exchange, Grow, Vault, or
 * other domains are durable yet.
 */
export function bindDurableFinancialReadModel(
  fixtureBff: ConsumerBff,
  durableRuntime: SimulationRuntime,
): ConsumerBff {
  const durableBff = new ConsumerBff({
    now: () => durableRuntime.clock.now(),
    accounts: createAccountsReadAdapter(durableRuntime),
    preferences: memoryPreferenceStore(),
  });

  return new Proxy(fixtureBff, {
    get(target, property) {
      if (property === 'listAccounts') {
        return durableBff.listAccounts.bind(durableBff);
      }
      if (property === 'getAccount') {
        return durableBff.getAccount.bind(durableBff);
      }
      if (property === 'accountActivity') {
        return durableBff.accountActivity.bind(durableBff);
      }
      if (property === 'accountStatement') {
        return durableBff.accountStatement.bind(durableBff);
      }
      if (property === 'home') {
        return (
          principal: Parameters<ConsumerBff['home']>[0],
          requestId: string,
          valuationCurrency = 'USD',
        ): ReturnType<ConsumerBff['home']> => {
          const base = fixtureBff.home(principal, requestId, valuationCurrency);
          if (isBffErrorEnvelope(base)) {
            return base;
          }
          const financial = durableBff.home(principal, requestId, valuationCurrency);
          if (isBffErrorEnvelope(financial)) {
            return financial;
          }
          return Object.freeze({
            ...base,
            wealth: financial.wealth,
            accounts: financial.accounts,
            cash: financial.cash,
            investments: financial.investments,
            digitalAssets: financial.digitalAssets,
            recentActivity: financial.recentActivity,
          });
        };
      }
      if (property === 'bootstrap') {
        return (principal: Parameters<ConsumerBff['bootstrap']>[0]): ReturnType<ConsumerBff['bootstrap']> => {
          const base = fixtureBff.bootstrap(principal);
          const financial = durableBff.bootstrap(principal);
          return Object.freeze({
            ...base,
            accounts: financial.accounts,
          });
        };
      }

      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

function isBffErrorEnvelope(value: unknown): value is BffErrorEnvelope {
  return Boolean(value && typeof value === 'object' && 'errorCode' in value);
}
