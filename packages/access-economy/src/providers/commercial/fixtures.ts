/**
 * Deterministic commercial provider fixtures for CI.
 *
 * No internet dependency. Covers search, availability, firm quote,
 * reservation, booking, cancellation, refund, timeout/unknown, and
 * provider-unavailable scenarios.
 */

import type {
  AccessProviderAvailability,
  AccessProviderBooking,
  AccessProviderCancellation,
  AccessProviderProductMapping,
  AccessProviderQuote,
  AccessProviderReservation,
  AccessProviderSearchItem,
  CommercialFeeLine,
  CommercialProviderId,
} from './types.ts';
import {
  COMMERCIAL_FIXTURE_EXPIRES,
  COMMERCIAL_FIXTURE_NOW,
  deterministicId,
  fixtureProvenance,
  money,
} from './shared.ts';

export const FIXTURE_TRAVELER_PROFILE = Object.freeze({
  profileRef: 'bp_fixture_traveler_001',
  givenName: 'Alex',
  familyName: 'Rivera',
  email: 'alex.rivera@example.test',
  phone: '+1-555-0100',
});

const NYC_HOTEL_TAX: CommercialFeeLine = Object.freeze({
  feeId: 'tax_city',
  label: 'City occupancy tax',
  amount: money('USD', 1_850n),
  mandatory: true,
});

const NYC_HOTEL_RESORT_FEE: CommercialFeeLine = Object.freeze({
  feeId: 'fee_resort',
  label: 'Resort fee',
  amount: money('USD', 3_500n),
  mandatory: true,
});

const NYC_HOTEL_BREAKFAST_UPGRADE: CommercialFeeLine = Object.freeze({
  feeId: 'opt_breakfast',
  label: 'Breakfast upgrade',
  amount: money('USD', 2_400n),
  mandatory: false,
});

export function fixtureSearchItems(providerId: CommercialProviderId): readonly AccessProviderSearchItem[] {
  switch (providerId) {
    case 'amadeus':
      return Object.freeze([
        Object.freeze({
          providerProductId: 'amadeus_flight_jfk_lhr_economy',
          providerId,
          category: 'TRAVEL',
          title: 'JFK → LHR Economy',
          description: 'Fixture flight segment for commercial adapter tests.',
          location: 'New York, NY',
          canonicalUnit: 'PASSENGER_SEGMENT',
        }),
        Object.freeze({
          providerProductId: 'amadeus_hotel_manhattan_standard',
          providerId,
          category: 'HOUSING_ROOM_NIGHTS',
          title: 'Manhattan Standard Room',
          description: 'Fixture hotel room via Amadeus hotel API shape.',
          location: 'New York, NY',
          canonicalUnit: 'ROOM_NIGHT',
        }),
      ]);
    case 'booking_com':
      return Object.freeze([
        Object.freeze({
          providerProductId: 'booking_nyc_midtown_double',
          providerId,
          category: 'HOUSING_ROOM_NIGHTS',
          title: 'Midtown Double Room',
          description: 'Fixture accommodation via Booking.com Demand shape.',
          location: 'New York, NY',
          canonicalUnit: 'ROOM_NIGHT',
        }),
      ]);
    case 'viator':
      return Object.freeze([
        Object.freeze({
          providerProductId: 'viator_nyc_harbor_cruise',
          providerId,
          category: 'EXPERIENCES',
          title: 'Harbor Cruise Experience',
          description: 'Fixture experience slot via Viator partner shape.',
          location: 'New York, NY',
          canonicalUnit: 'EXPERIENCE_SLOT',
        }),
      ]);
    case 'ticketmaster_partner':
      return Object.freeze([
        Object.freeze({
          providerProductId: 'tm_partner_concert_ga',
          providerId,
          category: 'EXPERIENCES',
          title: 'Concert — General Admission',
          description: 'Fixture event admission via Ticketmaster Partner API shape.',
          location: 'Madison Square Garden',
          canonicalUnit: 'ADMISSION_RIGHT',
        }),
      ]);
    case 'ticketmaster_discovery':
      return Object.freeze([
        Object.freeze({
          providerProductId: 'tm_discovery_concert_info',
          providerId,
          category: 'EXPERIENCES',
          title: 'Concert — Discovery listing',
          description: 'Informational discovery listing only; not bookable.',
          location: 'Madison Square Garden',
          canonicalUnit: 'ADMISSION_RIGHT',
        }),
      ]);
    default:
      return Object.freeze([]);
  }
}

