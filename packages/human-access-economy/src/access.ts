import { err, ok, type Result } from '../../domain/src/result.ts';
import type { AccessFailure } from './types.ts';

export type AccessActor = {
  readonly actorId: string;
  readonly customerId: string;
  readonly verified: boolean;
  readonly restricted: boolean;
};

export function authorizeAccessView(
  actor: AccessActor,
  customerId: string,
): Result<AccessActor, AccessFailure> {
  if (actor.restricted) {
    return err({
      code: 'CAPABILITY_DENIED',
      message: 'access economy is unavailable for restricted customers',
    });
  }
  if (!actor.verified) {
    return err({
      code: 'CAPABILITY_DENIED',
      message: 'verification must complete before access economy is available',
    });
  }
  if (actor.customerId !== customerId) {
    return err({
      code: 'SUBJECT_MISMATCH',
      message: 'customer may only view their own access economy resources',
    });
  }
  return ok(actor);
}

export function authorizeAccessMutate(
  actor: AccessActor,
  customerId: string,
): Result<AccessActor, AccessFailure> {
  const view = authorizeAccessView(actor, customerId);
  if (!view.ok) {
    return view;
  }
  return ok(actor);
}
