/**
 * Provider status read model for internal operations.
 */

import type { UniversalProviderRuntime } from '../runtime.ts';
import type { KillSwitchRecord, ProviderRegistration } from '../types.ts';
import {
  isProviderActivated,
  type ProviderActivationConfig,
} from './activation.ts';
import type { ProviderCacheTracker } from './cache-tracker.ts';
import { credentialRequiredForCategory, runHealthChecks } from './health-checks.ts';
import type { ProviderSchedulerTracker } from './scheduler-tracker.ts';
import type {
  CanonicalProviderHealth,
  DeploymentTier,
  ExternalProvidersAggregate,
  LaunchTier,
  ProviderLatencySummary,
  ProviderStatusRecord,
} from './types.ts';
import { mapRuntimeHealthToCanonical } from './types.ts';

export type ProviderStatusServiceOptions = {
  readonly runtime: UniversalProviderRuntime;
  readonly activation?: ProviderActivationConfig;
  readonly deploymentTier?: DeploymentTier;
  readonly cacheTracker?: ProviderCacheTracker;
  readonly schedulerTracker?: ProviderSchedulerTracker;
  readonly catalogTotal?: number;
  readonly nowUtc?: () => string;
};

export class ProviderStatusService {
  readonly #runtime: UniversalProviderRuntime;
  readonly #activation: ProviderActivationConfig;
  readonly #deploymentTier: DeploymentTier;
  readonly #cacheTracker: ProviderCacheTracker | undefined;
  readonly #schedulerTracker: ProviderSchedulerTracker | undefined;
  readonly #catalogTotal: number;
  readonly #nowUtc: () => string;
  readonly #latencySamples = new Map<string, number[]>();
  readonly #lastErrors = new Map<string, string>();
  readonly #unavailableSince = new Map<string, string>();

  constructor(options: ProviderStatusServiceOptions) {
    this.#runtime = options.runtime;
    this.#activation = options.activation ?? Object.freeze({ providersEnabled: true, categoryEnabled: {}, providerEnabled: {}, tierActivation: {} });
    this.#deploymentTier = options.deploymentTier ?? 'development';
    this.#cacheTracker = options.cacheTracker;
    this.#schedulerTracker = options.schedulerTracker;
    this.#catalogTotal = options.catalogTotal ?? options.runtime.list().length;
    this.#nowUtc = options.nowUtc ?? (() => new Date().toISOString());
  }

  recordLatency(providerId: string, latencyMs: number): void {
    const samples = this.#latencySamples.get(providerId) ?? [];
    samples.push(latencyMs);
    if (samples.length > 100) {
      samples.shift();
    }
    this.#latencySamples.set(providerId, samples);
  }

  recordError(providerId: string, errorCode: string): void {
    this.#lastErrors.set(providerId, errorCode);
  }

  statusOf(providerId: string): ProviderStatusRecord | null {
    const registration = this.#runtime.get(providerId);
    if (!registration) {
      return null;
    }
    return this.#buildStatus(registration);
  }

