import { err, ok, type Result } from '../../domain/src/result.ts';
import {
  isVerifiedActorContext,
  type VerifiedActorContext,
} from '../../identity/src/actor-context.ts';
import type { IdentityCapability } from '../../identity/src/capability.ts';

export type RegulatoryAccessFailure = {
  readonly code:
    | 'ACTOR_CONTEXT_REQUIRED'
    | 'CAPABILITY_DENIED'
    | 'CUSTOMER_SCENARIO_DENIED'
    | 'AI_CANNOT_SET_LEGAL_STATUS';
  readonly message: string;
};

function hasCapability(actor: VerifiedActorContext, capability: IdentityCapability): boolean {
  return actor.authorizedCapabilities.includes(capability);
}

function authorize(
  actor: unknown,
  capability: IdentityCapability,
  message: string,
): Result<VerifiedActorContext, RegulatoryAccessFailure> {
  if (!isVerifiedActorContext(actor)) {
    return err({
      code: 'ACTOR_CONTEXT_REQUIRED',
      message: 'Regulatory Digital Twin requires a verified ActorContext',
    });
  }
  if (!hasCapability(actor, capability) && !hasCapability(actor, 'OPERATE_REGULATORY_TWIN')) {
    return err({
      code: 'CAPABILITY_DENIED',
      message,
    });
  }
  return ok(actor);
}

export function authorizeViewTwin(
  actor: unknown,
): Result<VerifiedActorContext, RegulatoryAccessFailure> {
  return authorize(actor, 'VIEW_REGULATORY_TWIN', 'VIEW_REGULATORY_TWIN is required');
}

export function authorizeOperateTwin(
  actor: unknown,
): Result<VerifiedActorContext, RegulatoryAccessFailure> {
  return authorize(
    actor,
    'OPERATE_REGULATORY_TWIN',
    'OPERATE_REGULATORY_TWIN is required for candidate edits and dispositions',
  );
}

export function authorizeHistoricalCustomerScenario(
  actor: unknown,
): Result<VerifiedActorContext, RegulatoryAccessFailure> {
  if (!isVerifiedActorContext(actor)) {
    return err({
      code: 'ACTOR_CONTEXT_REQUIRED',
      message: 'historical customer scenarios require a verified ActorContext',
    });
  }
  if (!hasCapability(actor, 'RUN_HISTORICAL_CUSTOMER_SCENARIO')) {
    return err({
      code: 'CUSTOMER_SCENARIO_DENIED',
      message: 'RUN_HISTORICAL_CUSTOMER_SCENARIO is required to access actual-customer snapshots',
    });
  }
  return ok(actor);
}

export function refuseAiLegalStatus(actorKind: 'HUMAN_OPERATOR' | 'AGENT' | 'AI'): Result<true, RegulatoryAccessFailure> {
  if (actorKind !== 'HUMAN_OPERATOR') {
    return err({
      code: 'AI_CANNOT_SET_LEGAL_STATUS',
      message: 'AI cannot mark counsel confirmation or activate policy',
    });
  }
  return ok(true);
}
