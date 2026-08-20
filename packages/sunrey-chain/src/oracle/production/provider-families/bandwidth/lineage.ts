/**
 * Privacy-safe bandwidth event identity and multi-stage lineage.
 *
 * The same transfer may be observed by a router, CDN, cloud meter,
 * ISP, and customer edge. Those are corroborating observations of
 * one economic event, not automatically five productive services.
 *
 * Origin hosting, transit, CDN, and last-mile access may be
 * distinct network services. They are not collapsed automatically.
 * Cache hits do not create copies of underlying content.
 */

import { identityRef } from '../../../../productive/policy-governance/attribution/identity.ts';
import {
  createProductiveEconomicEvent,
  eventIdFromFingerprint,
} from '../../../../productive/policy-governance/attribution/event.ts';
import { economicEventFingerprintV3 } from '../../../../productive/policy-governance/attribution/identity.ts';
import type {
  EventIdentityEvidence,
  ProductiveEconomicEvent,
} from '../../../../productive/policy-governance/attribution/types.ts';
import type {
  BandwidthEconomicIdentity,
  BandwidthSourceObservation,
  NetworkServiceStage,
} from './types.ts';
import { hashAccountReference } from './privacy.ts';

export function identityOf(observation: BandwidthSourceObservation): BandwidthEconomicIdentity {
  const intervalKey = `${observation.measurementStart}:${observation.measurementEnd}`;
  return Object.freeze({
    schemaVersion: 1,
    networkServiceRef: identityRef('network-service-stage', `${observation.networkServiceId}:${observation.networkStage}`),
    serviceAgreementRef: identityRef('service-agreement', observation.serviceAgreementId),
    providerRef: identityRef('provider', observation.providerId),
    networkEdgeRef: identityRef('network-edge', observation.networkEdgeId),
    transferIntervalRef: identityRef('transfer-interval', intervalKey),
    trafficAggregateRef: identityRef('traffic-aggregate', observation.trafficAggregateId),
    peeringDomainRef: observation.peeringDomainId ? identityRef('peering-domain', observation.peeringDomainId) : null,
    controllerRef: identityRef('controller', observation.controllerId),
    accountRef: identityRef('account', hashAccountReference(observation.accountControllerId)),
    measurementStart: observation.measurementStart,
    measurementEnd: observation.measurementEnd,
    networkStage: observation.networkStage,
    packetPayloadStored: false,
    userBrowsingHistoryStored: false,
    subscriberPiiStored: false,
  });
}

export function bandwidthEventEvidence(
  observation: BandwidthSourceObservation,
  identity: BandwidthEconomicIdentity,
  measurementRef: string,
): EventIdentityEvidence {
  const period = {
    validFromUnixSeconds: observation.measurementStart,
    validUntilUnixSeconds: observation.measurementEnd,
    epoch: 1,
  };
  return Object.freeze({
    transformationRef: identity.networkServiceRef,
    alternateViewGroupRef: identity.trafficAggregateRef,
    physicalObjectRefs: Object.freeze(
      [identity.networkEdgeRef, identity.peeringDomainRef].filter((item): item is string => item !== null),
    ),
    sourceObjectRefs: Object.freeze([identity.serviceAgreementRef]),
    inputLotRefs: Object.freeze([]),
    outputLotRefs: Object.freeze([identity.trafficAggregateRef]),
    serialAssetRefs: Object.freeze([identity.networkServiceRef]),
    measurementPeriod: period,
    deliveryPeriod: {
      fromUnixSeconds: observation.measurementStart,
      untilUnixSeconds: observation.measurementEnd,
    },
    geographyId: observation.region,
    jurisdiction: 'US',
    oracleFactRefs: Object.freeze([identityRef('source', `${observation.sourceClass}:${observation.identifier}`)]),
    sourceProvenanceRefs: Object.freeze([identityRef('schema', observation.schemaId)]),
    upstreamEventRefs: Object.freeze([]),
    downstreamEventRefs: Object.freeze([]),
    canonicalMeasurementRefs: Object.freeze([identityRef('measurement', measurementRef)]),
    controllerRefs: Object.freeze([identity.controllerRef]),
    participantRefs: Object.freeze([identity.accountRef]),
    sourceSystemRefs: Object.freeze([identityRef('source-class', observation.sourceClass)]),
    lineageRoot: identity.trafficAggregateRef,
    economicTransformationRef: identity.networkServiceRef,
  });
}

export function economicEventForBandwidth(
  observation: BandwidthSourceObservation,
  identity: BandwidthEconomicIdentity,
  measurementRef: string,
): ProductiveEconomicEvent {
  return createProductiveEconomicEvent({
    eventClass: 'BANDWIDTH_SERVICE_EVENT',
    evidence: bandwidthEventEvidence(observation, identity, measurementRef),
  });
}

export function sameBandwidthTransfer(
  left: BandwidthSourceObservation,
  right: BandwidthSourceObservation,
): boolean {
  if (left.networkStage !== right.networkStage) {
    return false;
  }
  const leftEvent = economicEventForBandwidth(left, identityOf(left), 'measure');
  const rightEvent = economicEventForBandwidth(right, identityOf(right), 'measure');
  return leftEvent.eventId === rightEvent.eventId || leftEvent.eventFingerprint === rightEvent.eventFingerprint;
}

export function distinctNetworkStages(left: NetworkServiceStage, right: NetworkServiceStage): boolean {
  return left !== right;
}

export function bandwidthEventId(observation: BandwidthSourceObservation): string {
  const identity = identityOf(observation);
  const evidence = bandwidthEventEvidence(observation, identity, 'measure');
  return eventIdFromFingerprint(economicEventFingerprintV3(evidence));
}

export function cacheHitIsNotContentCopy(observation: BandwidthSourceObservation): true {
  if (observation.cacheHit === true && observation.transferSemantics !== 'CACHE_EGRESS_BYTES') {
    throw new Error('CACHE_HIT_COUNTED_AS_CONTENT_COPY');
  }
  return true;
}

export type BandwidthLineageLink = {
  readonly fromObservationId: string;
  readonly toObservationId: string;
  readonly relation: 'SAME_UNDERLYING_EVENT' | 'DISTINCT_NETWORK_STAGE' | 'LINEAGE_ONLY';
  readonly impliesDuplicateValue: boolean;
  readonly cacheHitCreatesContentCopy: false;
};

export function linkBandwidthObservations(
  left: BandwidthSourceObservation,
  right: BandwidthSourceObservation,
): BandwidthLineageLink {
  const sameTransfer = sameBandwidthTransfer(left, right);
  const distinct = distinctNetworkStages(left.networkStage, right.networkStage);
  return Object.freeze({
    fromObservationId: left.identifier,
    toObservationId: right.identifier,
    relation: sameTransfer ? 'SAME_UNDERLYING_EVENT' : distinct ? 'DISTINCT_NETWORK_STAGE' : 'LINEAGE_ONLY',
    impliesDuplicateValue: sameTransfer,
    cacheHitCreatesContentCopy: false as const,
  });
}
