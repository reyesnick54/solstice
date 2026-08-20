import { sha256Hex } from '../../../../../security/src/hash.ts';
import {
  assessEventLinkage,
  economicEventFingerprintV3,
  evidenceDigest,
  identityRef,
  sortRefs,
} from './identity.ts';
import {
  ATTRIBUTION_AUTHORITY_BOUNDARY,
  ATTRIBUTION_SCHEMA_VERSION,
  EVENT_IDENTITY_PRODUCTION_ACTIVE,
  relationImpliesDuplicateValue,
  type EventIdentityEvidence,
  type EventRelation,
  type HistoricalFingerprintSet,
  type IdentityRef,
  type LinkageAssessment,
  type ProductiveEconomicEvent,
  type ProductiveEconomicEventClass,
  type ProductiveEconomicEventStatus,
} from './types.ts';

const EMPTY_HISTORY: HistoricalFingerprintSet = Object.freeze({
  v1Contribution: null,
  v2GovernedContribution: null,
  v2CrossCategory: null,
  v2CapacityOutput: null,
});

export type CreateEconomicEventInput = {
  readonly eventClass: ProductiveEconomicEventClass;
  readonly evidence: EventIdentityEvidence;
  readonly claimRefs?: readonly IdentityRef[];
  readonly contributionRefs?: readonly IdentityRef[];
  readonly inputAssetRefs?: readonly IdentityRef[];
  readonly outputAssetRefs?: readonly IdentityRef[];
  readonly parentEventRefs?: readonly IdentityRef[];
  readonly childEventRefs?: readonly IdentityRef[];
  readonly status?: ProductiveEconomicEventStatus;
  readonly historicalFingerprints?: HistoricalFingerprintSet;
  readonly eventVersion?: number;
};

export function createProductiveEconomicEvent(input: CreateEconomicEventInput): ProductiveEconomicEvent {
  const fingerprint = economicEventFingerprintV3(input.evidence);
  const eventId = eventIdFromFingerprint(fingerprint);
  const lineageRoot = input.evidence.lineageRoot ?? eventId;
  return freezeEvent({
    schemaVersion: ATTRIBUTION_SCHEMA_VERSION,
    eventId,
    eventVersion: input.eventVersion ?? 1,
    eventClass: input.eventClass,
    sourceObjectRefs: sortRefs(input.evidence.sourceObjectRefs),
    participantRefs: sortRefs(input.evidence.participantRefs),
    controllerRefs: sortRefs(input.evidence.controllerRefs),
    inputAssetRefs: sortRefs(input.inputAssetRefs ?? input.evidence.inputLotRefs),
    outputAssetRefs: sortRefs(input.outputAssetRefs ?? input.evidence.outputLotRefs),
    sourceFactRefs: sortRefs(input.evidence.oracleFactRefs),
    claimRefs: sortRefs(input.claimRefs ?? []),
    contributionRefs: sortRefs(input.contributionRefs ?? []),
    measurementPeriod: input.evidence.measurementPeriod,
    deliveryPeriod: input.evidence.deliveryPeriod,
    geography: input.evidence.geographyId,
    jurisdiction: input.evidence.jurisdiction,
    canonicalMeasurementRefs: sortRefs(input.evidence.canonicalMeasurementRefs),
    parentEventRefs: sortRefs(input.parentEventRefs ?? input.evidence.upstreamEventRefs),
    childEventRefs: sortRefs(input.childEventRefs ?? input.evidence.downstreamEventRefs),
    lineageRoot,
    eventFingerprint: fingerprint,
    historicalFingerprints: input.historicalFingerprints ?? EMPTY_HISTORY,
    evidenceDigest: evidenceDigest(input.evidence),
    status: input.status ?? 'OBSERVED',
    authorizesMoonReyIssuance: false,
    containsRawIndustrialData: false,
    productionActive: EVENT_IDENTITY_PRODUCTION_ACTIVE,
  });
}

export function attachClaimToEvent(event: ProductiveEconomicEvent, claimRef: IdentityRef): ProductiveEconomicEvent {
  return freezeEvent({
    ...event,
    claimRefs: sortRefs([...event.claimRefs, claimRef]),
  });
}

export function attachContributionToEvent(
  event: ProductiveEconomicEvent,
  contributionRef: IdentityRef,
): ProductiveEconomicEvent {
  return freezeEvent({
    ...event,
    contributionRefs: sortRefs([...event.contributionRefs, contributionRef]),
  });
}

export function attachObjectView(event: ProductiveEconomicEvent, objectRef: IdentityRef): ProductiveEconomicEvent {
  return freezeEvent({
    ...event,
    sourceObjectRefs: sortRefs([...event.sourceObjectRefs, objectRef]),
  });
}

export function verifyEvent(event: ProductiveEconomicEvent): ProductiveEconomicEvent {
  return freezeEvent({ ...event, status: 'VERIFIED' });
}

export function disputeEvent(event: ProductiveEconomicEvent): ProductiveEconomicEvent {
  return freezeEvent({ ...event, status: 'DISPUTED' });
}

/**
 * Corrections are new events. The prior event is SUPERSEDED.
 * History is not rewritten.
 */
