/**
 * ACCESS Wave 2 — Access provider risk monitor integration.
 *
 * Reuses the external-data ProviderRiskMonitor scoring pattern. Quarantined
 * providers must not receive new bookings; existing state remains reconcilable.
 */

import type { AccessProviderId } from '../types.ts';

export type AccessProviderRiskState = 'NORMAL' | 'SUSPICIOUS' | 'QUARANTINED';

export type AccessProviderRiskFactor = {
  readonly dimension: 'availability' | 'security' | 'commercial' | 'credential' | 'contract';
  readonly contribution: number;
  readonly reason: string;
};

export type AccessProviderRiskScore = {
  readonly providerId: AccessProviderId;
  readonly score: number;
  readonly state: AccessProviderRiskState;
  readonly factors: readonly AccessProviderRiskFactor[];
  readonly assessedAt: string;
};

export type AccessProviderRiskInput = {
  readonly providerId: AccessProviderId;
  readonly down?: boolean;
  readonly rateLimited?: boolean;
  readonly circuitOpen?: boolean;
  readonly credentialInvalid?: boolean;
  readonly contractSuspended?: boolean;
  readonly authFailureCount?: number;
  readonly quarantined?: boolean;
};

const QUARANTINE_THRESHOLD = 80;
const SUSPICIOUS_THRESHOLD = 50;

export class AccessProviderRiskMonitor {
  private readonly quarantined = new Set<AccessProviderId>();
  private readonly nowUtc: () => string;

  constructor(options: { readonly nowUtc?: () => string } = {}) {
    this.nowUtc = options.nowUtc ?? (() => new Date().toISOString());
  }

  assess(input: AccessProviderRiskInput): AccessProviderRiskScore {
    const factors: AccessProviderRiskFactor[] = [];
    let score = 0;

    if (input.down) {
      factors.push({ dimension: 'availability', contribution: 40, reason: 'Provider unreachable' });
      score += 40;
    } else if (input.rateLimited) {
      factors.push({ dimension: 'availability', contribution: 15, reason: 'Rate limited (429)' });
      score += 15;
    } else if (input.circuitOpen) {
      factors.push({ dimension: 'availability', contribution: 30, reason: 'Circuit breaker open' });
      score += 30;
    }

    if (input.credentialInvalid) {
      factors.push({ dimension: 'credential', contribution: 25, reason: 'Invalid credentials' });
      score += 25;
    }

    if (input.contractSuspended) {
      factors.push({ dimension: 'contract', contribution: 35, reason: 'Contract suspended' });
      score += 35;
    }

    if ((input.authFailureCount ?? 0) >= 3) {
      factors.push({ dimension: 'security', contribution: 20, reason: 'Repeated auth failures' });
      score += 20;
    }

    if (input.quarantined || this.quarantined.has(input.providerId)) {
      score = Math.max(score, QUARANTINE_THRESHOLD);
      factors.push({ dimension: 'commercial', contribution: QUARANTINE_THRESHOLD, reason: 'Provider quarantined' });
    }

    const state: AccessProviderRiskState =
      score >= QUARANTINE_THRESHOLD ? 'QUARANTINED' : score >= SUSPICIOUS_THRESHOLD ? 'SUSPICIOUS' : 'NORMAL';

    if (state === 'QUARANTINED') {
      this.quarantined.add(input.providerId);
    }

    return Object.freeze({
      providerId: input.providerId,
      score,
      state,
      factors: Object.freeze(factors),
      assessedAt: this.nowUtc(),
    });
  }

  quarantine(providerId: AccessProviderId): void {
    this.quarantined.add(providerId);
  }

  release(providerId: AccessProviderId): void {
    this.quarantined.delete(providerId);
  }

  isQuarantined(providerId: AccessProviderId): boolean {
    return this.quarantined.has(providerId);
  }

  canInitiateNewBooking(providerId: AccessProviderId): boolean {
    return !this.quarantined.has(providerId);
  }
}
