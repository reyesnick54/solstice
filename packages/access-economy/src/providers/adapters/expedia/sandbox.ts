/**
 * Expedia Rapid sandbox access provider.
 *
 * Maps canonical Access provider operations onto official Rapid Lodging API
 * operations via injected transport. External Rapid response models do not
 * escape this adapter boundary.
 */

import type {
  AccessProvider,
  AccessProviderOutcome,
  ProviderAvailabilityRequest,
  ProviderAvailabilityResult,
  ProviderBooking,
  ProviderBookingRequest,
  ProviderCancellation,
  ProviderCancellationRequest,
  ProviderHealth,
  ProviderQuote,
  ProviderQuoteRequest,
  ProviderReservation,
  ProviderReservationRequest,
  ProviderSearchRequest,
  ProviderSearchResult,
} from '../../types.ts';
import { PROVIDER_CAPABILITY_REGISTRY } from '../../capabilities.ts';
import type { ProviderCredentialPort } from '../../security.ts';
import { NoOpProviderCredentialPort } from '../../security.ts';
import { buildExpediaAuthorizationHeader } from './auth.ts';
import { resolveExpediaCredentials } from './credentials.ts';
import { EXPEDIA_RAPID_PATHS } from './endpoints.ts';
import { ProviderRuntimeControls, createProviderRuntimeControls } from './controls.ts';
import {
  EXPEDIA_SANDBOX_ROME_PROPERTY_ID,
  type ExpediaProviderTransport,
  type ExpediaTransportRequest,
  createFixtureExpediaSandboxTransport,
} from './transport.ts';
import {
  bookingIdFor,
  buildQuote,
  fail,
  ok,
  quoteIdFor,
  reservationIdFor,
  SIMULATION_NOW,
} from '../shared.ts';
import { EXPEDIA_PROVIDER_CONTRACT } from './contract.ts';
import type { ProviderAuditPort } from '../../audit.ts';
import { NoOpProviderAuditPort } from '../../audit.ts';

const ROME_CATALOG_ITEM_ID = 'expedia_rome_trastevere';

export type SandboxExpediaProviderDeps = {
  readonly transport?: ExpediaProviderTransport;
  readonly credentials?: ProviderCredentialPort;
  readonly controls?: ProviderRuntimeControls;
  readonly audit?: ProviderAuditPort;
  readonly now?: () => string;
  readonly nowMs?: () => number;
};

export class SandboxExpediaProvider implements AccessProvider {
  readonly providerId = 'expedia' as const;
  readonly displayName = 'Expedia Rapid Sandbox';
  readonly integrationState = 'SANDBOX_AVAILABLE' as const;
  readonly capabilities = PROVIDER_CAPABILITY_REGISTRY.expedia.capabilities;

  private readonly transport: ExpediaProviderTransport;
  private readonly credentials: ProviderCredentialPort;
  private readonly controls: ProviderRuntimeControls;
  private readonly audit: ProviderAuditPort;
  private readonly now: () => string;
  private readonly nowMs: () => number;
  private credentialState: 'CREDENTIALS_REQUIRED' | 'SANDBOX_READY' = 'CREDENTIALS_REQUIRED';

  constructor(deps: SandboxExpediaProviderDeps = {}) {
    this.transport = deps.transport ?? createFixtureExpediaSandboxTransport();
    this.credentials = deps.credentials ?? new NoOpProviderCredentialPort();
    this.controls = deps.controls ?? createProviderRuntimeControls();
    this.audit = deps.audit ?? new NoOpProviderAuditPort();
    this.now = deps.now ?? (() => SIMULATION_NOW);
    this.nowMs = deps.nowMs ?? (() => Date.now());
  }

  health(): ProviderHealth {
    return Object.freeze({
      providerId: this.providerId,
      integrationState: this.integrationState,
      healthy: this.controls.snapshot().circuitState !== 'OPEN',
      lastCheckedAt: this.now(),
      message:
        this.credentialState === 'SANDBOX_READY'
          ? 'Expedia Rapid sandbox transport ready'
          : EXPEDIA_PROVIDER_CONTRACT.notes,
    });
  }

  private async prepareAuth(): Promise<string | null> {
    const bundle = await resolveExpediaCredentials(this.credentials);
    this.credentialState = bundle.state;
    if (bundle.state !== 'SANDBOX_READY' || !bundle.apiKey || !bundle.sharedSecret) {
      return null;
    }
    return buildExpediaAuthorizationHeader({
      apiKey: bundle.apiKey,
      sharedSecret: bundle.sharedSecret,
      timestampSeconds: Math.floor(this.nowMs() / 1000),
    });
  }

