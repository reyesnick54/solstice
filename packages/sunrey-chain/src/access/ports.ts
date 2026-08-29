import type { ProductiveEconomicObject } from '../productive/objects.ts';
import type { ActorDescriptor } from '../protocol/actor.ts';
import type { CanonicalSettlementReference } from './types.ts';

/**
 * Resolves the productive object an access right points at. The productive
 * registry stays the owner of those objects; this is a read-only lookup.
 */
export type AccessProductiveObjectPort = {
  lookup(productiveObjectId: string): ProductiveEconomicObject | undefined;
};

/**
 * Resolves an actor from the existing identity/actor registry. Capability
 * references on the descriptor decide who may issue, revoke, reserve, or
 * attest. This is registry authority, not Execution Authority: the chain
 * neither issues nor verifies Execution Authority.
 */
export type AccessActorRegistryPort = {
  resolveActor(actorRef: string): ActorDescriptor | undefined;
  /**
   * True when the actor is a recognised rights authority for the productive
   * object — normally its owner, controller, or delegated operator.
   */
  isRightsAuthorityFor(actorRef: string, productiveObjectId: string): boolean;
};

/**
 * Confirms that a settlement already exists in the canonical internal ledger.
 * The Access Fabric references settlements; it never creates or moves them.
 */
export type AccessSettlementEvidencePort = {
  lookupSettlement(journalId: string, transferId: string): CanonicalSettlementReference | undefined;
};

export type AccessChainPorts = {
  readonly productiveObjects: AccessProductiveObjectPort;
  readonly actors: AccessActorRegistryPort;
  readonly settlement: AccessSettlementEvidencePort;
};

export function createInMemoryProductiveObjectPort(
  objects: readonly ProductiveEconomicObject[],
): AccessProductiveObjectPort {
  const index = new Map(objects.map((object) => [object.objectId, object]));
  return {
    lookup: (productiveObjectId) => index.get(productiveObjectId),
  };
}

export function createInMemoryActorRegistryPort(input: {
  readonly actors: readonly ActorDescriptor[];
  readonly rightsAuthorities: Readonly<Record<string, readonly string[]>>;
}): AccessActorRegistryPort {
  const index = new Map(input.actors.map((actor) => [actor.actorId, actor]));
  return {
    resolveActor: (actorRef) => index.get(actorRef),
    isRightsAuthorityFor: (actorRef, productiveObjectId) =>
      (input.rightsAuthorities[productiveObjectId] ?? []).includes(actorRef),
  };
}

export function createInMemorySettlementEvidencePort(
  settlements: readonly CanonicalSettlementReference[],
): AccessSettlementEvidencePort {
  const index = new Map(
    settlements.map((settlement) => [`${settlement.journalId}|${settlement.transferId}`, settlement]),
  );
  return {
    lookupSettlement: (journalId, transferId) => index.get(`${journalId}|${transferId}`),
  };
}
