/**
 * Wave 8 product integration — durable runtime factory.
 *
 * Wires PostgreSQL-backed stores into product paths when persistence is available.
 * Sandbox fixtures remain the default for unit tests; staging uses durable mode.
 */

import { FrozenClock } from '../../../../packages/config/src/clock.ts';
import { ENVIRONMENT } from '../../../../packages/config/src/flags.ts';
import { asUtcInstant } from '../../../../packages/domain/src/time.ts';
import { ConsentStore } from '../../../../packages/consent/src/store.ts';
import { ConsentService } from '../../../../packages/consent/src/service.ts';
import { EvidenceVault } from '../../../../packages/evidence/src/vault.ts';
import { DomainEventLog } from '../../../../packages/events/src/events.ts';
import { DurableHumanEconomicStateService } from './durable-human-economic-state.ts';
import { createHumanEconomicPersistencePort } from '../../../accounts/src/human-economic-persistence.ts';
import { InMemoryEncryptedPayloadStore } from '../../../../packages/personal-data-vault/src/encryption.ts';
import { PersonalDataVaultStore } from '../../../../packages/personal-data-vault/src/store.ts';
import { PersonalDataVault } from '../../../../packages/personal-data-vault/src/service.ts';
import { createSimulationKeyProvider } from '../../../../packages/security/src/simulation.ts';
import { InMemoryAgentMandateStore } from '../../../../packages/sunrey-agent/src/store.ts';
import {
  createPostgresSimulationRuntime,
  isProductIntegrationDurableModeEnabled,
  loadProductAgentRuntimeState,
  persistProductAgentRuntimeState,
  persistProductConsentState,
  persistenceEnvFromProcess,
  type DurableSimulationRuntime,
} from '../../../accounts/src/product-durable-adapters.ts';
import {
  createSimulationRuntime,
  type SimulationRuntime,
  type SimulationRuntimeOptions,
} from '../../../accounts/src/runtime.ts';

export type ProductIntegrationMode = 'IN_MEMORY' | 'DURABLE';

export type ProductIntegrationRuntime = {
  readonly mode: ProductIntegrationMode;
  readonly environment: typeof ENVIRONMENT;
  readonly accounts: SimulationRuntime;
  readonly consent: ConsentService;
  readonly vault: PersonalDataVault;
  readonly agentStore: InMemoryAgentMandateStore;
  readonly durableAccounts: DurableSimulationRuntime | null;
  readonly humanEconomicState: DurableHumanEconomicStateService | null;
  persist(): Promise<void>;
  close(): Promise<void>;
};

export type ProductIntegrationOptions = {
  readonly now?: string;
  readonly forceMode?: ProductIntegrationMode;
  readonly accounts?: SimulationRuntimeOptions;
};

export function resolveProductIntegrationMode(
  options: ProductIntegrationOptions = {},
): ProductIntegrationMode {
  if (options.forceMode) {
    return options.forceMode;
  }
  return isProductIntegrationDurableModeEnabled() ? 'DURABLE' : 'IN_MEMORY';
}

export async function createProductIntegrationRuntime(
  options: ProductIntegrationOptions = {},
): Promise<ProductIntegrationRuntime> {
  const mode = resolveProductIntegrationMode(options);
  const now = asUtcInstant(options.now ?? '2026-09-02T12:00:00.000Z');
  const clock = new FrozenClock(now);
  const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
  const events = new DomainEventLog();
  const evidence = new EvidenceVault(clock);

  const consentStore = new ConsentStore();
  const agentStore = new InMemoryAgentMandateStore();
  const vaultStore = new PersonalDataVaultStore();
  const payloadStore = new InMemoryEncryptedPayloadStore();

  let durableAccounts: DurableSimulationRuntime | null = null;
  let humanEconomicState: DurableHumanEconomicStateService | null = null;
  let accounts: SimulationRuntime;

  if (mode === 'DURABLE') {
    durableAccounts = await createPostgresSimulationRuntime(await persistenceEnvFromProcess(), {
      clock,
      keyProvider: keys,
      ...options.accounts,
    });
    accounts = durableAccounts.runtime;
    humanEconomicState = await DurableHumanEconomicStateService.create(
      createHumanEconomicPersistencePort(durableAccounts.session.pools.customer),
      { requireDurable: true },
    );
    const agentSnapshot = await loadProductAgentRuntimeState(durableAccounts.session.pools.customer);
    if (agentSnapshot) {
      agentStore.hydrate(agentSnapshot as Parameters<InMemoryAgentMandateStore['hydrate']>[0]);
    }
  } else {
    accounts = createSimulationRuntime({
      ...options.accounts,
      clock,
      keyProvider: keys,
    });
  }

  const consent = new ConsentService({ clock, keys, evidence, events, store: consentStore });
  const vault = new PersonalDataVault({
    clock,
    keys,
    evidence,
    events,
    store: vaultStore,
    payloadStore,
  });

  return Object.freeze({
    mode,
    environment: ENVIRONMENT,
    accounts,
    consent,
    vault,
    agentStore,
    durableAccounts,
    humanEconomicState,
    async persist() {
      if (!durableAccounts) {
        return;
      }
      await Promise.all([
        persistProductConsentState(durableAccounts.session.pools.customer, consentStore.snapshot()),
        persistProductAgentRuntimeState(durableAccounts.session.pools.customer, agentStore.snapshot()),
        humanEconomicState?.persist(),
        durableAccounts.persistProductState(),
      ]);
    },
    async close() {
      if (durableAccounts) {
        await durableAccounts.close();
      }
    },
  });
}