  private async executeTransport(request: ExpediaTransportRequest): Promise<AccessProviderOutcome<import('./transport.ts').ExpediaTransportResponse>> {
    const auth = await this.prepareAuth();
    const enriched: ExpediaTransportRequest = Object.freeze({
      ...request,
      ...(auth ? { authorizationHeader: auth } : {}),
    });
    this.audit.record({
      providerId: this.providerId,
      operation: request.operation,
      correlationId: request.correlationId ?? request.idempotencyKey ?? request.operation,
      outcome: 'ATTEMPT',
      at: this.now(),
    });
    const controlled = await this.controls.execute(enriched, (payload) => this.transport.execute(payload), this.nowMs());
    if (controlled.outcome === 'REJECTED') {
      this.audit.record({
        providerId: this.providerId,
        operation: request.operation,
        correlationId: request.correlationId ?? request.idempotencyKey ?? request.operation,
        outcome: 'REJECTED',
        at: this.now(),
        code: controlled.code ?? 'UNKNOWN',
      });
      return fail(controlled.code ?? 'PROVIDER_REJECTED', `expedia sandbox transport rejected: ${controlled.code}`);
    }
    const response = controlled.response!;
    this.audit.record({
      providerId: this.providerId,
      operation: request.operation,
      correlationId: request.correlationId ?? request.idempotencyKey ?? request.operation,
      outcome: response.ok ? 'SUCCESS' : 'FAILURE',
      at: this.now(),
      code: String(response.status),
    });
    return ok(response);
  }

  search(request: ProviderSearchRequest): AccessProviderOutcome<ProviderSearchResult> {
    const haystack = `${request.query} ${request.location ?? ''}`.toLowerCase();
    if (!haystack.includes('rome')) {
      return fail('NO_MATCH', 'no Expedia sandbox catalog item matches this search');
    }
    return this.searchRome(request);
  }

  private searchRome(request: ProviderSearchRequest): AccessProviderOutcome<ProviderSearchResult> {
    return ok(
      Object.freeze({
        requestId: request.requestId,
        items: Object.freeze([
          Object.freeze({
            catalogItemId: ROME_CATALOG_ITEM_ID,
            providerId: this.providerId,
            category: 'HOUSING_ROOM_NIGHTS' as const,
            canonicalUnit: 'ROOM_NIGHT' as const,
            title: 'Rome lodging — Expedia Rapid sandbox',
            description: 'Official Rapid sandbox property candidate for Rome lodging redemption.',
            location: 'Rome, IT',
            serviceClass: 'STANDARD',
            rightKind: 'OCCUPANCY_RIGHT' as const,
          }),
        ]),
        simulationOnly: false,
        sandboxOnly: true,
      }),
    );
  }

  availability(request: ProviderAvailabilityRequest): AccessProviderOutcome<ProviderAvailabilityResult> {
    if (request.catalogItemId !== ROME_CATALOG_ITEM_ID) {
      return fail('NOT_FOUND', 'catalog item not found');
    }
    const nights = nightsBetween(request.startsAt, request.endsAt);
    const outcome = this.availabilitySync(request, nights);
    return outcome;
  }

  private availabilitySync(
    request: ProviderAvailabilityRequest,
    nights: number,
  ): AccessProviderOutcome<ProviderAvailabilityResult> {
    const transportOutcome = this.executeTransportSync({
      operation: 'PROPERTIES_AVAILABILITY',
      path: EXPEDIA_RAPID_PATHS.PROPERTIES_AVAILABILITY,
      method: 'GET',
      query: Object.freeze({
        property_id: EXPEDIA_SANDBOX_ROME_PROPERTY_ID,
        nights: String(nights),
      }),
      correlationId: request.requestId,
    });
    if (!transportOutcome.ok) {
      return transportOutcome;
    }
    const body = transportOutcome.value.body;
    const available = body.properties !== undefined && request.quantity <= 5n;
    return ok(
      Object.freeze({
        requestId: request.requestId,
        providerId: this.providerId,
        available,
        availableQuantity: available ? 5n : 0n,
        earliestStart: request.startsAt,
        reason: available ? 'expedia sandbox availability confirmed' : 'expedia sandbox unavailable',
        simulationOnly: false,
        sandboxOnly: true,
      }),
    );
  }

  quote(request: ProviderQuoteRequest): AccessProviderOutcome<ProviderQuote> {
    if (request.catalogItemId !== ROME_CATALOG_ITEM_ID) {
      return fail('NOT_FOUND', 'catalog item not found');
    }
    const nights = Number(request.quantity);
    const transportOutcome = this.executeTransportSync({
      operation: 'PRICE_CHECK',
      path: EXPEDIA_RAPID_PATHS.PROPERTY_ROOM_RATE,
      method: 'GET',
      query: Object.freeze({ nights: String(nights) }),
      idempotencyKey: request.idempotencyKey,
      correlationId: request.requestId,
    });
    if (!transportOutcome.ok) {
      return transportOutcome;
    }
    const nightly = 18_000n;
    const total = nightly * request.quantity;
    const rateToken =
      typeof transportOutcome.value.body.rate_token === 'string' ? transportOutcome.value.body.rate_token : null;
    return ok(
      buildQuote({
        quoteId: quoteIdFor(`${request.idempotencyKey}:${request.catalogItemId}`),
        providerId: this.providerId,
        catalogItemId: request.catalogItemId,
        canonicalUnit: 'ROOM_NIGHT',
        quantity: request.quantity,
        providerPriceMinorUnits: total,
        connectivity: 'SANDBOX',
        providerRateToken: rateToken,
      }),
    );
  }

