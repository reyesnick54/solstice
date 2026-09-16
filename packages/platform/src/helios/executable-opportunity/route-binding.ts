import { Money } from '../../../../money/src/money.ts';
import type { UtcInstant } from '../../../../domain/src/time.ts';
import { qualificationDecisionIdFor } from './ids.ts';
import type { CanonicalInstrumentBinding, ExecutionRouteDecision, ExecutionRouteDescriptor } from './types.ts';
import type { ExecutionRouteRegistryPort } from './types.ts';
import type { QualificationReasonCode, RouteAvailabilityState } from './taxonomy.ts';
import type { Jurisdiction } from '../../../../domain/src/jurisdiction.ts';
import type { SerializedMoney } from '../../mandate/types.ts';

export function assessExecutionRouteReadiness(input: {
  readonly executableOpportunityId: string;
  readonly instrument: CanonicalInstrumentBinding;
  readonly registry: ExecutionRouteRegistryPort;
  readonly jurisdiction: Jurisdiction;
  readonly environment: 'simulation' | 'sandbox' | 'production_candidate';
  readonly venueSession: 'OPEN' | 'CLOSED' | 'PRE_MARKET' | 'POST_MARKET' | 'UNKNOWN';
  readonly proposedNotional?: SerializedMoney;
  readonly accountClass?: string;
  readonly now: UtcInstant;
}): ExecutionRouteDecision {
  const route = input.registry.routeFor({
    productId: input.instrument.productId,
    instrumentId: input.instrument.instrumentId,
    jurisdiction: input.jurisdiction,
  });
  if (!route) {
    return decision(false, null, 'UNKNOWN', ['ROUTE_UNAVAILABLE'], input.now, input.executableOpportunityId);
  }

  if (input.venueSession === 'CLOSED') {
    return decision(false, route, route.availability, ['VENUE_CLOSED'], input.now, input.executableOpportunityId);
  }

  if (route.availability === 'UNAVAILABLE' || route.availability === 'UNKNOWN') {
    return decision(false, route, route.availability, ['ROUTE_UNAVAILABLE'], input.now, input.executableOpportunityId);
  }

  if (route.availability === 'CERTIFICATION_ONLY') {
    return decision(false, route, route.availability, ['ROUTE_CERTIFICATION_ONLY'], input.now, input.executableOpportunityId);
  }

  if (input.accountClass && route.accountClassRequired && input.accountClass !== route.accountClassRequired) {
    return decision(false, route, route.availability, ['ACCOUNT_CAPABILITY_DENIED'], input.now, input.executableOpportunityId);
  }

  if (input.proposedNotional && route.minimumNotional) {
    const proposed = Money.fromMinorUnitsString(input.proposedNotional.minorUnits, input.proposedNotional.currency);
    const minimum = Money.fromMinorUnitsString(route.minimumNotional.minorUnits, route.minimumNotional.currency);
    if (proposed.cmp(minimum) < 0) {
      return decision(false, route, route.availability, ['MINIMUM_SIZE_FAILURE'], input.now, input.executableOpportunityId);
    }
  }

  const readiness = classifyRouteReadiness(route, input.environment);
  if (!readiness.ready) {
    return decision(false, route, route.availability, readiness.reasonCodes, input.now, input.executableOpportunityId);
  }

  return decision(true, route, route.availability, readiness.reasonCodes, input.now, input.executableOpportunityId);
}

function classifyRouteReadiness(
  route: ExecutionRouteDescriptor,
  environment: 'simulation' | 'sandbox' | 'production_candidate',
): { readonly ready: boolean; readonly reasonCodes: readonly QualificationReasonCode[] } {
  switch (route.availability) {
    case 'LIVE_AUTHORIZED':
      return Object.freeze({ ready: false, reasonCodes: Object.freeze(['ROUTE_CONFIGURED_NOT_LIVE']) });
    case 'CONFIGURED':
      return Object.freeze({ ready: false, reasonCodes: Object.freeze(['ROUTE_NOT_OPERATIONAL']) });
    case 'SANDBOX_AVAILABLE':
      if (environment === 'sandbox' || environment === 'simulation') {
        return Object.freeze({ ready: true, reasonCodes: Object.freeze(['ROUTE_SANDBOX_READY', 'OK']) });
      }
      return Object.freeze({ ready: false, reasonCodes: Object.freeze(['ROUTE_NOT_OPERATIONAL']) });
    case 'AVAILABLE':
      if (environment === 'simulation' || environment === 'sandbox') {
        return Object.freeze({ ready: true, reasonCodes: Object.freeze(['OK']) });
      }
      return Object.freeze({ ready: false, reasonCodes: Object.freeze(['ROUTE_CONFIGURED_NOT_LIVE']) });
    default:
      return Object.freeze({ ready: false, reasonCodes: Object.freeze(['ROUTE_UNAVAILABLE']) });
  }
}

function decision(
  routeReady: boolean,
  route: ExecutionRouteDescriptor | null,
  availability: RouteAvailabilityState,
  reasonCodes: QualificationReasonCode[],
  now: UtcInstant,
  executableOpportunityId: string,
): ExecutionRouteDecision {
  return Object.freeze({
    decisionId: qualificationDecisionIdFor(executableOpportunityId, 'route'),
    routeReady,
    route,
    availability,
    reasonCodes: Object.freeze(reasonCodes),
    decidedAt: now,
  });
}

export function routeAvailabilityLabel(route: ExecutionRouteDescriptor | null): RouteAvailabilityState {
  return route?.availability ?? 'UNKNOWN';
}
