/**
 * ACCESS Wave 2 — Internal provider operations support.
 *
 * Reuses feature-flag/admin architecture patterns. Operators can enable,
 * disable, quarantine, and inspect providers.
 */

import type { AccessProviderId } from '../types.ts';
import type { AccessProviderDescriptor } from './descriptor.ts';
import type { AccessProviderHealthSnapshot } from './health.ts';
import type { AccessProviderRiskMonitor } from './risk.ts';
import type { AccessProviderRegistry } from './registry.ts';

export type ProviderOperationResult = {
  readonly providerId: AccessProviderId;
  readonly operation: string;
  readonly success: boolean;
  readonly message: string;
  readonly timestamp: string;
};

export class AccessProviderOperations {
  private readonly registry: AccessProviderRegistry;
  private readonly risk: AccessProviderRiskMonitor;
  private readonly disabled = new Set<AccessProviderId>();
  private readonly nowUtc: () => string;

  constructor(registry: AccessProviderRegistry, risk: AccessProviderRiskMonitor, options: { readonly nowUtc?: () => string } = {}) {
    this.registry = registry;
    this.risk = risk;
    this.nowUtc = options.nowUtc ?? (() => new Date().toISOString());
  }

  enable(providerId: AccessProviderId): ProviderOperationResult {
    this.disabled.delete(providerId);
    this.risk.release(providerId);
    return this.result(providerId, 'ENABLE', true, 'provider enabled');
  }

  disable(providerId: AccessProviderId): ProviderOperationResult {
    this.disabled.add(providerId);
    return this.result(providerId, 'DISABLE', true, 'provider disabled');
  }

  quarantine(providerId: AccessProviderId, reason: string): ProviderOperationResult {
    this.risk.quarantine(providerId);
    return this.result(providerId, 'QUARANTINE', true, reason);
  }

  isEnabled(providerId: AccessProviderId): boolean {
    return !this.disabled.has(providerId) && !this.risk.isQuarantined(providerId);
  }

  inspectCapabilities(providerId: AccessProviderId): readonly string[] {
    const descriptor = this.registry.getDescriptor(providerId);
    return descriptor?.capabilities ?? [];
  }

  inspectHealth(providerId: AccessProviderId): AccessProviderHealthSnapshot | null {
    return this.registry.getCachedHealth(providerId);
  }

  inspectDescriptor(providerId: AccessProviderId): AccessProviderDescriptor | null {
    return this.registry.getDescriptor(providerId);
  }

  private result(providerId: AccessProviderId, operation: string, success: boolean, message: string): ProviderOperationResult {
    return Object.freeze({
      providerId,
      operation,
      success,
      message,
      timestamp: this.nowUtc(),
    });
  }
}
