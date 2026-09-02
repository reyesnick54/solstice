import type { UtcInstant } from '../../../domain/src/time.ts';
import {
  actorMayHoldAdminAuthority,
  actorMayHoldGovernanceAuthority,
  actorMayHoldValidatorAuthority,
} from './actor-types.ts';
import { evaluateDelegation } from './delegation.ts';
import type {
  AuthorizationCheck,
  AuthorizationDecision,
  FineGrainedAuthorization,
} from './interface.ts';
import {
  findCanonicalRelationship,
  tupleKey,
  verbPermittedForRelationship,
  type RelationshipTuple,
} from './relationship-model.ts';

/**
 * In-memory relationship engine for simulation and tests.
 * Tuple semantics match OpenFGA relationship tuples for later adapter swap.
 */
export class SimulationRelationshipEngine implements FineGrainedAuthorization {
  readonly engineKind = 'SIMULATION' as const;
  readonly #tuples = new Set<string>();

  check(input: AuthorizationCheck): AuthorizationDecision {
    const { subject, relation, resource, permission } = input;

    const canonical = findCanonicalRelationship(subject.actorType, relation, resource.type);
    if (!canonical) {
      return deny('ACTOR_TYPE_MISMATCH', `no canonical relationship for ${subject.actorType}#${relation}@${resource.type}`);
    }

    if (subject.actorType !== canonical.subjectType) {
      return deny('ACTOR_TYPE_MISMATCH', `actor type '${subject.actorType}' cannot hold relation '${relation}' on '${resource.type}'`);
    }

    if (!verbPermittedForRelationship(subject.actorType, relation, resource.type, permission)) {
      return deny('VERB_NOT_PERMITTED', `verb '${permission}' not permitted for ${relation} on ${resource.type}`);
    }

    const tuple: RelationshipTuple = Object.freeze({
      subjectType: subject.actorType,
      subjectId: subject.actorId,
      relation,
      objectType: resource.type,
      objectId: resource.id,
    });

    if (subject.actorType === 'AI_AGENT') {
      if (!input.delegation) {
        return deny('DELEGATION_REQUIRED', 'agent action requires explicit delegation');
      }
      const delegationResult = evaluateDelegation({
        delegation: input.delegation,
        requestedVerb: permission,
        resourceType: resource.type,
        resourceId: resource.id,
        now: input.now,
      });
      if (!delegationResult.allowed) {
        return deny('DELEGATION_DENIED', delegationResult.reason);
      }
    }

    if (permission === 'authorize' && relation === 'MAY_AUTHORIZE') {
      if (!actorMayHoldGovernanceAuthority(subject.actorType)) {
        return deny('GOVERNANCE_AUTHORITY_REQUIRED', 'monetary authorization requires HUMAN_GOVERNANCE actor');
      }
    }

    if (permission === 'validate') {
      if (!actorMayHoldValidatorAuthority(subject.actorType)) {
        return deny('VALIDATOR_AUTHORITY_REQUIRED', 'block validation requires VALIDATOR actor');
      }
    }

    if (permission === 'manage' && resource.type === 'DOMAIN') {
      if (!actorMayHoldAdminAuthority(subject.actorType)) {
        return deny('ADMIN_AUTHORITY_REQUIRED', 'domain management requires ADMINISTRATOR or AUDITOR actor');
      }
    }

    if (permission === 'withdraw' && subject.actorType === 'AI_AGENT') {
      return deny('MONETARY_BYPASS_FORBIDDEN', 'agents cannot withdraw regardless of relationship');
    }

    if (!this.#tuples.has(tupleKey(tuple))) {
      if (subject.actorType === 'AI_AGENT' && relation === 'ACTS_FOR' && resource.type === 'USER') {
        return deny('RELATIONSHIP_MISSING', `agent '${subject.actorId}' does not ACTS_FOR user '${resource.id}'`);
      }
      return deny('RELATIONSHIP_MISSING', `missing tuple ${tupleKey(tuple)}`);
    }

    return allow(tuple);
  }

  writeTuple(tuple: RelationshipTuple): void {
    this.#tuples.add(tupleKey(tuple));
  }

  deleteTuple(tuple: RelationshipTuple): void {
    this.#tuples.delete(tupleKey(tuple));
  }

  hasTuple(tuple: RelationshipTuple): boolean {
    return this.#tuples.has(tupleKey(tuple));
  }

  listTuplesForSubject(subjectId: string): readonly RelationshipTuple[] {
    const results: RelationshipTuple[] = [];
    for (const key of this.#tuples) {
      const parts = key.match(/^([^:]+):([^#]+)#([^@]+)@([^:]+):(.+)$/);
      if (parts && parts[2] === subjectId) {
        results.push(
          Object.freeze({
            subjectType: parts[1] as RelationshipTuple['subjectType'],
            subjectId: parts[2]!,
            relation: parts[3] as RelationshipTuple['relation'],
            objectType: parts[4] as RelationshipTuple['objectType'],
            objectId: parts[5]!,
          }),
        );
      }
    }
    return Object.freeze(results);
  }
}

export function createSimulationRelationshipEngine(): SimulationRelationshipEngine {
  return new SimulationRelationshipEngine();
}

function allow(tuple: RelationshipTuple): AuthorizationDecision {
  return Object.freeze({
    allowed: true,
    code: 'ALLOWED',
    reason: `relationship ${tupleKey(tuple)} permits action`,
    tuple,
  });
}

function deny(code: AuthorizationDecision['code'], reason: string): AuthorizationDecision {
  return Object.freeze({
    allowed: false,
    code,
    reason,
    tuple: null,
  });
}

export function assertOwnResource(
  engine: FineGrainedAuthorization,
  userId: string,
  resourceType: RelationshipTuple['objectType'],
  resourceId: string,
  now: UtcInstant,
): AuthorizationDecision {
  return engine.check({
    subject: {
      actorType: 'HUMAN_USER',
      actorId: userId,
      authenticationIdentityId: userId,
      economicIdentityId: null,
    },
    relation: resourceType === 'WALLET' ? 'CONTROLS' : 'GRANTED',
    resource: { type: resourceType, id: resourceId },
    permission: 'read',
    purpose: null,
    delegation: null,
    now,
  });
}
