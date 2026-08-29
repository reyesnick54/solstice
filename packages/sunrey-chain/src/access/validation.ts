import { objectIsActive } from '../productive/objects.ts';
import type { AccessActorRegistryPort, AccessProductiveObjectPort } from './ports.ts';
import {
  ACCESS_CAPABILITY_FOR_KIND,
  ACCESS_RIGHT_CLASSES,
  OWNERSHIP_CONVEYING_OPERATIONS,
  OWNERSHIP_RIGHT_CLASSES,
  type AccessCommitmentKind,
} from './taxonomy.ts';
import type { AccessChainFailure, AccessReferenceSet, AccessTargetReference } from './types.ts';

/**
 * Actor authorization for an access commitment.
 *
 * The actor must exist in the identity/actor registry, must not be revoked,
 * and must hold the capability reference the commitment kind requires. This is
 * registry authority only. An access commitment never receives, verifies, or
 * issues an Execution Authority.
 */
export function validateActorCapability(
  actors: AccessActorRegistryPort,
  actorRef: string,
  kind: AccessCommitmentKind,
): AccessChainFailure | null {
  const actor = actors.resolveActor(actorRef);
  if (!actor) {
    return { code: 'ACCESS_ACTOR_UNKNOWN', message: `actor ${actorRef} is not registered` };
  }
  if (actor.revocationState === 'REVOKED') {
    return { code: 'ACCESS_ACTOR_REVOKED', message: `actor ${actorRef} is revoked` };
  }
  const required = ACCESS_CAPABILITY_FOR_KIND[kind];
  if (!actor.capabilityRefs.includes(required)) {
    return {
      code: 'ACCESS_CAPABILITY_MISSING',
      message: `actor ${actorRef} does not hold ${required}`,
    };
  }
  return null;
}

/**
 * Only a rights authority for the productive object may create or revoke a
 * right over it. Holding the capability reference alone is not enough: an
 * issuer must also be recognised for that specific object.
 */
export function validateRightsAuthority(
  actors: AccessActorRegistryPort,
  actorRef: string,
  productiveObjectId: string,
): AccessChainFailure | null {
  if (!actors.isRightsAuthorityFor(actorRef, productiveObjectId)) {
    return {
      code: 'ACCESS_ISSUER_UNAUTHORIZED',
      message: `actor ${actorRef} is not a rights authority for ${productiveObjectId}`,
    };
  }
  return null;
}

/**
 * The access right must point at a real, active productive object and must be
 * denominated in that object's own unit schema.
 */
export function validateProductiveTarget(
  objects: AccessProductiveObjectPort,
  target: AccessTargetReference,
  blockHeight: number,
  blockTimeUnixSeconds: bigint,
): AccessChainFailure | null {
  const object = objects.lookup(target.productiveObjectId);
  if (!object) {
    return {
      code: 'ACCESS_TARGET_UNKNOWN',
      message: `productive object ${target.productiveObjectId} is not registered`,
    };
  }
  if (!objectIsActive(object, blockHeight, blockTimeUnixSeconds)) {
    return {
      code: 'ACCESS_TARGET_INACTIVE',
      message: `productive object ${target.productiveObjectId} is not active`,
    };
  }
  if (object.unitSchema !== target.capacityUnit) {
    return {
      code: 'ACCESS_TARGET_UNIT_MISMATCH',
      message: `productive object ${target.productiveObjectId} measures ${object.unitSchema}, not ${target.capacityUnit}`,
    };
  }
  if (target.capacityQuantity <= 0n) {
    return {
      code: 'ACCESS_TARGET_QUANTITY_INVALID',
      message: 'capacity must be a positive integer quantity',
    };
  }
  return null;
}

/**
 * Ownership boundary. An access right may permit use, occupancy, lease, or
 * reservation of capacity. It may never carry a title-bearing class or a
 * title-conveying operation, so no access commitment can move ownership.
 */
export function validateAccessRightClass(
  rightClass: string,
  permittedOperations: readonly string[],
): AccessChainFailure | null {
  if ((OWNERSHIP_RIGHT_CLASSES as readonly string[]).includes(rightClass)) {
    return {
      code: 'ACCESS_OWNERSHIP_RIGHT_REFUSED',
      message: `${rightClass} is an ownership right and is owned by the productive registry, not the Access Fabric`,
    };
  }
  if (!(ACCESS_RIGHT_CLASSES as readonly string[]).includes(rightClass)) {
    return {
      code: 'ACCESS_RIGHT_CLASS_INVALID',
      message: `${rightClass} is not an access right class`,
    };
  }
  for (const operation of permittedOperations) {
    if ((OWNERSHIP_CONVEYING_OPERATIONS as readonly string[]).includes(operation.toUpperCase())) {
      return {
        code: 'ACCESS_OWNERSHIP_OPERATION_REFUSED',
        message: `operation ${operation} would convey ownership or issue an asset`,
      };
    }
  }
  return null;
}

export function validateReferences(
  references: AccessReferenceSet,
  jurisdictionCell: string,
): AccessChainFailure | null {
  if (jurisdictionCell.length === 0) {
    return { code: 'ACCESS_JURISDICTION_REQUIRED', message: 'jurisdiction cell is required' };
  }
  if (references.policyRef.length === 0) {
    return { code: 'ACCESS_POLICY_REFERENCE_REQUIRED', message: 'policy reference is required' };
  }
  if (references.consentRef.length === 0) {
    return { code: 'ACCESS_CONSENT_REFERENCE_REQUIRED', message: 'consent reference is required' };
  }
  return null;
}
