import { err, ok, type Result } from '../../domain/src/result.ts';
import { isVerifiedActorContext } from '../../identity/src/actor-context.ts';
import type { CleanRoomFailure, JobOutcome } from './types.ts';
import type { CleanRoomService } from './service.ts';

/**
 * Subject-scoped derived results only. The Personal Economy Agent cannot
 * query multi-user research datasets or access Clean Room storage.
 */
export class SubjectScopedCleanRoomTool {
  private readonly cleanRoom: CleanRoomService;

  constructor(cleanRoom: CleanRoomService) {
    this.cleanRoom = cleanRoom;
  }

  requestOwnAggregate(
    actor: unknown,
    input: { readonly subjectId: string; readonly sessionId: string; readonly templateRef: string },
  ): Result<JobOutcome, CleanRoomFailure> {
    if (!isVerifiedActorContext(actor)) {
      return err({ code: 'ACTOR_CONTEXT_REQUIRED', message: 'agent tool requires a verified ActorContext' });
    }
    if (actor.subjectId !== input.subjectId) {
      return err({ code: 'CROSS_SUBJECT_DENIED', message: 'the agent may not query another subject Clean Room cohort' });
    }
    return this.cleanRoom.submitAndExecute(actor, input.sessionId, input.templateRef);
  }

  requestMultiUserResearch(): Result<never, CleanRoomFailure> {
    return err({
      code: 'CROSS_SUBJECT_DENIED',
      message: 'the Personal Economy Agent cannot query multi-user research datasets',
    });
  }
}

export function assertNoCoinIssuance(outcome: JobOutcome): Result<true, CleanRoomFailure> {
  if (outcome.contributions.some((row) => row.coinIssued || row.marketPriceAssigned || row.settledEarnings)) {
    return err({ code: 'NO_SUNREY_COIN_ISSUANCE', message: 'Clean Room must not issue SunRey Coin or assign a market price' });
  }
  return ok(true);
}
