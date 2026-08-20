import { evaluateAttribution, developmentAttributionPolicy, subject, relationship } from '../../../../productive/policy-governance/attribution/index.ts';
import type { AttributionEvaluation } from '../../../../productive/policy-governance/attribution/types.ts';
import type { NormalizedRealEstateObservation } from '../real-estate/types.ts';
import type { NormalizedInfrastructureObservation } from './types.ts';

export function attributeRealEstateAndInfrastructure(input: {
  readonly realEstate: NormalizedRealEstateObservation;
  readonly infrastructure: NormalizedInfrastructureObservation;
  readonly sameUnderlyingService: boolean;
}): AttributionEvaluation {
  const eventId = input.sameUnderlyingService ? 'evt.shared-facility' : 'evt.real-estate';
  const infraEventId = input.sameUnderlyingService ? 'evt.shared-facility' : 'evt.infrastructure';
  return evaluateAttribution({
    policy: developmentAttributionPolicy(),
    height: 1,
    subjects: [
      subject({
        claimId: 'claim.real-estate',
        economicEventId: eventId,
        category: 'REAL_ESTATE_USE',
        claimType: 'USAGE',
        eventClass: 'USAGE',
        controllerId: input.realEstate.controllerId,
        quantity: input.realEstate.canonicalQuantity.mantissa,
        unitId: input.realEstate.canonicalUnit,
        measurementSemantics: 'area_time',
      }),
      subject({
        claimId: 'claim.infrastructure',
        economicEventId: infraEventId,
        category: 'INFRASTRUCTURE',
        claimType: 'USAGE',
        eventClass: 'USAGE',
        controllerId: input.infrastructure.controllerId,
        quantity: input.infrastructure.canonicalQuantity.mantissa,
        unitId: input.infrastructure.canonicalUnit,
        measurementSemantics: 'facility_time',
      }),
    ],
    relationships: [
      relationship(
        eventId,
        infraEventId,
        input.sameUnderlyingService ? 'SAME_UNDERLYING_EVENT' : 'DISTINCT_REALIZED_SERVICE',
      ),
    ],
  });
}

export function attributeInfrastructureAndLogistics(input: {
  readonly infrastructure: NormalizedInfrastructureObservation;
  readonly sameUnderlyingService: boolean;
}): AttributionEvaluation {
  const infraEvent = 'evt.terminal';
  const logisticsEvent = input.sameUnderlyingService ? 'evt.terminal' : 'evt.ocean-freight';
  return evaluateAttribution({
    policy: developmentAttributionPolicy(),
    height: 1,
    subjects: [
      subject({
        claimId: 'claim.terminal',
        economicEventId: infraEvent,
        category: 'INFRASTRUCTURE',
        claimType: 'USAGE',
        eventClass: 'USAGE',
        controllerId: input.infrastructure.controllerId,
        quantity: input.infrastructure.canonicalQuantity.mantissa,
        unitId: input.infrastructure.canonicalUnit,
        measurementSemantics: 'facility_hour',
        evidenceRefs: ['facility_hour'],
      }),
      subject({
        claimId: 'claim.freight',
        economicEventId: logisticsEvent,
        category: 'LOGISTICS_TRANSPORTATION',
        claimType: 'DELIVERY',
        eventClass: 'DELIVERY',
        controllerId: input.sameUnderlyingService ? input.infrastructure.controllerId : 'controller.freight-carrier',
        quantity: 10n,
        unitId: 'tonne_km',
        measurementSemantics: 'tonne_km',
        evidenceRefs: input.sameUnderlyingService ? [] : ['tonne_km'],
      }),
    ],
    relationships: [
      relationship(
        infraEvent,
        logisticsEvent,
        input.sameUnderlyingService ? 'SAME_UNDERLYING_EVENT' : 'DISTINCT_REALIZED_SERVICE',
      ),
    ],
  });
}
