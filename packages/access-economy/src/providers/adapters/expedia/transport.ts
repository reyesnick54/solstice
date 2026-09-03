/**
 * Injected Expedia Rapid transport.
 *
 * Fixture and scripted sandbox implementations only. No fetch, vendor SDK,
 * or outbound network in this module — real sandbox connectivity is bound
 * outside access-economy when credentials and an approved transport are injected.
 */

import { EXPEDIA_RAPID_PATHS } from './endpoints.ts';

export const EXPEDIA_TRANSPORT_OPERATIONS = [
  'HEALTH',
  'REGIONS_SEARCH',
  'PROPERTIES_AVAILABILITY',
  'PRICE_CHECK',
  'CREATE_ITINERARY',
  'GET_ITINERARY',
  'CANCEL_ROOM',
  'WEBHOOK_VERIFY',
] as const;
export type ExpediaTransportOperation = (typeof EXPEDIA_TRANSPORT_OPERATIONS)[number];

export type ExpediaTransportRequest = {
  readonly operation: ExpediaTransportOperation;
  readonly path: string;
  readonly method: 'GET' | 'POST' | 'DELETE';
  readonly query?: Readonly<Record<string, string>>;
  readonly body?: Readonly<Record<string, unknown>>;
  readonly idempotencyKey?: string;
  readonly correlationId?: string;
  readonly authorizationHeader?: string;
};

export type ExpediaTransportResponse = {
  readonly ok: boolean;
  readonly status: number;
  readonly body: Readonly<Record<string, unknown>>;
  readonly networkUsed: false;
  readonly latencyMs: number;
};

export type ExpediaProviderTransport = {
  readonly kind: 'FIXTURE_SANDBOX' | 'SCRIPTED_SANDBOX' | 'INJECTED_NETWORK';
  readonly networkEnabled: boolean;
  execute(request: ExpediaTransportRequest): ExpediaTransportResponse | Promise<ExpediaTransportResponse>;
};

export type ScriptedExpediaOutcome =
  | 'SUCCESS'
  | 'UNAVAILABLE'
  | 'PRICE_MISMATCH'
  | 'AUTH_FAILED'
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'OUTAGE'
  | 'DECLINED';

/** Official Rapid sandbox test property used in Expedia developer documentation. */
export const EXPEDIA_SANDBOX_ROME_PROPERTY_ID = '19248';

const ROME_CATALOG_ITEM_ID = 'expedia_rome_trastevere';

function response(
  ok: boolean,
  status: number,
  body: Readonly<Record<string, unknown>>,
  latencyMs = 42,
): ExpediaTransportResponse {
  return Object.freeze({ ok, status, body: Object.freeze({ ...body }), networkUsed: false, latencyMs });
}

function availabilityBody(propertyId: string, nights: number, nightlyMinorUnits: bigint): Readonly<Record<string, unknown>> {
  const total = nightlyMinorUnits * BigInt(nights);
  return Object.freeze({
    properties: Object.freeze([
      Object.freeze({
        property_id: propertyId,
        rooms: Object.freeze([
          Object.freeze({
            id: 'room_standard',
            room_name: 'Standard Room',
            rates: Object.freeze([
              Object.freeze({
                id: 'rate_refundable',
                status: 'available',
                refundable: true,
                occupancy_pricing: Object.freeze({
                  '2': Object.freeze({
                    totals: Object.freeze({
                      inclusive: Object.freeze({
                        billable_currency: Object.freeze({
                          value: String(Number(total) / 100),
                          currency: 'USD',
                        }),
                      }),
                    }),
                  }),
                }),
                links: Object.freeze({
                  price_check: Object.freeze({
                    href: EXPEDIA_RAPID_PATHS.PROPERTY_ROOM_RATE.replace('{property_id}', propertyId)
                      .replace('{room_id}', 'room_standard')
                      .replace('{rate_id}', 'rate_refundable'),
                  }),
                }),
              }),
            ]),
          }),
        ]),
      }),
    ]),
    catalogItemId: ROME_CATALOG_ITEM_ID,
    nightlyMinorUnits: String(nightlyMinorUnits),
  });
}

export class FixtureExpediaSandboxTransport implements ExpediaProviderTransport {
  readonly kind: ExpediaProviderTransport['kind'] = 'FIXTURE_SANDBOX';
  readonly networkEnabled = false as const;
  private readonly idempotentBookings = new Map<string, ExpediaTransportResponse>();

