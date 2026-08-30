/**
 * Per-provider multi-window rate limiting.
 */

import type { ProviderRateLimitPolicy } from './policy.ts';
import type { ReliabilityClock } from './reliability-types.ts';

export type RateLimitResult =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly cooldownUntilMs: number; readonly window: string };

type WindowConfig = {
  readonly name: string;
  readonly limit: number;
  readonly windowMs: number;
};

type WindowState = {
  count: number;
  windowStartMs: number;
  cooldownUntilMs: number;
};

export class ProviderRateLimiter {
  private readonly windows: readonly WindowConfig[];
  private readonly states = new Map<string, Map<string, WindowState>>();
  private readonly clock: ReliabilityClock;

  constructor(policy: ProviderRateLimitPolicy, clock: ReliabilityClock) {
    this.clock = clock;
    this.windows = Object.freeze([
      ...(policy.requestsPerSecond ? [{ name: 'second', limit: policy.requestsPerSecond, windowMs: 1_000 }] : []),
      ...(policy.requestsPerMinute ? [{ name: 'minute', limit: policy.requestsPerMinute, windowMs: 60_000 }] : []),
      ...(policy.requestsPerHour ? [{ name: 'hour', limit: policy.requestsPerHour, windowMs: 3_600_000 }] : []),
      ...(policy.requestsPerDay ? [{ name: 'day', limit: policy.requestsPerDay, windowMs: 86_400_000 }] : []),
    ]);
  }

  acquire(providerId: string): RateLimitResult {
    const now = this.clock.nowMs();
    const providerStates = this.states.get(providerId) ?? new Map<string, WindowState>();
    for (const window of this.windows) {
      const key = window.name;
      const current = providerStates.get(key) ?? { count: 0, windowStartMs: now, cooldownUntilMs: 0 };
      if (now < current.cooldownUntilMs) {
        this.states.set(providerId, providerStates);
        return Object.freeze({
          allowed: false,
          cooldownUntilMs: current.cooldownUntilMs,
          window: window.name,
        });
      }
      if (now - current.windowStartMs >= window.windowMs) {
        current.count = 0;
        current.windowStartMs = now;
      }
      if (current.count >= window.limit) {
        current.cooldownUntilMs = current.windowStartMs + window.windowMs;
        providerStates.set(key, current);
        this.states.set(providerId, providerStates);
        return Object.freeze({
          allowed: false,
          cooldownUntilMs: current.cooldownUntilMs,
          window: window.name,
        });
      }
      current.count += 1;
      providerStates.set(key, current);
    }
    this.states.set(providerId, providerStates);
    return Object.freeze({ allowed: true });
  }

  applyCooldown(providerId: string, cooldownUntilMs: number): void {
    const now = this.clock.nowMs();
    const providerStates = this.states.get(providerId) ?? new Map<string, WindowState>();
    for (const window of this.windows) {
      const current = providerStates.get(window.name) ?? { count: 0, windowStartMs: now, cooldownUntilMs: 0 };
      current.cooldownUntilMs = Math.max(current.cooldownUntilMs, cooldownUntilMs);
      providerStates.set(window.name, current);
    }
    this.states.set(providerId, providerStates);
  }

  snapshot(providerId: string): Readonly<Record<string, { readonly count: number; readonly cooldownUntilMs: number }>> {
    const providerStates = this.states.get(providerId);
    if (!providerStates) {
      return Object.freeze({});
    }
    const out: Record<string, { count: number; cooldownUntilMs: number }> = {};
    for (const [key, state] of providerStates) {
      out[key] = { count: state.count, cooldownUntilMs: state.cooldownUntilMs };
    }
    return Object.freeze(out);
  }
}
