import { err, ok, type Result } from '../../../domain/src/result.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import type { HumanEconomicIdentityId } from './ids.ts';
import { identityLinkIdFor } from './ids.ts';
import type {
  IdentityControllerLink,
  IdentityFailure,
  IdentityLinkPurpose,
  LinkIdentityControllerInput,
} from './types.ts';

export function validateLinkPurposes(purposes: readonly IdentityLinkPurpose[]): Result<true, IdentityFailure> {
  if (purposes.length === 0) {
    return err({ code: 'LINK_PURPOSE_REQUIRED', message: 'identity links require at least one purpose' });
  }
  return ok(true);
}

export function buildIdentityControllerLink(input: LinkIdentityControllerInput): IdentityControllerLink {
  return Object.freeze({
    linkId: identityLinkIdFor(`${input.humanActorId}:${input.controllerKind}:${input.controllerRef}`),
    humanActorId: input.humanActorId,
    controllerKind: input.controllerKind,
    controllerRef: input.controllerRef,
    purposes: Object.freeze([...input.purposes]),
    rightsGrantRef: input.rightsGrantRef ?? null,
    effectiveFrom: input.effectiveFrom,
    effectiveUntil: input.effectiveUntil ?? null,
    revokedAt: null,
    createdAt: input.effectiveFrom,
  });
}

export function linkIsActive(link: IdentityControllerLink, now: UtcInstant): boolean {
  if (link.revokedAt !== null) {
    return false;
  }
  if (link.effectiveUntil !== null && Date.parse(now) >= Date.parse(link.effectiveUntil)) {
    return false;
  }
  return Date.parse(now) >= Date.parse(link.effectiveFrom);
}

export function controllersForHumanActor(
  links: readonly IdentityControllerLink[],
  humanActorId: HumanEconomicIdentityId,
  now: UtcInstant,
): readonly IdentityControllerLink[] {
  return Object.freeze(
    links.filter((link) => link.humanActorId === humanActorId && linkIsActive(link, now)),
  );
}

export function humanActorForController(
  links: readonly IdentityControllerLink[],
  controllerKind: IdentityControllerLink['controllerKind'],
  controllerRef: string,
  now: UtcInstant,
): HumanEconomicIdentityId | null {
  const match = links.find(
    (link) =>
      link.controllerKind === controllerKind &&
      link.controllerRef === controllerRef &&
      linkIsActive(link, now),
  );
  return match?.humanActorId ?? null;
}

export function linkExposesIdentityGraph(link: IdentityControllerLink): boolean {
  return false;
}
