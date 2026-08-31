/**
 * Shared commercial adapter shell base.
 */

import { evaluateCommercialActivation, capabilitySupported } from '../activation.ts';
import { COMMERCIAL_PROVIDER_REGISTRY } from '../capabilities.ts';
import { createCommercialIdempotencyStore, type CommercialIdempotencyStore } from '../idempotency.ts';
import { validateBookingProfile } from '../data-minimization.ts';
import type {
  AccessProviderBookingRequest,
  CommercialAccessCapabilityId,
  CommercialAccessProvider,
  CommercialProviderHealth,
  CommercialProviderId,
  CommercialProviderOutcome,
} from '../types.ts';
import { COMMERCIAL_FIXTURE_NOW, commercialFail, commercialOk } from '../shared.ts';

export type CommercialAdapterShellDeps = {
  readonly idempotency?: CommercialIdempotencyStore;
  readonly now?: () => string;
  readonly fixtureMode?: boolean;
};

export abstract class CommercialAdapterShell implements CommercialAccessProvider {
  readonly providerId: CommercialProviderId;
  readonly displayName: string;
  readonly activationState;
  readonly capabilities;

  protected readonly idempotency: CommercialIdempotencyStore;
  protected readonly now: () => string;
  protected readonly fixtureMode: boolean;

  constructor(providerId: CommercialProviderId, deps: CommercialAdapterShellDeps = {}) {
    const registration = COMMERCIAL_PROVIDER_REGISTRY[providerId];
    this.providerId = providerId;
    this.displayName = registration.displayName;
    this.activationState = registration.activationState;
    this.capabilities = registration.capabilities;
    this.idempotency = deps.idempotency ?? createCommercialIdempotencyStore();
    this.now = deps.now ?? (() => COMMERCIAL_FIXTURE_NOW);
    this.fixtureMode = deps.fixtureMode ?? false;
  }

  health(): CommercialProviderHealth {
    return Object.freeze({
      providerId: this.providerId,
      activationState: this.activationState,
      healthy: this.activationState !== 'DISABLED',
      lastCheckedAt: this.now(),
      message: COMMERCIAL_PROVIDER_REGISTRY[this.providerId].capabilities[0]?.notes ?? 'commercial adapter shell',
    });
  }

  protected gate<T>(
    capabilityId: CommercialAccessCapabilityId,
    execute: () => CommercialProviderOutcome<T>,
  ): CommercialProviderOutcome<T> {
    const registration = COMMERCIAL_PROVIDER_REGISTRY[this.providerId];
    if (!this.fixtureMode) {
      const gate = evaluateCommercialActivation({
        providerId: this.providerId,
        activationState: this.activationState,
        capabilityId,
        credentialStatus: registration.credentialStatus,
        contractStatus: registration.contractStatus,
      });

      if (!gate.allowed) {
        return commercialFail('ACTIVATION_BLOCKED', gate.reasons.join('; '));
      }
    }

    if (!capabilitySupported(this.capabilities, capabilityId)) {
      return commercialFail('CAPABILITY_UNAVAILABLE', `${this.providerId} does not support ${capabilityId}`);
    }

    return execute();
  }

  protected validateProfileForBooking(
    request: AccessProviderBookingRequest,
  ): CommercialProviderOutcome<AccessProviderBookingRequest> {
    const scan = validateBookingProfile(request.travelerProfile);
    if (!scan.safe) {
      return commercialFail('INVALID_BOOKING_PROFILE', scan.violations.join('; '));
    }
    return commercialOk(request);
  }

  protected checkIdempotency<T>(
    operation: 'RESERVE' | 'BOOK' | 'CANCEL' | 'REFUND',
    idempotencyKey: string,
    resolveExisting: (providerReference: string) => CommercialProviderOutcome<T>,
  ): CommercialProviderOutcome<T> | null {
    const existing = this.idempotency.get(this.providerId, operation, idempotencyKey);
    if (existing) {
      return resolveExisting(existing.providerReference);
    }
    return null;
  }

  protected recordIdempotency(
    operation: 'RESERVE' | 'BOOK' | 'CANCEL' | 'REFUND',
    idempotencyKey: string,
    providerReference: string,
  ): void {
    this.idempotency.put(
      Object.freeze({
        providerId: this.providerId,
        operation,
        idempotencyKey,
        providerReference,
        createdAt: this.now(),
      }),
    );
  }
}
