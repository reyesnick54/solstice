/**
 * ACCESS Wave 2 / Prompt 32 — Commercial Access Provider tests.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  AMADEUS_PROVIDER_CONTRACT,
  BOOKING_COM_PROVIDER_CONTRACT,
  COMMERCIAL_PROVIDER_REGISTRY,
  FIXTURE_TRAVELER_PROFILE,
  TICKETMASTER_DISCOVERY_PROVIDER_CONTRACT,
  TICKETMASTER_PARTNER_PROVIDER_CONTRACT,
  VIATOR_PROVIDER_CONTRACT,
  assertFirmQuoteForSettlement,
  commercialCredentialRefs,
  createAmadeusCommercialAdapter,
  createCommercialAccessProviderGateway,
  createCommercialIdempotencyStore,
  evaluateCommercialActivation,
  fixtureIndicativeQuote,
  fixtureReferenceQuote,
  mapCommercialQuoteToProviderQuote,
  mayRetryBooking,
  redactCredentialFromError,
  scanProviderPayload,
  toMinimalProviderPayload,
  validateBookingProfile,
} from './index.ts';

const FIXTURE_GATEWAY = createCommercialAccessProviderGateway({ fixtureMode: true });
const PRODUCTION_GATEWAY = createCommercialAccessProviderGateway({ fixtureMode: false });

describe('Prompt 32 — provider capability declarations', () => {
  it('registers five commercial providers', () => {
    const providers = PRODUCTION_GATEWAY.listProviders();
    assert.equal(providers.length, 5);
    assert.ok(providers.find((row) => row.providerId === 'amadeus'));
    assert.ok(providers.find((row) => row.providerId === 'ticketmaster_discovery'));
  });

  it('declares provider-specific capabilities', () => {
    const discovery = COMMERCIAL_PROVIDER_REGISTRY.ticketmaster_discovery;
    assert.equal(discovery.capabilities.find((c) => c.capabilityId === 'SEARCH')?.supported, true);
    assert.equal(discovery.capabilities.find((c) => c.capabilityId === 'BOOK')?.supported, false);
    const partner = COMMERCIAL_PROVIDER_REGISTRY.ticketmaster_partner;
    assert.equal(partner.capabilities.find((c) => c.capabilityId === 'REFUND')?.supported, true);
  });
});

describe('Prompt 32 — activation state', () => {
  it('blocks pending credentials honestly', () => {
    const gate = evaluateCommercialActivation({
      providerId: 'amadeus',
      activationState: 'BLOCKED_PENDING_CREDENTIALS',
      capabilityId: 'SEARCH',
      credentialStatus: 'MISSING',
      contractStatus: 'NONE',
    });
    assert.equal(gate.allowed, false);
  });

  it('does not silently enable production in simulation', () => {
    const gate = evaluateCommercialActivation({
      providerId: 'amadeus',
      activationState: 'PRODUCTION',
      capabilityId: 'BOOK',
      credentialStatus: 'VALIDATED',
      contractStatus: 'SIGNED',
      environment: 'simulation',
    });
    assert.equal(gate.allowed, false);
    assert.ok(gate.reasons.includes('simulation_environment_blocks_production'));
  });

  it('blocks commercial operations without fixture mode', () => {
    const search = PRODUCTION_GATEWAY.search({
      requestId: 'blocked_search',
      providerId: 'amadeus',
      category: 'TRAVEL',
      query: 'JFK LHR',
      location: 'New York, NY',
      startsAt: null,
      endsAt: null,
      limit: 5,
    });
    assert.equal(search.ok, false);
    if (!search.ok) {
      assert.equal(search.code, 'ACTIVATION_BLOCKED');
    }
  });

  it('allows discovery-only search for Ticketmaster Discovery in fixture mode', () => {
    const search = FIXTURE_GATEWAY.search({
      requestId: 'discovery_search',
      providerId: 'ticketmaster_discovery',
      category: 'EXPERIENCES',
      query: 'concert',
      location: 'New York, NY',
      startsAt: null,
      endsAt: null,
      limit: 5,
    });
    assert.equal(search.ok, true);
  });
});

describe('Prompt 32 — product mapping', () => {
  it('maps provider products to canonical access products', () => {
    const mapping = FIXTURE_GATEWAY.productMappings.findByProviderProduct(
      'booking_com',
      'booking_nyc_midtown_double',
    );
    assert.ok(mapping);
    assert.equal(mapping?.canonicalUnit, 'ROOM_NIGHT');
    assert.equal(mapping?.accessProductId, 'access_hotel_room_night_standard');
  });
});

describe('Prompt 32 — search normalization', () => {
  it('returns canonical search items without vendor payloads', () => {
    const search = FIXTURE_GATEWAY.search({
      requestId: 'search_norm',
      providerId: 'amadeus',
      category: 'TRAVEL',
      query: 'flight',
      location: 'New York, NY',
      startsAt: null,
      endsAt: null,
      limit: 5,
    });
    assert.equal(search.ok, true);
    if (search.ok) {
      assert.ok(search.value.items.length > 0);
      assert.equal(search.value.items[0]?.providerId, 'amadeus');
      assert.equal('amadeusNativePayload' in (search.value as object), false);
    }
  });
});

describe('Prompt 32 — availability', () => {
  it('returns firm availability with inventory reference', () => {
    const availability = FIXTURE_GATEWAY.getAvailability({
      requestId: 'avail_1',
      providerId: 'booking_com',
      providerProductId: 'booking_nyc_midtown_double',
      quantity: 1n,
      startsAt: '2026-09-01T15:00:00.000Z',
      endsAt: '2026-09-05T11:00:00.000Z',
      location: 'New York, NY',
    });
    assert.equal(availability.ok, true);
    if (availability.ok) {
      assert.equal(availability.value.status, 'AVAILABLE');
      assert.ok(availability.value.inventoryReference);
    }
  });
});

describe('Prompt 32 — quote classification', () => {
  it('distinguishes reference, indicative, and firm quotes', () => {
    const firm = fixtureIndicativeQuote('viator', 'viator_nyc_harbor_cruise');
    assert.equal(firm.classification, 'INDICATIVE');
    const reference = fixtureReferenceQuote('viator', 'viator_nyc_harbor_cruise');
    assert.equal(reference.classification, 'REFERENCE');
    const settlement = assertFirmQuoteForSettlement(reference);
    assert.equal(settlement.ok, false);
  });

  it('allows only firm quotes for settlement mapping', () => {
    const quote = FIXTURE_GATEWAY.quote({
      requestId: 'quote_firm',
      providerId: 'viator',
      providerProductId: 'viator_nyc_harbor_cruise',
      category: 'EXPERIENCES',
      quantity: 2n,
      startsAt: '2026-09-01T15:00:00.000Z',
      endsAt: '2026-09-05T11:00:00.000Z',
      location: 'New York, NY',
      idempotencyKey: 'firm_quote_key',
    });
    assert.equal(quote.ok, true);
    if (quote.ok) {
      assert.equal(quote.value.classification, 'FIRM');
      assert.equal(assertFirmQuoteForSettlement(quote.value).ok, true);
    }
  });
});

describe('Prompt 32 — taxes, fees, and security deposit', () => {
  it('separates taxes, mandatory fees, and optional fees', () => {
    const quote = FIXTURE_GATEWAY.quote({
      requestId: 'quote_fees',
      providerId: 'booking_com',
      providerProductId: 'booking_nyc_midtown_double',
      category: 'HOUSING_ROOM_NIGHTS',
      quantity: 2n,
      startsAt: '2026-09-01T15:00:00.000Z',
      endsAt: '2026-09-05T11:00:00.000Z',
      location: 'New York, NY',
      idempotencyKey: 'fee_quote',
    });
    assert.equal(quote.ok, true);
    if (quote.ok) {
      assert.ok(quote.value.taxes.length > 0);
      assert.ok(quote.value.mandatoryFees.length > 0);
      assert.ok(quote.value.optionalFees.length > 0);
      assert.ok(quote.value.mandatoryFees.every((fee) => fee.mandatory));
      assert.ok(quote.value.optionalFees.every((fee) => !fee.mandatory));
    }
  });

  it('keeps security deposit separate from eligible funding', () => {
    const quote = FIXTURE_GATEWAY.quote({
      requestId: 'quote_deposit',
      providerId: 'booking_com',
      providerProductId: 'booking_nyc_midtown_double',
      category: 'HOUSING_ROOM_NIGHTS',
      quantity: 2n,
      startsAt: '2026-09-01T15:00:00.000Z',
      endsAt: '2026-09-05T11:00:00.000Z',
      location: 'New York, NY',
      idempotencyKey: 'deposit_quote',
    });
    assert.equal(quote.ok, true);
    if (quote.ok) {
      assert.ok(quote.value.securityDeposit);
      const mapped = mapCommercialQuoteToProviderQuote(quote.value);
      assert.ok(mapped.securityDepositMinorUnits);
      assert.ok(mapped.eligibleFundingMinorUnits < quote.value.totalAmount.minorUnits);
    }
  });
});

describe('Prompt 32 — reservation', () => {
  it('creates provider reservation with hold state', () => {
    const quote = FIXTURE_GATEWAY.quote({
      requestId: 'rsv_quote',
      providerId: 'amadeus',
      providerProductId: 'amadeus_hotel_manhattan_standard',
      category: 'HOUSING_ROOM_NIGHTS',
      quantity: 1n,
      startsAt: '2026-09-01T15:00:00.000Z',
      endsAt: '2026-09-05T11:00:00.000Z',
      location: 'New York, NY',
      idempotencyKey: 'rsv_quote_key',
    });
    assert.equal(quote.ok, true);
    if (!quote.ok) {
      return;
    }
    const reservation = FIXTURE_GATEWAY.reserve({
      requestId: 'rsv_1',
      providerId: 'amadeus',
      providerQuoteId: quote.value.providerQuoteId,
      travelerProfileRef: FIXTURE_TRAVELER_PROFILE.profileRef,
      idempotencyKey: 'rsv_key_1',
    });
    assert.equal(reservation.ok, true);
    if (reservation.ok) {
      assert.equal(reservation.value.state, 'HELD');
      assert.equal(reservation.value.inventoryStatus, 'HELD');
    }
  });
});

describe('Prompt 32 — booking', () => {
  it('books with confirmation code', () => {
    const quote = FIXTURE_GATEWAY.quote({
      requestId: 'book_quote',
      providerId: 'booking_com',
      providerProductId: 'booking_nyc_midtown_double',
      category: 'HOUSING_ROOM_NIGHTS',
      quantity: 1n,
      startsAt: '2026-09-01T15:00:00.000Z',
      endsAt: '2026-09-05T11:00:00.000Z',
      location: 'New York, NY',
      idempotencyKey: 'book_quote_key',
    });
    assert.equal(quote.ok, true);
    if (!quote.ok) {
      return;
    }
    const booking = FIXTURE_GATEWAY.book({
      requestId: 'book_1',
      providerId: 'booking_com',
      providerReservationId: null,
      providerQuoteId: quote.value.providerQuoteId,
      travelerProfile: FIXTURE_TRAVELER_PROFILE,
      idempotencyKey: 'book_key_1',
    });
    assert.equal(booking.ok, true);
    if (booking.ok) {
      assert.equal(booking.value.status, 'CONFIRMED');
      assert.ok(booking.value.confirmationCode);
    }
  });
});

describe('Prompt 32 — cancellation and refund metadata', () => {
  it('returns cancellation with refund eligibility metadata', () => {
    const booking = FIXTURE_GATEWAY.book({
      requestId: 'cxl_book',
      providerId: 'ticketmaster_partner',
      providerReservationId: null,
      providerQuoteId: 'cpq_fixture',
      travelerProfile: FIXTURE_TRAVELER_PROFILE,
      idempotencyKey: 'cxl_book_key',
    });
    assert.equal(booking.ok, true);
    if (!booking.ok) {
      return;
    }
    const cancellation = FIXTURE_GATEWAY.cancelBooking({
      requestId: 'cxl_1',
      providerId: 'ticketmaster_partner',
      providerBookingId: booking.value.providerBookingId,
      reason: 'customer_request',
      idempotencyKey: 'cxl_key_1',
    });
    assert.equal(cancellation.ok, true);
    if (cancellation.ok) {
      assert.equal(cancellation.value.cancelled, true);
      assert.equal(cancellation.value.refundEligible, true);
      assert.ok(cancellation.value.penaltyAmount);
    }
  });

  it('exposes refund metadata without settlement', () => {
    const refund = FIXTURE_GATEWAY.refund({
      requestId: 'ref_1',
      providerId: 'ticketmaster_partner',
      providerBookingId: 'cpbk_fixture',
      amount: null,
      idempotencyKey: 'ref_key_1',
    });
    assert.equal(refund.ok, true);
    if (refund.ok) {
      assert.equal(refund.value.state, 'COMPLETED');
      assert.ok(refund.value.refundAmount.minorUnits > 0n);
    }
  });
});

describe('Prompt 32 — reconciliation and unknown booking', () => {
  it('reconciles booking status', () => {
    const reconcile = FIXTURE_GATEWAY.reconcile({
      requestId: 'rec_1',
      providerId: 'amadeus',
      providerBookingId: 'cpbk_unknown',
      idempotencyKey: 'rec_key_1',
    });
    assert.equal(reconcile.ok, true);
    if (reconcile.ok) {
      assert.equal(reconcile.value.reconciliationState, 'RESOLVED');
    }
  });

  it('marks timeout bookings as unknown requiring reconciliation', () => {
    const gateway = createCommercialAccessProviderGateway({
      fixtureMode: true,
      providers: {
        amadeus: createAmadeusCommercialAdapter({ fixtureMode: true, scenario: 'BOOKING_TIMEOUT' }),
      },
    });
    const booking = gateway.book({
      requestId: 'timeout_book',
      providerId: 'amadeus',
      providerReservationId: null,
      providerQuoteId: 'cpq_timeout',
      travelerProfile: FIXTURE_TRAVELER_PROFILE,
      idempotencyKey: 'timeout_key',
    });
    assert.equal(booking.ok, true);
    if (booking.ok) {
      assert.equal(booking.value.status, 'UNKNOWN');
      assert.equal(booking.value.reconciliationState, 'RECONCILIATION_REQUIRED');
    }
  });
});

describe('Prompt 32 — idempotency', () => {
  it('does not create duplicate bookings for repeated idempotency keys', () => {
    const store = createCommercialIdempotencyStore();
    const gateway = createCommercialAccessProviderGateway({
      fixtureMode: true,
      providers: {
        booking_com: createCommercialAccessProviderGateway({ fixtureMode: true }).getProvider('booking_com'),
      },
    });
    const request = {
      requestId: 'idem_book',
      providerId: 'booking_com' as const,
      providerReservationId: null,
      providerQuoteId: 'cpq_idem',
      travelerProfile: FIXTURE_TRAVELER_PROFILE,
      idempotencyKey: 'same_booking_key',
    };
    const first = gateway.book(request);
    const second = gateway.book(request);
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (first.ok && second.ok) {
      assert.equal(first.value.providerBookingId, second.value.providerBookingId);
    }
    void store;
  });
});

describe('Prompt 32 — credential security and data minimization', () => {
  it('references credentials via secret refs only', () => {
    const refs = commercialCredentialRefs('amadeus');
    assert.ok(refs.length > 0);
    assert.ok(refs.every((ref) => ref.secretRef.startsWith('regulated/')));
  });

  it('redacts credentials from error messages', () => {
    const redacted = redactCredentialFromError('failed with api_key=supersecret123 and bearer abc.def.ghi');
    assert.ok(!redacted.includes('supersecret123'));
    assert.ok(redacted.includes('[REDACTED]'));
  });

  it('rejects forbidden provider payload fields', () => {
    const scan = scanProviderPayload({
      givenName: 'Alex',
      tokenHoldings: { sunrey: 100 },
      bankBalances: [1000],
    });
    assert.equal(scan.safe, false);
    assert.ok(scan.violations.some((v) => v.includes('tokenHoldings')));
  });

  it('sends minimal booking profile only', () => {
    const minimal = toMinimalProviderPayload(FIXTURE_TRAVELER_PROFILE);
    assert.equal(minimal.profileRef, FIXTURE_TRAVELER_PROFILE.profileRef);
    assert.equal('hin' in minimal, false);
    const profile = validateBookingProfile(FIXTURE_TRAVELER_PROFILE);
    assert.equal(profile.safe, true);
  });
});

describe('Prompt 32 — no financial side effects', () => {
  it('does not consume access funding or settle fiat in quote mapping', () => {
    const quote = FIXTURE_GATEWAY.quote({
      requestId: 'no_funding',
      providerId: 'viator',
      providerProductId: 'viator_nyc_harbor_cruise',
      category: 'EXPERIENCES',
      quantity: 1n,
      startsAt: '2026-09-01T15:00:00.000Z',
      endsAt: '2026-09-05T11:00:00.000Z',
      location: 'New York, NY',
      idempotencyKey: 'no_funding_key',
    });
    assert.equal(quote.ok, true);
    if (quote.ok) {
      const mapped = mapCommercialQuoteToProviderQuote(quote.value);
      assert.equal(mapped.providerQuote.settlementTerms.simulationOnly, true);
      assert.equal(mapped.providerQuote.settlementTerms.settlementRail, 'FIAT_PAYMENTS');
    }
  });
});

describe('Prompt 32 — booking retry safety', () => {
  it('does not allow blind booking retry without idempotency', () => {
    assert.equal(
      mayRetryBooking({ supportsIdempotency: false, idempotencyKeySupplied: true, documentedSafe: true }),
      false,
    );
    assert.equal(
      mayRetryBooking({ supportsIdempotency: true, idempotencyKeySupplied: true, documentedSafe: true }),
      true,
    );
  });
});

describe('Prompt 32 — provider contracts', () => {
  it('documents honest readiness for each provider', () => {
    assert.equal(AMADEUS_PROVIDER_CONTRACT.liveConnectivity, false);
    assert.equal(BOOKING_COM_PROVIDER_CONTRACT.activationState, 'BLOCKED_PENDING_CONTRACT');
    assert.equal(VIATOR_PROVIDER_CONTRACT.activationState, 'BLOCKED_PENDING_CREDENTIALS');
    assert.equal(TICKETMASTER_PARTNER_PROVIDER_CONTRACT.liveConnectivity, false);
    assert.equal(TICKETMASTER_DISCOVERY_PROVIDER_CONTRACT.commercialBooking, false);
  });
});

describe('Prompt 32 — Ticketmaster Discovery vs Partner', () => {
  it('blocks booking on discovery adapter', () => {
    const adapter = FIXTURE_GATEWAY.getProvider('ticketmaster_discovery');
    const book = adapter.book?.({
      requestId: 'disc_book',
      providerId: 'ticketmaster_discovery',
      providerReservationId: null,
      providerQuoteId: 'cpq_disc',
      travelerProfile: FIXTURE_TRAVELER_PROFILE,
      idempotencyKey: 'disc_key',
    });
    assert.equal(book?.ok, false);
  });
});
