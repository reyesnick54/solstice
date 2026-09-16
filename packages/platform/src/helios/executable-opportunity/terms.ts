import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { ExecutionRouteDescriptor, MarketTermsPort, QualificationTermsSnapshot } from './types.ts';
import type { QualificationReasonCode, VenueSessionState } from './taxonomy.ts';

const DEFAULT_VALIDITY_SECONDS = 900;

export function captureQualificationTerms(input: {
  readonly route: ExecutionRouteDescriptor;
  readonly now: UtcInstant;
  readonly venueSession?: VenueSessionState;
  readonly validitySeconds?: number;
}): QualificationTermsSnapshot {
  const validUntil = new Date(Date.parse(input.now) + (input.validitySeconds ?? DEFAULT_VALIDITY_SECONDS) * 1000).toISOString() as UtcInstant;
  return Object.freeze({
    snapshotId: `terms_${input.route.routeId}_${input.now}`,
    capturedAt: input.now,
    validUntil,
    priceReference: Object.freeze({
      symbol: input.route.providerSymbol,
      minorUnits: '10000',
      currency: input.route.minimumNotional?.currency ?? 'USD',
      asOf: input.now,
    }),
    spreadBps: 5,
    ...(input.route.minimumNotional ? { minimumSize: input.route.minimumNotional } : {}),
    ...(input.route.feeMetadata ? { feeMetadata: input.route.feeMetadata } : {}),
    liquidityState: 'ADEQUATE',
    venueSession: input.venueSession ?? 'OPEN',
    providerAvailability: input.route.availability,
  });
}

export function termsStillValid(terms: QualificationTermsSnapshot, now: UtcInstant): boolean {
  return Date.parse(now) <= Date.parse(terms.validUntil);
}

export function termsRevalidationReason(
  terms: QualificationTermsSnapshot,
  current: QualificationTermsSnapshot,
): QualificationReasonCode | null {
  if (terms.providerAvailability !== current.providerAvailability) {
    return 'TERMS_MATERIAL_CHANGE';
  }
  if (terms.venueSession !== current.venueSession && current.venueSession === 'CLOSED') {
    return 'VENUE_CLOSED';
  }
  if (terms.priceReference?.minorUnits !== current.priceReference?.minorUnits) {
    return 'TERMS_MATERIAL_CHANGE';
  }
  return null;
}

export function createMarketTermsPort(venueSession: VenueSessionState = 'OPEN'): MarketTermsPort {
  return Object.freeze({
    currentTerms(input: {
      readonly route: ExecutionRouteDescriptor;
      readonly now: UtcInstant;
    }) {
      const terms = captureQualificationTerms({
        route: input.route,
        now: input.now,
        venueSession,
      });
      if (venueSession === 'CLOSED') {
        return Object.freeze({ ok: false as const, reason: 'VENUE_CLOSED' as QualificationReasonCode });
      }
      return terms;
    },
  });
}

export function qualificationExpiryFromTerms(terms: QualificationTermsSnapshot): UtcInstant {
  return terms.validUntil;
}