export function supersedeEvent(
  prior: ProductiveEconomicEvent,
  nextInput: CreateEconomicEventInput,
): { readonly prior: ProductiveEconomicEvent; readonly next: ProductiveEconomicEvent; readonly relation: EventRelation } {
  const next = createProductiveEconomicEvent({
    ...nextInput,
    eventVersion: prior.eventVersion + 1,
    parentEventRefs: sortRefs([...(nextInput.parentEventRefs ?? []), prior.eventId]),
  });
  const superseded = freezeEvent({
    ...prior,
    status: 'SUPERSEDED',
    childEventRefs: sortRefs([...prior.childEventRefs, next.eventId]),
  });
  return Object.freeze({
    prior: superseded,
    next,
    relation: Object.freeze({
      fromId: next.eventId,
      toId: prior.eventId,
      relation: 'SUPERSEDES',
      confidence: 'AUTHORITATIVE_LINK',
      impliesDuplicateValue: false,
    }),
  });
}

export function considerEventLink(
  left: ProductiveEconomicEvent,
  leftEvidence: EventIdentityEvidence,
  right: ProductiveEconomicEvent,
  rightEvidence: EventIdentityEvidence,
): LinkageAssessment & { readonly sharedEventId: string | null; readonly merged: false | true } {
  const assessment = assessEventLinkage(leftEvidence, rightEvidence);
  if (assessment.canEstablishSameUnderlyingEvent) {
    return Object.freeze({
      ...assessment,
      sharedEventId: left.eventId,
      merged: true,
    });
  }
  return Object.freeze({
    ...assessment,
    sharedEventId: null,
    merged: false,
  });
}

export function mergeSameUnderlyingEvent(
  left: ProductiveEconomicEvent,
  right: ProductiveEconomicEvent,
  assessment: LinkageAssessment,
): ProductiveEconomicEvent {
  if (!assessment.canEstablishSameUnderlyingEvent) {
    throw new Error('WEAK_SIMILARITY_CANNOT_MERGE');
  }
  return freezeEvent({
    ...left,
    sourceObjectRefs: sortRefs([...left.sourceObjectRefs, ...right.sourceObjectRefs]),
    participantRefs: sortRefs([...left.participantRefs, ...right.participantRefs]),
    controllerRefs: sortRefs([...left.controllerRefs, ...right.controllerRefs]),
    inputAssetRefs: sortRefs([...left.inputAssetRefs, ...right.inputAssetRefs]),
    outputAssetRefs: sortRefs([...left.outputAssetRefs, ...right.outputAssetRefs]),
    sourceFactRefs: sortRefs([...left.sourceFactRefs, ...right.sourceFactRefs]),
    claimRefs: sortRefs([...left.claimRefs, ...right.claimRefs]),
    contributionRefs: sortRefs([...left.contributionRefs, ...right.contributionRefs]),
    canonicalMeasurementRefs: sortRefs([...left.canonicalMeasurementRefs, ...right.canonicalMeasurementRefs]),
    parentEventRefs: sortRefs([...left.parentEventRefs, ...right.parentEventRefs]),
    childEventRefs: sortRefs([...left.childEventRefs, ...right.childEventRefs]),
  });
}

export function eventIdentityCannotAuthorizeIssuance(event: ProductiveEconomicEvent): false {
  void event;
  return ATTRIBUTION_AUTHORITY_BOUNDARY.authorizesMoonReyIssuance;
}

export function eventOmitsMoonReyQuantity(event: ProductiveEconomicEvent): true {
  if ('moonreyQuantity' in event || 'moonReyQuantity' in event) {
    throw new Error('MOONREY_QUANTITY_FORBIDDEN');
  }
  return true;
}

export function claimRefFor(claimId: string): IdentityRef {
  return identityRef('claim', claimId);
}

export function contributionRefFor(contributionId: string): IdentityRef {
  return identityRef('contribution', contributionId);
}

export function objectRefFor(objectId: string): IdentityRef {
  return identityRef('object', objectId);
}

export function eventIdFromFingerprint(fingerprint: string): string {
  return `evt_${sha256Hex(`event-id:${fingerprint}`).slice(0, 32)}`;
}

export function sameEventId(left: ProductiveEconomicEvent, right: ProductiveEconomicEvent): boolean {
  return left.eventId === right.eventId;
}

export function relationRecord(
  fromId: string,
  toId: string,
  relation: EventRelation['relation'],
  confidence: EventRelation['confidence'],
): EventRelation {
  return Object.freeze({
    fromId,
    toId,
    relation,
    confidence,
    impliesDuplicateValue: relationImpliesDuplicateValue(relation),
  });
}

function freezeEvent(event: ProductiveEconomicEvent): ProductiveEconomicEvent {
  return Object.freeze({
    ...event,
    sourceObjectRefs: Object.freeze([...event.sourceObjectRefs]),
    participantRefs: Object.freeze([...event.participantRefs]),
    controllerRefs: Object.freeze([...event.controllerRefs]),
    inputAssetRefs: Object.freeze([...event.inputAssetRefs]),
    outputAssetRefs: Object.freeze([...event.outputAssetRefs]),
    sourceFactRefs: Object.freeze([...event.sourceFactRefs]),
    claimRefs: Object.freeze([...event.claimRefs]),
    contributionRefs: Object.freeze([...event.contributionRefs]),
    canonicalMeasurementRefs: Object.freeze([...event.canonicalMeasurementRefs]),
    parentEventRefs: Object.freeze([...event.parentEventRefs]),
    childEventRefs: Object.freeze([...event.childEventRefs]),
    historicalFingerprints: Object.freeze({ ...event.historicalFingerprints }),
    measurementPeriod: Object.freeze({ ...event.measurementPeriod }),
    deliveryPeriod: Object.freeze({ ...event.deliveryPeriod }),
  });
}
