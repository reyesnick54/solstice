/**
 * Wave 5 ProviderRiskMonitor — observability for physical-economy providers.
 */

import type { ProviderAdapterState } from './adapters.ts';
import {
  WAVE5_BLOCKED_PROVIDER_IDS,
  WAVE5_IMPLEMENTED_PROVIDER_IDS,
  WAVE5_PREVIEW_ONLY_PROVIDER_IDS,
  type Wave5AdapterContext,
} from './wave5-adapters.ts';

export type ProviderRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type ProviderRiskRecord = {
  readonly providerId: string;
  readonly enabled: boolean;
  readonly health: 'healthy' | 'degraded' | 'unhealthy' | 'blocked' | 'disabled';
  readonly riskLevel: ProviderRiskLevel;
  readonly circuitState: string;
  readonly lastSuccess: string | null;
  readonly lastError: string | null;
  readonly cacheFreshness: 'fresh' | 'stale' | 'expired' | 'none';
  readonly rateLimitState: 'ok' | 'limited' | 'unknown';
  readonly launchTier: 'production_candidate' | 'preview' | 'blocked';
  readonly activationState: 'active' | 'disabled' | 'blocked';
};

export type ProviderRiskMonitorSnapshot = {
  readonly schema: 'sunrey.provider-risk-monitor.v1';
  readonly providers: readonly ProviderRiskRecord[];
  readonly summary: {
    readonly total: number;
    readonly healthy: number;
    readonly degraded: number;
    readonly unhealthy: number;
    readonly blocked: number;
    readonly disabled: number;
  };
};

function riskLevelFor(state: ProviderAdapterState, providerId: string): ProviderRiskLevel {
  if (WAVE5_BLOCKED_PROVIDER_IDS.includes(providerId)) return 'CRITICAL';
  if (!state.enabled || state.circuitState === 'OPEN') return 'HIGH';
  if (state.down || state.malformed) return 'HIGH';
  if (state.rateLimited || state.lastError) return 'MEDIUM';
  return 'LOW';
}

function healthFor(state: ProviderAdapterState, providerId: string): ProviderRiskRecord['health'] {
  if (WAVE5_BLOCKED_PROVIDER_IDS.includes(providerId)) return 'blocked';
  if (!state.enabled) return 'disabled';
  if (state.down || state.malformed) return 'unhealthy';
  if (state.rateLimited || state.lastError) return 'degraded';
  return 'healthy';
}

export class Wave5ProviderRiskMonitor {
  readonly #ctx: Wave5AdapterContext;

  constructor(ctx: Wave5AdapterContext) {
    this.#ctx = ctx;
  }

  snapshot(): ProviderRiskMonitorSnapshot {
    const allIds = [...WAVE5_IMPLEMENTED_PROVIDER_IDS, ...WAVE5_BLOCKED_PROVIDER_IDS];
    const providers: ProviderRiskRecord[] = allIds.map((providerId) => {
      const state = this.#ctx.states.get(providerId) ?? {
        enabled: true,
        down: false,
        rateLimited: false,
        malformed: false,
        lastSuccess: null,
        lastError: null,
        circuitState: 'CLOSED' as const,
      };
      const blocked = WAVE5_BLOCKED_PROVIDER_IDS.includes(providerId);
      const preview = WAVE5_PREVIEW_ONLY_PROVIDER_IDS.includes(providerId);
      return Object.freeze({
        providerId,
        enabled: state.enabled && !blocked,
        health: healthFor(state, providerId),
        riskLevel: riskLevelFor(state, providerId),
        circuitState: state.circuitState,
        lastSuccess: state.lastSuccess,
        lastError: state.lastError,
        cacheFreshness: state.lastSuccess ? 'fresh' : 'none',
        rateLimitState: state.rateLimited ? 'limited' : 'ok',
        launchTier: blocked ? 'blocked' : preview ? 'preview' : 'production_candidate',
        activationState: blocked ? 'blocked' : state.enabled ? 'active' : 'disabled',
      });
    });

    const summary = {
      total: providers.length,
      healthy: providers.filter((p) => p.health === 'healthy').length,
      degraded: providers.filter((p) => p.health === 'degraded').length,
      unhealthy: providers.filter((p) => p.health === 'unhealthy').length,
      blocked: providers.filter((p) => p.health === 'blocked').length,
      disabled: providers.filter((p) => p.health === 'disabled').length,
    };

    return Object.freeze({
      schema: 'sunrey.provider-risk-monitor.v1',
      providers: Object.freeze(providers),
      summary: Object.freeze(summary),
    });
  }

  disableProvider(providerId: string): boolean {
    const state = this.#ctx.states.get(providerId);
    if (!state) return false;
    this.#ctx.states.set(providerId, { ...state, enabled: false });
    return true;
  }

  enableProvider(providerId: string): boolean {
    if (WAVE5_BLOCKED_PROVIDER_IDS.includes(providerId)) return false;
    const state = this.#ctx.states.get(providerId);
    if (!state) return false;
    this.#ctx.states.set(providerId, { ...state, enabled: true });
    return true;
  }
}
