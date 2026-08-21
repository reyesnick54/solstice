import { err, ok, type Result } from '../../domain/src/result.ts';
import { clientDenial, type ClientDenial } from './client-denial.ts';
import type { SolsticeIdentityId } from './ids.ts';

export const OWNED_RESOURCE_KINDS = [
  'account',
  'wallet',
  'portfolio',
  'order',
  'payment',
  'agent',
  'conversation',
  'data_object',
  'device',
  'session',
] as const;

export type OwnedResourceKind = (typeof OWNED_RESOURCE_KINDS)[number];

export type OwnedResource = {
  readonly kind: OwnedResourceKind;
  readonly id: string;
  readonly ownerSubjectId: SolsticeIdentityId;
  readonly ownerCustomerId: string | null;
  readonly ownerActorId: string | null;
};

/**
 * Server-side ownership registry. A client-supplied accountId is never
 * proof of ownership.
 */
export class ResourceOwnershipRegistry {
  private readonly resources = new Map<string, OwnedResource>();

  register(resource: OwnedResource): OwnedResource {
    const frozen = Object.freeze({ ...resource });
    this.resources.set(keyOf(frozen.kind, frozen.id), frozen);
    return frozen;
  }

  get(kind: OwnedResourceKind, id: string): OwnedResource | undefined {
    return this.resources.get(keyOf(kind, id));
  }

  assertOwnedBySubject(
    kind: OwnedResourceKind,
    id: string,
    subjectId: SolsticeIdentityId,
  ): Result<OwnedResource, ClientDenial> {
    const resource = this.resources.get(keyOf(kind, id));
    if (!resource || resource.ownerSubjectId !== subjectId) {
      return err(clientDenial('RESOURCE_NOT_OWNED'));
    }
    return ok(resource);
  }
}

export function isOwnedResourceKind(value: unknown): value is OwnedResourceKind {
  return typeof value === 'string' && (OWNED_RESOURCE_KINDS as readonly string[]).includes(value);
}

function keyOf(kind: OwnedResourceKind, id: string): string {
  return `${kind}:${id}`;
}