  execute(request: ExpediaTransportRequest): ExpediaTransportResponse {
    if (request.operation === 'HEALTH') {
      return response(true, 200, { status: 'available', sandbox: true });
    }
    if (request.operation === 'REGIONS_SEARCH') {
      return response(true, 200, {
        regions: Object.freeze([
          Object.freeze({ id: 'rome_it', name: 'Rome', type: 'city', country_code: 'IT' }),
        ]),
      });
    }
    if (request.operation === 'PROPERTIES_AVAILABILITY') {
      const nights = Number(request.query?.nights ?? '1');
      return response(true, 200, availabilityBody(EXPEDIA_SANDBOX_ROME_PROPERTY_ID, nights, 18_000n));
    }
    if (request.operation === 'PRICE_CHECK') {
      const nights = Number(request.query?.nights ?? '1');
      const total = 18_000n * BigInt(nights);
      return response(true, 200, {
        status: 'available',
        rate_token: `rt_${request.idempotencyKey ?? 'fixture'}`,
        totals: Object.freeze({
          inclusive: Object.freeze({
            billable_currency: Object.freeze({
              value: String(Number(total) / 100),
              currency: 'USD',
            }),
          }),
        }),
      });
    }
    if (request.operation === 'CREATE_ITINERARY') {
      if (request.idempotencyKey) {
        const existing = this.idempotentBookings.get(request.idempotencyKey);
        if (existing) {
          return existing;
        }
      }
      const itineraryId = `itin_${request.idempotencyKey ?? 'fixture'}`;
      const booking = response(true, 201, {
        itinerary_id: itineraryId,
        rooms: Object.freeze([
          Object.freeze({
            id: 'room_booking_1',
            status: 'booked',
            confirmation_id: `conf_${itineraryId}`,
          }),
        ]),
      });
      if (request.idempotencyKey) {
        this.idempotentBookings.set(request.idempotencyKey, booking);
      }
      return booking;
    }
    if (request.operation === 'GET_ITINERARY') {
      return response(true, 200, {
        itinerary_id: request.query?.itinerary_id ?? 'itin_fixture',
        status: 'booked',
      });
    }
    if (request.operation === 'CANCEL_ROOM') {
      return response(true, 200, { status: 'canceled' });
    }
    if (request.operation === 'WEBHOOK_VERIFY') {
      return response(true, 200, { verified: true });
    }
    return response(false, 400, { error: 'unsupported_operation' });
  }
}

export class ScriptedExpediaSandboxTransport extends FixtureExpediaSandboxTransport {
  override readonly kind: ExpediaProviderTransport['kind'] = 'SCRIPTED_SANDBOX';
  private readonly scripts = new Map<string, ScriptedExpediaOutcome>();

  script(key: string, outcome: ScriptedExpediaOutcome): void {
    this.scripts.set(key, outcome);
  }

  override execute(request: ExpediaTransportRequest): ExpediaTransportResponse {
    const outcome =
      (request.idempotencyKey ? this.scripts.get(request.idempotencyKey) : undefined) ??
      (request.correlationId ? this.scripts.get(request.correlationId) : undefined) ??
      this.scripts.get(request.operation) ??
      'SUCCESS';
    if (outcome === 'SUCCESS') {
      return super.execute(request);
    }
    if (outcome === 'UNAVAILABLE') {
      return response(false, 409, { type: 'rooms_unavailable', message: 'no availability' });
    }
    if (outcome === 'PRICE_MISMATCH') {
      return response(false, 409, { type: 'price_mismatch', message: 'stale rate' });
    }
    if (outcome === 'AUTH_FAILED') {
      return response(false, 401, { type: 'invalid_signature' });
    }
    if (outcome === 'RATE_LIMITED') {
      return response(false, 429, { type: 'rate_limited' });
    }
    if (outcome === 'TIMEOUT') {
      return response(false, 504, { type: 'gateway_timeout' });
    }
    if (outcome === 'OUTAGE') {
      return response(false, 503, { type: 'service_unavailable' });
    }
    return response(false, 400, { type: 'cc_declined' });
  }
}

export function createFixtureExpediaSandboxTransport(): FixtureExpediaSandboxTransport {
  return new FixtureExpediaSandboxTransport();
}

export function createScriptedExpediaSandboxTransport(): ScriptedExpediaSandboxTransport {
  return new ScriptedExpediaSandboxTransport();
}