export function fixtureAvailability(
  providerId: CommercialProviderId,
  providerProductId: string,
): AccessProviderAvailability {
  return Object.freeze({
    providerId,
    providerProductId,
    startsAt: '2026-09-01T15:00:00.000Z',
    endsAt: '2026-09-05T11:00:00.000Z',
    unitsAvailable: 4n,
    status: 'AVAILABLE',
    inventoryReference: `inv_${providerProductId}`,
    expiresAt: COMMERCIAL_FIXTURE_EXPIRES,
    provenance: fixtureProvenance(),
  });
}

export function fixtureFirmQuote(
  providerId: CommercialProviderId,
  providerProductId: string,
  idempotencyKey: string,
): AccessProviderQuote {
  const providerQuoteId = deterministicId('cpq', `${providerId}:${providerProductId}:${idempotencyKey}`);
  const base = money('USD', 24_500n);
  const total =
    base.minorUnits +
    NYC_HOTEL_TAX.amount.minorUnits +
    NYC_HOTEL_RESORT_FEE.amount.minorUnits;

  return Object.freeze({
    providerQuoteId,
    providerId,
    providerProductId,
    category: providerId === 'viator' || providerId.startsWith('ticketmaster') ? 'EXPERIENCES' : 'HOUSING_ROOM_NIGHTS',
    classification: 'FIRM',
    units: 2n,
    unit: providerId === 'amadeus' && providerProductId.includes('flight') ? 'PASSENGER_SEGMENT' : 'ROOM_NIGHT',
    baseAmount: base,
    taxes: Object.freeze([NYC_HOTEL_TAX]),
    mandatoryFees: Object.freeze([NYC_HOTEL_RESORT_FEE]),
    optionalFees: Object.freeze([NYC_HOTEL_BREAKFAST_UPGRADE]),
    securityDeposit: money('USD', 15_000n),
    totalAmount: money('USD', total),
    expiresAt: COMMERCIAL_FIXTURE_EXPIRES,
    termsReference: `terms://${providerId}/${providerProductId}`,
    cancellationPolicy: 'Free cancellation until 48 hours before check-in.',
    providerReference: `pref_${providerQuoteId}`,
    provenance: fixtureProvenance(),
  });
}

export function fixtureIndicativeQuote(
  providerId: CommercialProviderId,
  providerProductId: string,
): AccessProviderQuote {
  const firm = fixtureFirmQuote(providerId, providerProductId, 'indicative');
  return Object.freeze({ ...firm, classification: 'INDICATIVE', providerQuoteId: `${firm.providerQuoteId}_ind` });
}

export function fixtureReferenceQuote(
  providerId: CommercialProviderId,
  providerProductId: string,
): AccessProviderQuote {
  const firm = fixtureFirmQuote(providerId, providerProductId, 'reference');
  return Object.freeze({ ...firm, classification: 'REFERENCE', providerQuoteId: `${firm.providerQuoteId}_ref` });
}

export function fixtureReservation(
  providerId: CommercialProviderId,
  providerQuoteId: string,
  idempotencyKey: string,
): AccessProviderReservation {
  const providerReservationId = deterministicId('cprsv', `${providerId}:${providerQuoteId}:${idempotencyKey}`);
  return Object.freeze({
    providerReservationId,
    providerId,
    providerQuoteId,
    state: 'HELD',
    expiresAt: COMMERCIAL_FIXTURE_EXPIRES,
    price: money('USD', 29_850n),
    inventoryStatus: 'HELD',
    provenance: fixtureProvenance(),
  });
}

export function fixtureBooking(
  providerId: CommercialProviderId,
  providerQuoteId: string,
  idempotencyKey: string,
): AccessProviderBooking {
  const providerBookingId = deterministicId('cpbk', `${providerId}:${providerQuoteId}:${idempotencyKey}`);
  return Object.freeze({
    providerBookingId,
    providerId,
    reservationReference: deterministicId('cprsv', providerQuoteId),
    confirmationCode: `CNF-${providerBookingId.slice(-6).toUpperCase()}`,
    status: 'CONFIRMED',
    reconciliationState: 'RESOLVED',
    startsAt: '2026-09-01T15:00:00.000Z',
    endsAt: '2026-09-05T11:00:00.000Z',
    travelerReference: FIXTURE_TRAVELER_PROFILE.profileRef,
    providerTerms: `terms://${providerId}`,
    cancellationPolicy: 'Free cancellation until 48 hours before check-in.',
    totalAmount: money('USD', 29_850n),
    createdAt: COMMERCIAL_FIXTURE_NOW,
    provenance: fixtureProvenance(),
  });
}

