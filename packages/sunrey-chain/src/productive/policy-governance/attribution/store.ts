import {
  attachClaimToEvent,
  attachContributionToEvent,
  attachObjectView,
  considerEventLink,
  createProductiveEconomicEvent,
  mergeSameUnderlyingEvent,
  relationRecord,
  supersedeEvent,
  type CreateEconomicEventInput,
} from './event.ts';
import { rebuildProductiveAttributionGraph, type AttributionGraphSources } from './graph.ts';
import type {
  EventIdentityEvidence,
  EventRelation,
  IdentityRef,
  ProductiveAttributionGraph,
  ProductiveEconomicEvent,
} from './types.ts';

/**
 * In-memory identity index. Rebuildable. Not a ledger.
 */
export class ProductiveEventIdentityRegistry {
  private readonly events = new Map<string, ProductiveEconomicEvent>();
  private readonly byFingerprint = new Map<string, string>();
  private readonly byClaim = new Map<string, string>();
  private readonly relations: EventRelation[] = [];
  private readonly evidenceByEvent = new Map<string, EventIdentityEvidence>();

  register(input: CreateEconomicEventInput, evidence: EventIdentityEvidence): ProductiveEconomicEvent {
    const created = createProductiveEconomicEvent(input);
    const existingId = this.byFingerprint.get(created.eventFingerprint);
    if (existingId) {
      const existing = this.events.get(existingId);
      if (existing) {
        const merged = this.absorb(existing, created, evidence);
        return merged;
      }
    }
    this.events.set(created.eventId, created);
    this.byFingerprint.set(created.eventFingerprint, created.eventId);
    this.evidenceByEvent.set(created.eventId, evidence);
    for (const claim of created.claimRefs) {
      this.byClaim.set(claim, created.eventId);
    }
    return created;
  }

  attachClaim(eventId: string, claimRef: IdentityRef): ProductiveEconomicEvent {
    const current = this.require(eventId);
    const next = attachClaimToEvent(current, claimRef);
    this.events.set(eventId, next);
    this.byClaim.set(claimRef, eventId);
    return next;
  }

  attachContribution(eventId: string, contributionRef: IdentityRef): ProductiveEconomicEvent {
    const current = this.require(eventId);
    const next = attachContributionToEvent(current, contributionRef);
    this.events.set(eventId, next);
    return next;
  }

  attachObject(eventId: string, objectRef: IdentityRef): ProductiveEconomicEvent {
    const current = this.require(eventId);
    const next = attachObjectView(current, objectRef);
    this.events.set(eventId, next);
    return next;
  }

  link(leftId: string, rightId: string): {
    readonly left: ProductiveEconomicEvent;
    readonly right: ProductiveEconomicEvent | null;
    readonly merged: boolean;
    readonly reviewRequired: boolean;
    readonly relation: EventRelation | null;
  } {
    const left = this.require(leftId);
    if (leftId === rightId) {
      return {
        left,
        right: left,
        merged: true,
        reviewRequired: false,
        relation: relationRecord(left.eventId, left.eventId, 'SAME_UNDERLYING_EVENT', 'AUTHORITATIVE_LINK'),
      };
    }
    const right = this.require(rightId);
    const leftEvidence = this.evidenceByEvent.get(leftId);
    const rightEvidence = this.evidenceByEvent.get(rightId);
    if (!leftEvidence || !rightEvidence) {
      return { left, right, merged: false, reviewRequired: true, relation: null };
    }
    const decision = considerEventLink(left, leftEvidence, right, rightEvidence);
    if (decision.merged && decision.canEstablishSameUnderlyingEvent) {
      const merged = mergeSameUnderlyingEvent(left, right, decision);
      this.events.set(left.eventId, merged);
      this.events.delete(right.eventId);
      this.byFingerprint.set(merged.eventFingerprint, left.eventId);
      this.evidenceByEvent.set(left.eventId, leftEvidence);
      for (const claim of merged.claimRefs) {
        this.byClaim.set(claim, left.eventId);
      }
      const relation = relationRecord(left.eventId, right.eventId, 'SAME_UNDERLYING_EVENT', decision.confidence);
      this.relations.push(relation);
      return { left: merged, right: null, merged: true, reviewRequired: false, relation };
    }
    if (decision.reviewRequired) {
      return { left, right, merged: false, reviewRequired: true, relation: null };
    }
    const relation = decision.relation
      ? relationRecord(`event:${left.eventId}`, `event:${right.eventId}`, decision.relation, decision.confidence)
      : null;
    if (relation) {
      this.relations.push(relation);
    }
    return { left, right, merged: false, reviewRequired: false, relation };
  }

  recordRelation(relation: EventRelation): void {
    this.relations.push(relation);
  }

  supersede(priorId: string, nextInput: CreateEconomicEventInput, evidence: EventIdentityEvidence): ProductiveEconomicEvent {
    const prior = this.require(priorId);
    const result = supersedeEvent(prior, nextInput);
    this.events.set(result.prior.eventId, result.prior);
    this.events.set(result.next.eventId, result.next);
    this.byFingerprint.set(result.next.eventFingerprint, result.next.eventId);
    this.evidenceByEvent.set(result.next.eventId, evidence);
    this.relations.push(result.relation);
    return result.next;
  }

  get(eventId: string): ProductiveEconomicEvent | undefined {
    return this.events.get(eventId);
  }

  getByClaim(claimRef: IdentityRef): ProductiveEconomicEvent | undefined {
    const eventId = this.byClaim.get(claimRef);
    return eventId ? this.events.get(eventId) : undefined;
  }

  getByFingerprint(fingerprint: string): ProductiveEconomicEvent | undefined {
    const eventId = this.byFingerprint.get(fingerprint);
    return eventId ? this.events.get(eventId) : undefined;
  }

  list(): readonly ProductiveEconomicEvent[] {
    return Object.freeze([...this.events.values()].sort((left, right) => left.eventId.localeCompare(right.eventId)));
  }

  listRelations(): readonly EventRelation[] {
    return Object.freeze([...this.relations]);
  }

  graph(extra?: Partial<AttributionGraphSources>): ProductiveAttributionGraph {
    return rebuildProductiveAttributionGraph({
      events: this.list(),
      relations: [...this.relations, ...(extra?.relations ?? [])],
      objectRefs: extra?.objectRefs,
      claimRefs: extra?.claimRefs,
      contributionRefs: extra?.contributionRefs,
      economicAssetRefs: extra?.economicAssetRefs,
    });
  }

  private require(eventId: string): ProductiveEconomicEvent {
    const event = this.events.get(eventId);
    if (!event) {
      throw new Error(`unknown economic event ${eventId}`);
    }
    return event;
  }

  private absorb(
    existing: ProductiveEconomicEvent,
    incoming: ProductiveEconomicEvent,
    evidence: EventIdentityEvidence,
  ): ProductiveEconomicEvent {
    const priorEvidence = this.evidenceByEvent.get(existing.eventId);
    if (priorEvidence) {
      const decision = considerEventLink(existing, priorEvidence, incoming, evidence);
      if (decision.canEstablishSameUnderlyingEvent) {
        const merged = mergeSameUnderlyingEvent(existing, incoming, decision);
        this.events.set(existing.eventId, merged);
        for (const claim of merged.claimRefs) {
          this.byClaim.set(claim, existing.eventId);
        }
        return merged;
      }
    }
    const attached = incoming.claimRefs.reduce((event, claim) => attachClaimToEvent(event, claim), existing);
    this.events.set(existing.eventId, attached);
    return attached;
  }
}
