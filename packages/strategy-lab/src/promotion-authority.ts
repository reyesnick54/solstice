import { err, ok, type Result } from '../../domain/src/result.ts';
import { isVerifiedActorContext, type VerifiedActorContext } from '../../identity/src/actor-context.ts';
import type { AuthoritativePromotionKind, PromotionDecisionKind } from './promotion-state.ts';
import type { StrategyFailure } from './types.ts';

export type PromotionActorKind =
  | 'QUALIFICATION_SERVICE'
  | 'HUMAN_GOVERNANCE'
  | 'MODEL'
  | 'MESH'
  | 'STRATEGY'
  | 'DRAFT';

const SELF_PROMOTION_PREFIXES = ['mesh_', 'mdl_', 'str_', 'draft_'] as const;

export function classifyPromotionActor(actorId: string): PromotionActorKind {
  if (actorId.startsWith('mesh_')) return 'MESH';
  if (actorId.startsWith('mdl_')) return 'MODEL';
  if (actorId.startsWith('str_')) return 'STRATEGY';
  if (actorId.startsWith('draft_')) return 'DRAFT';
  if (actorId.startsWith('qlsvc_')) return 'QUALIFICATION_SERVICE';
  return 'HUMAN_GOVERNANCE';
}

export function canEmitPromotionDecision(input: {
  readonly actorId: string;
  readonly decisionKind: PromotionDecisionKind;
}): Result<true, StrategyFailure> {
  if ((['PROMOTION_RECOMMENDED'] as readonly string[]).includes(input.decisionKind)) {
    return ok(true);
  }
  const kind = classifyPromotionActor(input.actorId);
  if (kind === 'MESH' || kind === 'MODEL' || kind === 'STRATEGY' || kind === 'DRAFT') {
    return err({
      code: 'SELF_PROMOTION_FORBIDDEN',
      message: `${kind} cannot emit authoritative promotion decision ${input.decisionKind}`,
    });
  }
  if (
    (['PROMOTED_TO_SHADOW', 'PROMOTED_TO_PAPER', 'DEMOTED'] as readonly string[]).includes(
      input.decisionKind,
    ) &&
    kind !== 'QUALIFICATION_SERVICE' &&
    kind !== 'HUMAN_GOVERNANCE'
  ) {
    return err({
      code: 'HUMAN_OPERATOR_REQUIRED',
      message: `authoritative promotion ${input.decisionKind} requires qualification service or human governance`,
    });
  }
  return ok(true);
}

export function assertAuthoritativePromotion(input: {
  readonly actor: unknown;
  readonly decisionKind: AuthoritativePromotionKind;
  readonly reason: string;
}): Result<{ readonly actorId: string; readonly actorKind: PromotionActorKind }, StrategyFailure> {
  if (!isVerifiedActorContext(input.actor)) {
    return err({
      code: 'HUMAN_OPERATOR_REQUIRED',
      message: 'authoritative promotion requires verified actor context',
    });
  }
  const context = input.actor as VerifiedActorContext;
  if (SELF_PROMOTION_PREFIXES.some((prefix) => context.actorId.startsWith(prefix))) {
    return err({
      code: 'SELF_PROMOTION_FORBIDDEN',
      message: 'mesh, model, strategy, and draft actors cannot execute promotion authority',
    });
  }
  const allowed = canEmitPromotionDecision({
    actorId: context.actorId,
    decisionKind: input.decisionKind,
  });
  if (!allowed.ok) {
    return allowed;
  }
  if (input.reason.trim().length === 0) {
    return err({
      code: 'HUMAN_OPERATOR_REQUIRED',
      message: 'promotion requires an explicit reason',
    });
  }
  return ok({
    actorId: context.actorId,
    actorKind: classifyPromotionActor(context.actorId),
  });
}

export function recordPromotionRecommendation(input: {
  readonly actorId: string;
  readonly target: 'SHADOW' | 'PAPER';
  readonly reason: string;
}): Result<true, StrategyFailure> {
  const kind = classifyPromotionActor(input.actorId);
  if (kind === 'STRATEGY' || kind === 'DRAFT') {
    return err({
      code: 'SELF_PROMOTION_FORBIDDEN',
      message: 'strategy and draft cannot recommend their own promotion as authority',
    });
  }
  return ok(true);
}
