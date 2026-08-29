import { err, ok, type Result } from '../../domain/src/result.ts';
import {
  accessFabricRefusesAuthorityIssuance,
  accessFabricDoesNotMint,
  accessFabricDoesNotSettle,
  validateAccessIntentInput,
  validateAccessRightInput,
} from './invariants.ts';
import type { AccessRegistryIntentId, AccessRegistryRightId } from './registry-ids.ts';
import type {
  AccessFabricFailure,
  AccessFabricPort,
  AccessFabricSnapshot,
  AccessFabricIntent,
  AccessFabricRight,
  ProposeAccessIntentInput,
  RegisterAccessRightInput,
} from './registry-types.ts';

/**
 * SunRey Access Fabric — ACCESS-01 foundation.
 *
 * Orchestrates access-domain records for governed, non-ownership
 * economic rights over productive capacity. This owner does not mint,
 * settle, post journals, issue Execution Authority, or replace the
 * Compliance Kernel, Exchange, Ledger, custody, oracle consensus,
 * identity truth, or legal eligibility truth.
 */
export class AccessFabric implements AccessFabricPort {
  private readonly rights = new Map<AccessRegistryRightId, AccessFabricRight>();
  private readonly intents = new Map<AccessRegistryIntentId, AccessFabricIntent>();

  proposeIntent(input: ProposeAccessIntentInput): Result<AccessFabricIntent, AccessFabricFailure> {
    accessFabricDoesNotMint();
    accessFabricDoesNotSettle();
    accessFabricRefusesAuthorityIssuance();

    const validated = validateAccessIntentInput(input);
    if (!validated.ok) {
      return validated;
    }
    if (this.intents.has(input.id)) {
      return err(Object.freeze({ code: 'STATE_CONFLICT', message: `Access intent already exists: ${input.id}` }));
    }

    const intent: AccessFabricIntent = Object.freeze({
      id: input.id,
      kind: input.kind,
      subjectRef: input.subjectRef,
      capacityRef: input.capacityRef,
      category: input.category,
      bounds: Object.freeze([...input.bounds]),
      purposeRef: input.purposeRef,
      pegContextRef: input.pegContextRef ?? null,
      proposedAt: input.proposedAt,
      isActionIntent: false,
      isExecutionAuthority: false,
    });
    this.intents.set(intent.id, intent);
    return ok(intent);
  }

  registerRight(input: RegisterAccessRightInput): Result<AccessFabricRight, AccessFabricFailure> {
    accessFabricDoesNotMint();
    accessFabricDoesNotSettle();
    accessFabricRefusesAuthorityIssuance();

    const validated = validateAccessRightInput(input);
    if (!validated.ok) {
      return validated;
    }
    if (this.rights.has(input.id)) {
      return err(Object.freeze({ code: 'STATE_CONFLICT', message: `Access right already exists: ${input.id}` }));
    }

    const right: AccessFabricRight = Object.freeze({
      id: input.id,
      subjectRef: input.subjectRef,
      capacityRef: input.capacityRef,
      category: input.category,
      bounds: Object.freeze([...input.bounds]),
      state: input.state ?? 'PROPOSED',
      isOwnership: false,
      isMoney: false,
      isSecurity: false,
      grantsMint: false,
      impliesSettlement: false,
      valuesHuman: false,
      createsCapacity: false,
      overridesLegalRights: false,
      bypassesPolicy: false,
      reservationRef: input.reservationRef ?? null,
      deliveryEvidenceRef: input.deliveryEvidenceRef ?? null,
      createdAt: input.createdAt,
      updatedAt: input.updatedAt,
    });
    this.rights.set(right.id, right);
    return ok(right);
  }

  getRight(id: AccessRegistryRightId): AccessFabricRight | null {
    return this.rights.get(id) ?? null;
  }

  getIntent(id: AccessRegistryIntentId): AccessFabricIntent | null {
    return this.intents.get(id) ?? null;
  }

  snapshot(): AccessFabricSnapshot {
    return Object.freeze({
      rights: Object.freeze([...this.rights.values()]),
      intents: Object.freeze([...this.intents.values()]),
    });
  }
}
