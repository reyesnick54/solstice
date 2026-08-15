import { err, ok, type Result } from '../../../domain/src/result.ts';
import {
  isVerifiedActorContext,
  type VerifiedActorContext,
} from '../../../identity/src/actor-context.ts';
import type { IdentityCapability } from '../../../identity/src/capability.ts';

export type PeveAccessFailure = {
  readonly code: 'ACTOR_CONTEXT_REQUIRED' | 'CAPABILITY_DENIED' | 'SUBJECT_MISMATCH';
  readonly message: string;
};

function hasCapability(actor: VerifiedActorContext, capability: IdentityCapability): boolean {
  return actor.authorizedCapabilities.includes(capability);
}

function subjectAllowed(actor: VerifiedActorContext, subjectId: string): boolean {
  return actor.subjectId === subjectId || hasCapability(actor, 'OPERATE_GROWTH_ORCHESTRATOR');
}

function authorize(
  actor: unknown,
  subjectId: string,
  capability: IdentityCapability,
): Result<VerifiedActorContext, PeveAccessFailure> {
  if (!isVerifiedActorContext(actor)) {
    return err({
      code: 'ACTOR_CONTEXT_REQUIRED',
      message: 'PEVE requires a verified ActorContext',
    });
  }
  if (!hasCapability(actor, capability) && !hasCapability(actor, 'OPERATE_GROWTH_ORCHESTRATOR')) {
    return err({
      code: 'CAPABILITY_DENIED',
      message: `${capability} is required`,
    });
  }
  if (!subjectAllowed(actor, subjectId)) {
    return err({
      code: 'SUBJECT_MISMATCH',
      message: 'actor is not the subject and lacks OPERATE_GROWTH_ORCHESTRATOR',
    });
  }
  return ok(actor);
}

export function authorizeViewEconomicValue(
  actor: unknown,
  subjectId: string,
): Result<VerifiedActorContext, PeveAccessFailure> {
  return authorize(actor, subjectId, 'VIEW_ECONOMIC_VALUE');
}

export function authorizeRecordAttribution(
  actor: unknown,
  subjectId: string,
): Result<VerifiedActorContext, PeveAccessFailure> {
  return authorize(actor, subjectId, 'VIEW_ECONOMIC_VALUE');
}
