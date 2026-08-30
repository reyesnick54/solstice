/**
 * Unified provider observability plane.
 * Composes metrics, logging, tracing, status, cache, and scheduler tracking.
 */

import type { UniversalProviderRuntime } from '../runtime.ts';
import type { ProviderCapabilityId } from '../types.ts';
import {
  defaultActivationConfig,
  readActivationFromEnv,
  type ProviderActivationConfig,
} from './activation.ts';
import { evaluateProviderAlerts } from './alerting.ts';
import { ProviderCacheTracker } from './cache-tracker.ts';
import { rollupDependencyStatus } from './dependency-status.ts';
import { ProviderLogEmitter } from './logging.ts';
import { ProviderMetricsCollector } from './metrics.ts';
import { ProviderSchedulerTracker } from './scheduler-tracker.ts';
import { ProviderStatusService } from './status-service.ts';
import { ProviderTraceBridge } from './tracing.ts';
import type { DeploymentTier, DomainDependencyStatus, ProviderAlertCondition } from './types.ts';

export type ProviderObservabilityPlaneOptions = {
  readonly runtime: UniversalProviderRuntime;
  readonly activation?: ProviderActivationConfig;
  readonly deploymentTier?: DeploymentTier;
  readonly catalogTotal?: number;
  readonly nowUtc?: () => string;
};

export class ProviderObservabilityPlane {
  readonly metrics: ProviderMetricsCollector;
  readonly logs: ProviderLogEmitter;
  readonly traces: ProviderTraceBridge;
  readonly cache: ProviderCacheTracker;
  readonly scheduler: ProviderSchedulerTracker;
  readonly status: ProviderStatusService;
  readonly #runtime: UniversalProviderRuntime;
  readonly #activation: ProviderActivationConfig;
  readonly #nowUtc: () => string;

  constructor(options: ProviderObservabilityPlaneOptions) {
    this.#runtime = options.runtime;
    this.#activation = options.activation ?? defaultActivationConfig();
    this.#nowUtc = options.nowUtc ?? (() => new Date().toISOString());
    this.metrics = new ProviderMetricsCollector();
    this.logs = new ProviderLogEmitter();
    this.traces = new ProviderTraceBridge();
    this.cache = new ProviderCacheTracker();
    this.scheduler = new ProviderSchedulerTracker();
    this.status = new ProviderStatusService({
      runtime: options.runtime,
      activation: this.#activation,
      deploymentTier: options.deploymentTier,
      cacheTracker: this.cache,
      schedulerTracker: this.scheduler,
      catalogTotal: options.catalogTotal,
      nowUtc: this.#nowUtc,
    });
  }

  runtime(): UniversalProviderRuntime {
    return this.#runtime;
  }

  activation(): ProviderActivationConfig {
    return this.#activation;
  }

  recordProviderCall(input: {
    readonly providerId: string;
    readonly category: Parameters<ProviderMetricsCollector['recordRequest']>[0]['labels']['category'];
    readonly capability: ProviderCapabilityId | string;
    readonly requestId: string;
    readonly traceId: string;
    readonly durationMs: number;
    readonly statusCode: number | null;
    readonly retryCount: number;
    readonly result: 'success' | 'failure' | 'timeout' | 'rate_limited';
    readonly errorClass?: string;
    readonly environment?: string;
    readonly domain?: string;
  }): void {
    const health = this.#runtime.healthOf(input.providerId);
    const labels = {
      provider_id: input.providerId,
      category: input.category,
      capability: String(input.capability),
      environment: input.environment,
    };
    this.metrics.recordRequest({
      labels,
      durationMs: input.durationMs,
      result: input.result,
      errorClass: input.errorClass,
    });
    if (input.retryCount > 0) {
      this.metrics.recordRetry(labels);
    }
    if (health?.circuitState === 'OPEN') {
      this.metrics.recordCircuitOpen(input.providerId, input.category, true);
    }
    this.status.recordLatency(input.providerId, input.durationMs);
    if (input.result === 'failure' && input.errorClass) {
      this.status.recordError(input.providerId, input.errorClass);
    }
    const cacheState = this.cache.get(input.providerId, 'default', this.#nowUtc()).cacheState;
    this.logs.emit({
      providerId: input.providerId,
      capability: String(input.capability),
      requestId: input.requestId,
      statusCode: input.statusCode,
      durationMs: input.durationMs,
      retryCount: input.retryCount,
      circuitState: health?.circuitState ?? 'CLOSED',
      cacheState,
      result: input.result,
      traceId: input.traceId,
    });
    if (input.domain) {
      this.traces.providerCallChain(
        { traceId: input.traceId, requestId: input.requestId },
        { domain: input.domain, providerId: input.providerId, capability: String(input.capability) },
      );
    }
  }

  invalidateProviderCache(providerId: string, key?: string): void {
    this.cache.invalidate(providerId, key);
  }

  evaluateAlerts(providerId: string): readonly ProviderAlertCondition[] {
    const status = this.status.statusOf(providerId);
    if (!status) {
      return Object.freeze([]);
    }
    const schedule = this.scheduler.forProvider(providerId)[0] ?? null;
    return evaluateProviderAlerts({
      providerId,
      health: this.#runtime.healthOf(providerId),
      schedule,
      cacheFreshness: status.cacheFreshness,
      unavailableSinceUtc: this.status.unavailableSince(providerId),
      nowUtc: this.#nowUtc(),
    });
  }

  dependencyStatus(): readonly DomainDependencyStatus[] {
    return rollupDependencyStatus(this.status.listStatuses());
  }

  aggregateHealth() {
    return this.status.aggregate();
  }

  internalProviderDetails(providerId: string) {
    const status = this.status.statusOf(providerId);
    return status ? this.status.sanitizeForInternalResponse(status) : null;
  }
}

export function createProviderObservabilityPlane(
  runtime: UniversalProviderRuntime,
  options: Omit<ProviderObservabilityPlaneOptions, 'runtime'> = {},
): ProviderObservabilityPlane {
  return new ProviderObservabilityPlane({
    runtime,
    activation: options.activation ?? readActivationFromEnv(),
    ...options,
  });
}