  listStatuses(): readonly ProviderStatusRecord[] {
    return Object.freeze(this.#runtime.list().map((row) => this.#buildStatus(row)));
  }

  aggregate(): ExternalProvidersAggregate {
    const statuses = this.listStatuses();
    const counts = {
      total: this.#catalogTotal,
      enabled: 0,
      healthy: 0,
      degraded: 0,
      unhealthy: 0,
      blocked: 0,
      disabled: 0,
      unknown: 0,
    };
    for (const status of statuses) {
      if (status.enabled) {
        counts.enabled += 1;
      }
      switch (status.health) {
        case 'healthy':
          counts.healthy += 1;
          break;
        case 'degraded':
          counts.degraded += 1;
          break;
        case 'unhealthy':
          counts.unhealthy += 1;
          break;
        case 'blocked':
          counts.blocked += 1;
          break;
        case 'disabled':
          counts.disabled += 1;
          break;
        default:
          counts.unknown += 1;
      }
    }
    return Object.freeze(counts);
  }

  sanitizeForInternalResponse(record: ProviderStatusRecord): ProviderStatusRecord {
    return Object.freeze({
      ...record,
      secretValuesPresent: false as const,
    });
  }

  #buildStatus(registration: ProviderRegistration): ProviderStatusRecord {
    const nowUtc = this.#nowUtc();
    const health = this.#runtime.healthOf(registration.providerId);
    const killSwitchActive = this.#killSwitchActive(registration.providerId);
    const activation = isProviderActivated({
      config: this.#activation,
      providerId: registration.providerId,
      category: registration.providerType,
      deploymentTier: this.#deploymentTier,
    });
    const lifecycleDisabled =
      registration.lifecycleState === 'DISABLED' || registration.lifecycleState === 'SUSPENDED';
    const canonicalHealth = mapRuntimeHealthToCanonical({
      lifecycleDisabled: lifecycleDisabled || !activation.enabled,
      killSwitchBlocked: activation.blocked || killSwitchActive,
      runtimeState: health?.state ?? 'UNKNOWN',
    });
    if (canonicalHealth === 'unhealthy' || canonicalHealth === 'blocked') {
      if (!this.#unavailableSince.has(registration.providerId)) {
        this.#unavailableSince.set(registration.providerId, nowUtc);
      }
    } else {
      this.#unavailableSince.delete(registration.providerId);
    }
    const cacheFreshness = this.#cacheTracker
      ? this.#cacheTracker.get(registration.providerId, 'default', nowUtc)
      : Object.freeze({
          lastRefreshedAt: health?.lastSuccessAt ?? null,
          staleAfterMs: 86_400_000,
          isStale: false,
          cacheState: 'none' as const,
        });
    const credentialRequired = credentialRequiredForCategory(registration.providerType);
    const checks = runHealthChecks({
      registration,
      health,
      credentialRequired,
      killSwitchActive: killSwitchActive || activation.blocked,
      dataLastUpdatedAt: cacheFreshness.lastRefreshedAt,
      staleAfterMs: cacheFreshness.staleAfterMs,
      nowUtc,
    });
    return Object.freeze({
      providerId: registration.providerId,
      displayName: registration.displayName,
      category: registration.providerType,
      enabled: activation.enabled && !lifecycleDisabled,
      health: canonicalHealth,
      circuitState: health?.circuitState ?? 'CLOSED',
      lastSuccessAt: health?.lastSuccessAt ?? null,
      lastErrorAt: health?.lastFailureAt ?? null,
      lastErrorCode: this.#lastErrors.get(registration.providerId) ?? null,
      latency: summarizeLatency(this.#latencySamples.get(registration.providerId) ?? [], health?.latencyMs ?? null),
      cacheFreshness,
      credential: Object.freeze({
        credentialRequired,
        credentialConfigured: registration.credentialReference !== null,
        verificationStatus: credentialRequired
          ? registration.credentialReference
            ? ('verified' as const)
            : ('unverified' as const)
          : ('not_required' as const),
      }),
      launchTier: resolveLaunchTier(registration, activation.blocked),
      environment: registration.environment,
      checks,
      secretValuesPresent: false as const,
    });
  }

  #killSwitchActive(providerId: string): boolean {
    const snapshot = this.#runtime.snapshot();
    return snapshot.killSwitches.some((row) => row.active && row.providerId === providerId);
  }

  unavailableSince(providerId: string): string | null {
    return this.#unavailableSince.get(providerId) ?? null;
  }

  schedulerFor(providerId: string): ReturnType<ProviderSchedulerTracker['forProvider']> | null {
    return this.#schedulerTracker ? this.#schedulerTracker.forProvider(providerId) : null;
  }
}

function summarizeLatency(samples: readonly number[], lastMs: number | null): ProviderLatencySummary {
  if (samples.length === 0) {
    return Object.freeze({ p50Ms: lastMs, p95Ms: lastMs, lastMs, sampleCount: lastMs === null ? 0 : 1 });
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.5)] ?? null;
  const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? null;
  return Object.freeze({
    p50Ms: p50,
    p95Ms: p95,
    lastMs: sorted[sorted.length - 1] ?? null,
    sampleCount: sorted.length,
  });
}

function resolveLaunchTier(
  registration: ProviderRegistration,
  blocked: boolean,
): LaunchTier {
  if (blocked) {
    return 'PRODUCTION_BLOCKED';
  }
  if (registration.lifecycleState === 'DISABLED') {
    return 'DISABLED';
  }
  if (registration.environment === 'PRODUCTION') {
    return 'PRODUCTION';
  }
  if (registration.environment === 'STAGING' || registration.environment === 'PREPRODUCTION') {
    return 'PREVIEW';
  }
  return 'SANDBOX';
}

export function activeKillSwitchesForProvider(
  switches: readonly KillSwitchRecord[],
  providerId: string,
): readonly KillSwitchRecord[] {
  return Object.freeze(switches.filter((row) => row.active && row.providerId === providerId));
}
