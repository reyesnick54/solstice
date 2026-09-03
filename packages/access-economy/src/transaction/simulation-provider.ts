// @ts-nocheck
/**
 * ACCESS Wave 3 — configurable simulation provider for transaction test scenarios.
 */

import type { AccessProvider, AccessProviderId } from '../providers/types.ts';
import type { ProviderBookingStatusResult } from './types.ts';
import { bookingIdFor, reservationIdFor, ok, fail } from '../providers/adapters/shared.ts';

export type SimulationScenario = {
  readonly failBooking?: boolean;
  readonly bookingTimeout?: boolean;
  readonly priceIncreaseMinorUnits?: bigint;
  readonly quarantined?: boolean;
  readonly duplicateBookingOnReconcile?: boolean;
};

type BookingRecord = {
  readonly bookingId: string;
  readonly reservationId: string;
  readonly state: 'CONFIRMED' | 'CANCELLED' | 'FAILED';
  readonly idempotencyKey: string;
};

export class ConfigurableSimulationProvider implements AccessProvider {
  readonly providerId: AccessProviderId = 'turo';
  readonly displayName = 'Configurable Simulation Provider';
  readonly integrationState = 'SIMULATED' as const;
  readonly capabilities = Object.freeze([]);

  private scenario: SimulationScenario = {};
  private readonly bookings = new Map<string, BookingRecord>();
  private readonly bookingByIdempotency = new Map<string, BookingRecord>();
  private lastQuoteAmount: bigint = 400_00n;

  private readonly baseProvider?: AccessProvider;

  constructor(baseProvider?: AccessProvider) {
    this.baseProvider = baseProvider;
  }

  setScenario(scenario: SimulationScenario): void {
    this.scenario = scenario;
  }

  setQuoteAmount(amountMinorUnits: bigint): void {
    this.lastQuoteAmount = amountMinorUnits;
  }

  health() {
    if (this.scenario.quarantined) {
      return Object.freeze({
        providerId: this.providerId,
        integrationState: 'LIVE_DISABLED' as const,
        healthy: false,
        lastCheckedAt: '2026-08-31T08:00:00.000Z',
        message: 'provider quarantined',
      });
    }
    return this.baseProvider?.health() ?? Object.freeze({
      providerId: this.providerId,
      integrationState: 'SIMULATED' as const,
      healthy: true,
      lastCheckedAt: '2026-08-31T08:00:00.000Z',
      message: 'configurable simulation',
    });
  }

  search(request: import('../providers/types.ts').ProviderSearchRequest) {
    return this.baseProvider?.search(request) ?? fail('NO_MATCH', 'no base provider');
  }

  availability(request: import('../providers/types.ts').ProviderAvailabilityRequest) {
    return this.baseProvider?.availability(request) ?? fail('NOT_FOUND', 'no base provider');
  }

  quote(request: import('../providers/types.ts').ProviderQuoteRequest) {
    if (this.baseProvider) {
      const outcome = this.baseProvider.quote(request);
      if (outcome.ok) {
        this.lastQuoteAmount = outcome.value.providerPriceMinorUnits;
      }
      return outcome;
    }
    return fail('NOT_FOUND', 'no base provider');
  }

  reserve(request: import('../providers/types.ts').ProviderReservationRequest) {
    if (this.scenario.quarantined) {
      return fail('PROVIDER_QUARANTINED', 'provider quarantined');
    }
    return this.baseProvider?.reserve(request) ?? ok(
      Object.freeze({
        reservationId: reservationIdFor(request.idempotencyKey),
        providerId: this.providerId,
        quoteId: request.quoteId,
        state: 'HELD',
        expiresAt: '2026-09-01T08:00:00.000Z',
        simulationOnly: true,
      }),
    );
  }

  book(request: import('../providers/types.ts').ProviderBookingRequest) {
    if (this.scenario.quarantined) {
      return fail('PROVIDER_QUARANTINED', 'provider quarantined');
    }
    const prior = this.bookingByIdempotency.get(request.idempotencyKey);
    if (prior) {
      return ok(
        Object.freeze({
          bookingId: prior.bookingId,
          providerId: this.providerId,
          reservationId: prior.reservationId,
          state: prior.state,
          rightKind: 'ACCESS_RIGHT' as const,
          accessRightRef: `ar_${prior.reservationId}`,
          simulationOnly: true,
        }),
      );
    }
    if (this.scenario.failBooking) {
      return fail('BOOKING_FAILED', 'simulated booking failure');
    }
    const bookingId = bookingIdFor(request.idempotencyKey);
    const record: BookingRecord = Object.freeze({
      bookingId,
      reservationId: request.reservationId,
      state: 'CONFIRMED',
      idempotencyKey: request.idempotencyKey,
    });
    if (this.scenario.bookingTimeout) {
      this.bookings.set(bookingId, record);
      this.bookingByIdempotency.set(request.idempotencyKey, record);
      return fail('TIMEOUT', 'simulated booking response timeout');
    }
    this.bookings.set(bookingId, record);
    this.bookingByIdempotency.set(request.idempotencyKey, record);
    return ok(
      Object.freeze({
        bookingId,
        providerId: this.providerId,
        reservationId: request.reservationId,
        state: 'CONFIRMED',
        rightKind: 'ACCESS_RIGHT' as const,
        accessRightRef: `ar_${request.reservationId}`,
        simulationOnly: true,
      }),
    );
  }

  cancel(request: import('../providers/types.ts').ProviderCancellationRequest) {
    const booking = this.bookings.get(request.bookingId);
    if (booking) {
      const cancelled: BookingRecord = Object.freeze({ ...booking, state: 'CANCELLED' });
      this.bookings.set(request.bookingId, cancelled);
    }
    return this.baseProvider?.cancel(request) ?? ok(
      Object.freeze({
        cancellationId: `pcn_${request.bookingId}`,
        providerId: this.providerId,
        bookingId: request.bookingId,
        state: 'CANCELLED',
        simulationOnly: true,
      }),
    );
  }

  getBookingStatus(input: {
    readonly reservationId?: string;
    readonly bookingId?: string;
    readonly idempotencyKey?: string;
  }): AccessProviderOutcome<ProviderBookingStatusResult> {
    let record: BookingRecord | undefined;
    if (input.bookingId) {
      record = this.bookings.get(input.bookingId);
    } else if (input.idempotencyKey) {
      record = this.bookingByIdempotency.get(input.idempotencyKey);
    } else if (input.reservationId) {
      record = [...this.bookings.values()].find((row) => row.reservationId === input.reservationId);
    }
    if (!record) {
      return fail('NOT_FOUND', 'booking not found');
    }
    if (this.scenario.duplicateBookingOnReconcile) {
      return fail('DUPLICATE_BOOKING', 'duplicate booking detected on reconcile');
    }
    return ok(
      Object.freeze({
        bookingId: record.bookingId,
        state: record.state,
        providerReservationId: record.reservationId,
      }),
    );
  }

  getLastQuoteAmount(): bigint {
    return this.lastQuoteAmount;
  }

  getScenarioPriceIncrease(): bigint | undefined {
    return this.scenario.priceIncreaseMinorUnits;
  }
}