  reserve(request: ProviderReservationRequest): AccessProviderOutcome<ProviderReservation> {
    return ok(
      Object.freeze({
        reservationId: reservationIdFor(request.idempotencyKey),
        providerId: this.providerId,
        quoteId: request.quoteId,
        state: 'HELD',
        expiresAt: '2026-08-24T12:00:00.000Z',
        simulationOnly: false,
        sandboxOnly: true,
        providerHoldToken: `hold_${request.idempotencyKey}`,
      }),
    );
  }

  book(request: ProviderBookingRequest): AccessProviderOutcome<ProviderBooking> {
    const transportOutcome = this.executeTransportSync({
      operation: 'CREATE_ITINERARY',
      path: EXPEDIA_RAPID_PATHS.ITINERARIES,
      method: 'POST',
      body: Object.freeze({ reservation_id: request.reservationId }),
      idempotencyKey: request.idempotencyKey,
      correlationId: request.requestId,
    });
    if (!transportOutcome.ok) {
      return transportOutcome;
    }
    const itineraryId =
      typeof transportOutcome.value.body.itinerary_id === 'string'
        ? transportOutcome.value.body.itinerary_id
        : bookingIdFor(request.idempotencyKey);
    return ok(
      Object.freeze({
        bookingId: bookingIdFor(request.idempotencyKey),
        providerId: this.providerId,
        reservationId: request.reservationId,
        state: 'CONFIRMED',
        rightKind: 'OCCUPANCY_RIGHT',
        accessRightRef: `occ_${request.reservationId}`,
        simulationOnly: false,
        sandboxOnly: true,
        providerItineraryId: itineraryId,
      }),
    );
  }

  cancel(request: ProviderCancellationRequest): AccessProviderOutcome<ProviderCancellation> {
    const transportOutcome = this.executeTransportSync({
      operation: 'CANCEL_ROOM',
      path: EXPEDIA_RAPID_PATHS.ITINERARY_ROOM,
      method: 'DELETE',
      query: Object.freeze({ itinerary_id: request.bookingId, room_id: 'room_booking_1' }),
      idempotencyKey: request.idempotencyKey,
      correlationId: request.requestId,
    });
    if (!transportOutcome.ok) {
      return transportOutcome;
    }
    return ok(
      Object.freeze({
        cancellationId: `pcn_${request.bookingId}`,
        providerId: this.providerId,
        bookingId: request.bookingId,
        state: 'CANCELLED',
        simulationOnly: false,
        sandboxOnly: true,
      }),
    );
  }

  controlsSnapshot() {
    return this.controls.snapshot();
  }

  private executeTransportSync(
    request: ExpediaTransportRequest,
  ): AccessProviderOutcome<import('./transport.ts').ExpediaTransportResponse> {
    this.audit.record({
      providerId: this.providerId,
      operation: request.operation,
      correlationId: request.correlationId ?? request.idempotencyKey ?? request.operation,
      outcome: 'ATTEMPT',
      at: this.now(),
    });
    const result = this.transport.execute(request);
    const response = result instanceof Promise ? null : result;
    if (!response) {
      this.audit.record({
        providerId: this.providerId,
        operation: request.operation,
        correlationId: request.correlationId ?? request.idempotencyKey ?? request.operation,
        outcome: 'REJECTED',
        at: this.now(),
        code: 'ASYNC_TRANSPORT_REQUIRED',
      });
      return fail('ASYNC_TRANSPORT_REQUIRED', 'synchronous transport execution required in this context');
    }
    this.audit.record({
      providerId: this.providerId,
      operation: request.operation,
      correlationId: request.correlationId ?? request.idempotencyKey ?? request.operation,
      outcome: response.ok ? 'SUCCESS' : 'FAILURE',
      at: this.now(),
      code: String(response.status),
    });
    if (!response.ok) {
      return fail('PROVIDER_ERROR', `expedia sandbox returned status ${response.status}`);
    }
    return ok(response);
  }
}

function nightsBetween(startsAt: string, endsAt: string): number {
  const start = Date.parse(startsAt);
  const end = Date.parse(endsAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return 1;
  }
  return Math.max(1, Math.round((end - start) / 86_400_000));
}

export function createSandboxExpediaProvider(deps?: SandboxExpediaProviderDeps): SandboxExpediaProvider {
  return new SandboxExpediaProvider(deps);
}
