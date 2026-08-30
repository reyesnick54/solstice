/**
 * Per-provider concurrency / bulkhead guard.
 *
 * One slow provider cannot consume all outbound capacity.
 */

import type { GlobalSafetyLimits } from './policy.ts';

export type BulkheadAcquireResult =
  | { readonly acquired: true; readonly release: () => void }
  | { readonly acquired: false; readonly reason: 'provider_limit' | 'global_limit' };

export class ProviderBulkheadGuard {
  private readonly providerInflight = new Map<string, number>();
  private globalInflight = 0;
  private readonly providerLimit: number;
  private readonly globalLimit: number | null;

  constructor(limits: { readonly concurrencyLimit: number; readonly globalLimits: GlobalSafetyLimits }) {
    this.providerLimit = Math.min(limits.concurrencyLimit, limits.globalLimits.maxConcurrencyPerProvider);
    this.globalLimit = limits.globalLimits.globalProviderConcurrencyCeiling;
  }

  tryAcquire(providerId: string): BulkheadAcquireResult {
    const current = this.providerInflight.get(providerId) ?? 0;
    if (current >= this.providerLimit) {
      return Object.freeze({ acquired: false, reason: 'provider_limit' });
    }
    if (this.globalLimit !== null && this.globalInflight >= this.globalLimit) {
      return Object.freeze({ acquired: false, reason: 'global_limit' });
    }
    this.providerInflight.set(providerId, current + 1);
    this.globalInflight += 1;
    let released = false;
    const release = (): void => {
      if (released) {
        return;
      }
      released = true;
      const inflight = (this.providerInflight.get(providerId) ?? 1) - 1;
      if (inflight <= 0) {
        this.providerInflight.delete(providerId);
      } else {
        this.providerInflight.set(providerId, inflight);
      }
      this.globalInflight = Math.max(0, this.globalInflight - 1);
    };
    return Object.freeze({ acquired: true, release });
  }

  inflight(providerId: string): number {
    return this.providerInflight.get(providerId) ?? 0;
  }

  globalInflightCount(): number {
    return this.globalInflight;
  }
}