export function fixtureFailedBooking(providerId: CommercialProviderId): AccessProviderBooking {
  return Object.freeze({
    ...fixtureBooking(providerId, 'failed_quote', 'failed_booking'),
    status: 'FAILED',
    reconciliationState: 'RESOLVED',
    confirmationCode: null,
  });
}

export function fixtureUnknownBooking(providerId: CommercialProviderId, idempotencyKey: string): AccessProviderBooking {
  const booking = fixtureBooking(providerId, 'unknown_quote', idempotencyKey);
  return Object.freeze({
    ...booking,
    status: 'UNKNOWN',
    reconciliationState: 'RECONCILIATION_REQUIRED',
    confirmationCode: null,
  });
}

export function fixtureCancellation(providerId: CommercialProviderId, providerBookingId: string): AccessProviderCancellation {
  return Object.freeze({
    cancelled: true,
    refundEligible: true,
    refundAmount: money('USD', 22_000n),
    penaltyAmount: money('USD', 7_850n),
    providerStatus: 'CANCELLED',
    providerReference: `cxl_${providerBookingId}`,
    provenance: fixtureProvenance(),
  });
}

export function fixturePartialRefund(providerId: CommercialProviderId, providerBookingId: string) {
  return Object.freeze({
    providerRefundId: deterministicId('cprf', providerBookingId),
    providerId,
    providerBookingId,
    state: 'COMPLETED' as const,
    refundAmount: money('USD', 12_000n),
    providerReference: `ref_${providerBookingId}`,
    provenance: fixtureProvenance(),
  });
}

export const FIXTURE_PRODUCT_MAPPINGS: readonly AccessProviderProductMapping[] = Object.freeze([
  Object.freeze({
    mappingId: 'map_amadeus_hotel_manhattan',
    providerId: 'amadeus',
    providerProductId: 'amadeus_hotel_manhattan_standard',
    accessProductId: 'access_hotel_room_night_standard',
    category: 'HOUSING_ROOM_NIGHTS',
    providerNativeUnit: 'room_night',
    canonicalUnit: 'ROOM_NIGHT',
    conversionPolicy: '1:1',
    geography: 'US-NY',
    status: 'ACTIVE',
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    effectiveTo: null,
  }),
  Object.freeze({
    mappingId: 'map_booking_midtown',
    providerId: 'booking_com',
    providerProductId: 'booking_nyc_midtown_double',
    accessProductId: 'access_hotel_room_night_standard',
    category: 'HOUSING_ROOM_NIGHTS',
    providerNativeUnit: 'room',
    canonicalUnit: 'ROOM_NIGHT',
    conversionPolicy: '1:1',
    geography: 'US-NY',
    status: 'ACTIVE',
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    effectiveTo: null,
  }),
  Object.freeze({
    mappingId: 'map_viator_cruise',
    providerId: 'viator',
    providerProductId: 'viator_nyc_harbor_cruise',
    accessProductId: 'access_experience_slot_standard',
    category: 'EXPERIENCES',
    providerNativeUnit: 'traveler',
    canonicalUnit: 'EXPERIENCE_SLOT',
    conversionPolicy: '1:1',
    geography: 'US-NY',
    status: 'ACTIVE',
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    effectiveTo: null,
  }),
  Object.freeze({
    mappingId: 'map_tm_partner_ga',
    providerId: 'ticketmaster_partner',
    providerProductId: 'tm_partner_concert_ga',
    accessProductId: 'access_admission_ga',
    category: 'EXPERIENCES',
    providerNativeUnit: 'ticket',
    canonicalUnit: 'ADMISSION_RIGHT',
    conversionPolicy: '1:1',
    geography: 'US-NY',
    status: 'ACTIVE',
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    effectiveTo: null,
  }),
]);
