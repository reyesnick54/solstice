/**
 * Simulation Turo mobility provider.
 */

import type { AccessProvider, ProviderHealth, ProviderSearchRequest } from '../../types.ts';
import { PROVIDER_CAPABILITY_REGISTRY } from '../../capabilities.ts';
import { bookingIdFor, buildQuote, fail, ok, quoteIdFor, reservationIdFor, SIMULATION_NOW } from '../shared.ts';
import { TURO_PROVIDER_CONTRACT } from './contract.ts';

const MUSTANG_ITEM = Object.freeze({
  catalogItemId: 'turo_mustang_gt_miami',
  category: 'VEHICLE_HOURS' as const,
  canonicalUnit: 'VEHICLE_DAY' as const,
  title: 'Ford Mustang GT — Miami',
  description: 'Simulation mobility candidate for ACCESS-14 Mustang redemption.',
  location: 'Miami, FL',
  serviceClass: 'STANDARD',
  rightKind: 'ACCESS_RIGHT' as const,
});

const PREMIUM_MUSTANG_ITEM = Object.freeze({
  catalogItemId: 'turo_mustang_gt_premium_miami',
  category: 'VEHICLE_HOURS' as const,
  canonicalUnit: 'VEHICLE_DAY' as const,
  title: 'Ford Mustang GT Premium — Miami',
  description: 'Premium simulation mobility candidate for partial coverage case.',
  location: 'Miami, FL',
  serviceClass: 'PREMIUM',
  rightKind: 'ACCESS_RIGHT' as const,
});

function matchMustang(query: string, location: string | null, premium = false): boolean {
  const haystack = `${query} ${location ?? ''}`.toLowerCase();
  return haystack.includes('mustang') && haystack.includes('miami') && (premium ? haystack.includes('premium') : !haystack.includes('premium'));
}

export class SimulationTuroProvider implements AccessProvider {
  readonly providerId = 'turo' as const;
  readonly displayName = 'Simulation Turo';
  readonly integrationState = 'SIMULATED' as const;
  readonly capabilities = PROVIDER_CAPABILITY_REGISTRY.turo.capabilities.map((row) =>
    Object.freeze({ ...row, integrationState: 'SIMULATED' as const, supported: row.capabilityId !== 'PAYOUT' }),
  );

  health(): ProviderHealth {
    return Object.freeze({
      providerId: this.providerId,
      integrationState: 'SIMULATED',
      healthy: true,
      lastCheckedAt: SIMULATION_NOW,
      message: TURO_PROVIDER_CONTRACT.notes,
    });
  }

  search(request: ProviderSearchRequest) {
    const premium = matchMustang(request.query, request.location, true);
    const standard = matchMustang(request.query, request.location, false);
    if (!standard && !premium) {
      return fail('NO_MATCH', 'no simulation Turo catalog item matches this search');
    }
    const item = premium ? PREMIUM_MUSTANG_ITEM : MUSTANG_ITEM;
    return ok(
      Object.freeze({
        requestId: request.requestId,
        items: Object.freeze([Object.freeze({ ...item, providerId: this.providerId })]),
        simulationOnly: true as const,
      }),
    );
  }

  availability(request: import('../../types.ts').ProviderAvailabilityRequest) {
    if (request.catalogItemId !== MUSTANG_ITEM.catalogItemId && request.catalogItemId !== PREMIUM_MUSTANG_ITEM.catalogItemId) {
      return fail('NOT_FOUND', 'catalog item not found');
    }
    return ok(
      Object.freeze({
        requestId: request.requestId,
        providerId: this.providerId,
        available: request.quantity <= 4n,
        availableQuantity: 4n,
        earliestStart: '2026-08-29T10:00:00.000Z',
        reason: 'simulation vehicle availability',
        simulationOnly: true,
      }),
    );
  }

  quote(request: import('../../types.ts').ProviderQuoteRequest) {
    const isPremium = request.catalogItemId === PREMIUM_MUSTANG_ITEM.catalogItemId;
    const isStandard = request.catalogItemId === MUSTANG_ITEM.catalogItemId;
    if (!isPremium && !isStandard) {
      return fail('NOT_FOUND', 'catalog item not found');
    }
    const daily = isPremium ? 210_00n : 91_00n;
    const total = daily * request.quantity;
    return ok(
      buildQuote({
        quoteId: quoteIdFor(`${request.idempotencyKey}:${request.catalogItemId}`),
        providerId: this.providerId,
        catalogItemId: request.catalogItemId,
        canonicalUnit: 'VEHICLE_DAY',
        quantity: request.quantity,
        providerPriceMinorUnits: total,
      }),
    );
  }

  reserve(request: import('../../types.ts').ProviderReservationRequest) {
    return ok(
      Object.freeze({
        reservationId: reservationIdFor(request.idempotencyKey),
        providerId: this.providerId,
        quoteId: request.quoteId,
        state: 'HELD',
        expiresAt: '2026-08-24T12:00:00.000Z',
        simulationOnly: true,
      }),
    );
  }

  book(request: import('../../types.ts').ProviderBookingRequest) {
    return ok(
      Object.freeze({
        bookingId: bookingIdFor(request.idempotencyKey),
        providerId: this.providerId,
        reservationId: request.reservationId,
        state: 'CONFIRMED',
        rightKind: 'ACCESS_RIGHT',
        accessRightRef: `ar_${request.reservationId}`,
        simulationOnly: true,
      }),
    );
  }

  cancel(request: import('../../types.ts').ProviderCancellationRequest) {
    return ok(
      Object.freeze({
        cancellationId: `pcn_${request.bookingId}`,
        providerId: this.providerId,
        bookingId: request.bookingId,
        state: 'CANCELLED',
        simulationOnly: true,
      }),
    );
  }
}

export function createSimulationTuroProvider(): SimulationTuroProvider {
  return new SimulationTuroProvider();
}
