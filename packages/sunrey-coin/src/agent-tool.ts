import { err, ok, type Result } from '../../domain/src/result.ts';
import { isVerifiedActorContext } from '../../identity/src/actor-context.ts';
import { GROWTH_CLASSIFICATION, SUNREY_COIN_DISPLAY_NAME } from './taxonomy.ts';
import type { SunReyCoinFailure, SunReyCoinPosition } from './types.ts';
import type { SunReyCoinService } from './service.ts';

/**
 * Read-only subject-scoped explanations. The Personal Economy Agent cannot
 * mint, burn, transfer, approve, change the formula, or issue Execution Authority.
 */
export class SubjectScopedSunReyCoinTool {
  private readonly coin: SunReyCoinService;

  constructor(coin: SunReyCoinService) {
    this.coin = coin;
  }

  explainPosition(
    actor: unknown,
    subjectId: string,
  ): Result<{ readonly position: SunReyCoinPosition; readonly marketPrice: 'UNAVAILABLE' }, SunReyCoinFailure> {
    if (!isVerifiedActorContext(actor)) {
      return err({ code: 'ACTOR_CONTEXT_REQUIRED', message: 'agent tool requires a verified ActorContext' });
    }
    if (actor.subjectId !== subjectId) {
      return err({ code: 'CROSS_SUBJECT_DENIED', message: 'the agent may not read another subject coin position' });
    }
    return ok({ position: this.coin.position(subjectId), marketPrice: 'UNAVAILABLE' });
  }

  explainEligibility(actor: unknown, subjectId: string): Result<string, SunReyCoinFailure> {
    if (!isVerifiedActorContext(actor) || actor.subjectId !== subjectId) {
      return err({ code: 'CROSS_SUBJECT_DENIED', message: 'eligibility explanation is subject-scoped' });
    }
    const vector = this.coin.listVectors().find((row) => row.subjectId === subjectId);
    if (!vector) {
      return ok('no authorized contribution has been evaluated for this subject');
    }
    return ok(
      `${SUNREY_COIN_DISPLAY_NAME} eligibility is ${vector.eligibility} under ${vector.formulaVersion}. This is not a market price and not a measure of human worth.`,
    );
  }

  explainNoMarketPrice(): Result<string, SunReyCoinFailure> {
    return ok(
      `${SUNREY_COIN_DISPLAY_NAME} has no public ticker. Market price is ${GROWTH_CLASSIFICATION.marketPrice}. ${GROWTH_CLASSIFICATION.returnGuarantee}.`,
    );
  }

  issue(): Result<never, SunReyCoinFailure> {
    return err({ code: 'AGENT_CANNOT_EXECUTE', message: 'the Personal Economy Agent cannot issue SunRey Coin' });
  }

  transfer(): Result<never, SunReyCoinFailure> {
    return err({ code: 'AGENT_CANNOT_EXECUTE', message: 'the Personal Economy Agent cannot transfer SunRey Coin' });
  }

  burn(): Result<never, SunReyCoinFailure> {
    return err({ code: 'AGENT_CANNOT_EXECUTE', message: 'the Personal Economy Agent cannot burn SunRey Coin' });
  }
}
