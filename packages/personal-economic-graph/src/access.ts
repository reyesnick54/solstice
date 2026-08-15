import { err, ok, type Result } from '../../domain/src/result.ts';
import {
  isVerifiedActorContext,
  type VerifiedActorContext,
} from '../../identity/src/actor-context.ts';
import type { IdentityCapability } from '../../identity/src/capability.ts';

export type GraphAccessFailure = {
  readonly code:
    | 'ACTOR_CONTEXT_REQUIRED'
    | 'CAPABILITY_DENIED'
    | 'SUBJECT_MISMATCH'
    | 'GRAPH_NOT_FOUND';
  readonly message: string;
};

export const GRAPH_READ_CAPABILITY: IdentityCapability = 'VIEW_ECONOMIC_GRAPH';
export const GRAPH_DECLARE_CAPABILITY: IdentityCapability = 'DECLARE_ECONOMIC_FACT';
export const GRAPH_OPERATE_CAPABILITY: IdentityCapability = 'OPERATE_ECONOMIC_GRAPH';

function hasCapability(actor: VerifiedActorContext, capability: IdentityCapability): boolean {
  return actor.authorizedCapabilities.includes(capability);
}

function subjectAllowed(actor: VerifiedActorContext, subjectId: string): boolean {
  return actor.subjectId === subjectId || hasCapability(actor, GRAPH_OPERATE_CAPABILITY);
}

export function authorizeGraphRead(
  actor: unknown,
  subjectId: string,
): Result<VerifiedActorContext, GraphAccessFailure> {
  if (!isVerifiedActorContext(actor)) {
    return err({
      code: 'ACTOR_CONTEXT_REQUIRED',
      message: 'PEG reads require a verified ActorContext; agents do not receive database credentials',
    });
  }
  if (!hasCapability(actor, GRAPH_READ_CAPABILITY)) {
    return err({
      code: 'CAPABILITY_DENIED',
      message: 'VIEW_ECONOMIC_GRAPH is required',
    });
  }
  if (!subjectAllowed(actor, subjectId)) {
    return err({
      code: 'SUBJECT_MISMATCH',
      message: 'actor is not the graph subject and lacks OPERATE_ECONOMIC_GRAPH',
    });
  }
  return ok(actor);
}

export function authorizeGraphDeclare(
  actor: unknown,
  subjectId: string,
): Result<VerifiedActorContext, GraphAccessFailure> {
  const read = authorizeGraphRead(actor, subjectId);
  if (!read.ok) {
    return read;
  }
  if (!hasCapability(read.value, GRAPH_DECLARE_CAPABILITY)) {
    return err({
      code: 'CAPABILITY_DENIED',
      message: 'DECLARE_ECONOMIC_FACT is required',
    });
  }
  return ok(read.value);
}
