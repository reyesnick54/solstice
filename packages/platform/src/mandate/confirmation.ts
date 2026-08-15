import { createHash } from 'node:crypto';
import type { UtcInstant } from '../../../domain/src/time.ts';
import type { ActorContext } from '../../../identity/src/actor-context.ts';
import { isVerifiedActorContext } from '../../../identity/src/actor-context.ts';
import { assuranceAtLeast } from '../../../identity/src/assurance.ts';
import { confirmationIdFor } from '../ids.ts';
import type { CompiledEconomicMandate, MandateConfirmation } from './types.ts';

export function confirmationHash(input: {
  readonly mandateId: string;
  readonly version: number;
  readonly actorId: string;
  readonly sessionId: string;
  readonly confirmedAt: string;
  readonly contextHash: string;
}): string {
  return createHash('sha256')
    .update(
      [
        input.mandateId,
        String(input.version),
        input.actorId,
        input.sessionId,
        input.confirmedAt,
        input.contextHash,
      ].join('|'),
    )
    .digest('hex');
}

export function isHighImpactMandate(mandate: CompiledEconomicMandate): boolean {
  return mandate.hardConstraints.some(
    (item) => item.kind === 'INVEST_ALL_AVAILABLE_IMMEDIATELY' || item.kind === 'KEEP_ALL_LIQUID',
  );
}

export function requireConfirmableActor(
  actor: ActorContext,
  highImpact: boolean,
): { readonly ok: true } | { readonly ok: false; readonly reason: string } {
  if (!isVerifiedActorContext(actor)) {
    return { ok: false, reason: 'actor_context_unverified' };
  }
  if (highImpact && !assuranceAtLeast(actor.authenticationAssurance, 'STRONG')) {
    return { ok: false, reason: 'step_up_authentication_required' };
  }
  return { ok: true };
}

export function recordMandateConfirmation(input: {
  readonly mandate: CompiledEconomicMandate;
  readonly actor: ActorContext;
  readonly now: UtcInstant;
  readonly highImpact?: boolean;
}): MandateConfirmation | { readonly ok: false; readonly reason: string } {
  const highImpact = input.highImpact ?? isHighImpactMandate(input.mandate);
  const gate = requireConfirmableActor(input.actor, highImpact);
  if (!gate.ok) {
    return gate;
  }
  const contextHash = input.actor.integrity.hex;
  return {
    confirmationId: confirmationIdFor(input.mandate.mandateId, input.mandate.version),
    mandateId: input.mandate.mandateId,
    version: input.mandate.version,
    actorId: input.actor.actorId,
    subjectId: input.actor.subjectId,
    sessionId: input.actor.sessionId,
    authenticationAssurance: input.actor.authenticationAssurance,
    confirmedAt: input.now,
    contextHash,
    confirmationHash: confirmationHash({
      mandateId: input.mandate.mandateId,
      version: input.mandate.version,
      actorId: input.actor.actorId,
      sessionId: input.actor.sessionId,
      confirmedAt: input.now,
      contextHash,
    }),
    highImpact,
    stepUpRequired: highImpact,
    stepUpSatisfied: !highImpact || assuranceAtLeast(input.actor.authenticationAssurance, 'STRONG'),
  };
}
