import { ENVIRONMENT, LIVE_TRADING_ENABLED } from '@solstice/config';

import { HELIOS_DURABLE_SHADOW_LAB_RUNTIME_SCHEMA } from './taxonomy.ts';
import type { ShadowLabDurableStore } from './ports.ts';
import type { ShadowLabRuntimeHealth, ShadowLabRuntimeReadiness } from './types.ts';

export function buildShadowLabRuntimeHealth(input: {
  readonly store: ShadowLabDurableStore;
  readonly activeCampaigns: number;
  readonly shuttingDown: boolean;
}): ShadowLabRuntimeHealth {
  const notes: string[] = [];
  if (input.shuttingDown) {
    notes.push('graceful shutdown in progress');
  }
  if (ENVIRONMENT !== 'simulation') {
    notes.push('ENVIRONMENT must remain simulation');
  }
  if (LIVE_TRADING_ENABLED) {
    notes.push('LIVE_TRADING_ENABLED must remain false');
  }
  const healthy = input.store.persistenceAvailable && ENVIRONMENT === 'simulation' && !LIVE_TRADING_ENABLED;
  return Object.freeze({
    schema: HELIOS_DURABLE_SHADOW_LAB_RUNTIME_SCHEMA,
    healthy,
    persistenceAvailable: input.store.persistenceAvailable,
    activeCampaigns: input.activeCampaigns,
    notes: Object.freeze(notes),
  });
}

export function buildShadowLabRuntimeReadiness(input: {
  readonly store: ShadowLabDurableStore;
  readonly shuttingDown: boolean;
}): ShadowLabRuntimeReadiness {
  const blockers: string[] = [];
  if (!input.store.persistenceAvailable) {
    blockers.push('persistence unavailable');
  }
  if (input.shuttingDown) {
    blockers.push('shutting down');
  }
  if (LIVE_TRADING_ENABLED) {
    blockers.push('live trading enabled');
  }
  return Object.freeze({
    ready: blockers.length === 0,
    blockers: Object.freeze(blockers),
  });
}
