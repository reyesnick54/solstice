import { err, ok, type Result } from '../../domain/src/result.ts';
import type { UtcInstant } from '../../domain/src/time.ts';
import { isVerifiedActorContext, type VerifiedActorContext } from '../../identity/src/actor-context.ts';
import type { ModelRegistry } from '../../model-registry/src/registry.ts';
import { asStrategyPromotionReviewId, type StrategyPromotionReviewId } from './ids.ts';
import type { StrategyValidationReport } from './validation.ts';
import type { StrategyFailure, StrategyLifecycleState } from './types.ts';

export type PromotionTarget = 'SHADOW_APPROVED' | 'PAPER_APPROVED';

export type StrategyPromotionReview = {
  readonly reviewId: StrategyPromotionReviewId;
  readonly strategyId: string;
  readonly strategyVersion: string;
  readonly target: PromotionTarget;
  readonly actorId: string;
  readonly subjectId: string;
  readonly sessionId: string;
  readonly actorKind: 'HUMAN_OPERATOR';
  readonly reason: string;
  readonly decidedAt: UtcInstant;
  readonly accepted: boolean;
};

export function paperEligibility(input: {
  readonly lifecycle: StrategyLifecycleState;
  readonly compiled: boolean;
  readonly datasetVersioned: boolean;
  readonly outOfSample: boolean;
  readonly riskPassed: boolean;
  readonly stressEvaluated: boolean;
  readonly invariantOk: boolean;
  readonly modelsApproved: boolean;
  readonly humanReview: boolean;
  readonly rdtAcceptableForPaper: boolean;
}): Result<true, StrategyFailure> {
  const missing: string[] = [];
  if (input.lifecycle !== 'SHADOW_COMPLETED' && input.lifecycle !== 'PAPER_APPROVED') {
    missing.push('shadow-completed lifecycle');
  }
  if (!input.compiled) missing.push('compiled strategy');
  if (!input.datasetVersioned) missing.push('valid dataset');
  if (!input.outOfSample) missing.push('out-of-sample evaluation');
  if (!input.riskPassed) missing.push('Risk pass');
  if (!input.stressEvaluated) missing.push('stress evaluation');
  if (!input.invariantOk) missing.push('architecture/invariant');
  if (!input.modelsApproved) missing.push('approved simulation models');
  if (!input.humanReview) missing.push('human review');
  if (!input.rdtAcceptableForPaper) missing.push('RDT state acceptable for paper simulation');
  if (missing.length > 0) {
    return err({
      code: 'PROMOTION_GATE_FAILED',
      message: `PAPER eligibility failed: ${missing.join(', ')}. AI cannot waive failed requirements.`,
    });
  }
  return ok(true);
}

export function recordHumanPromotion(input: {
  readonly actor: unknown;
  readonly strategyId: string;
  readonly strategyVersion: string;
  readonly target: PromotionTarget;
  readonly reason: string;
  readonly now: UtcInstant;
  readonly report?: StrategyValidationReport;
  readonly meshActor?: boolean;
  readonly modelActor?: boolean;
  readonly strategyActor?: boolean;
}): Result<StrategyPromotionReview, StrategyFailure> {
  if (input.meshActor || input.modelActor || input.strategyActor) {
    return err({
      code: 'SELF_PROMOTION_FORBIDDEN',
      message: 'Mesh, models, and strategies cannot self-promote',
    });
  }
  if (!isVerifiedActorContext(input.actor)) {
    return err({
      code: 'HUMAN_OPERATOR_REQUIRED',
      message: 'promotion to SHADOW_APPROVED or PAPER_APPROVED requires a verified ActorContext',
    });
  }
  const context = input.actor as VerifiedActorContext;
  if (
    context.actorId.startsWith('mesh_') ||
    context.actorId.startsWith('mdl_') ||
    context.actorId.startsWith('str_')
  ) {
    return err({
      code: 'SELF_PROMOTION_FORBIDDEN',
      message: 'Mesh, models, and strategies cannot self-promote',
    });
  }
  if (input.reason.trim().length === 0) {
    return err({
      code: 'HUMAN_OPERATOR_REQUIRED',
      message: 'promotion requires an explicit human reason',
    });
  }
  return ok(
    Object.freeze({
      reviewId: asStrategyPromotionReviewId(`spr_${context.sessionId.slice(0, 8)}_${input.target === 'PAPER_APPROVED' ? 'paper' : 'shadow'}`),
      strategyId: input.strategyId,
      strategyVersion: input.strategyVersion,
      target: input.target,
      actorId: context.actorId,
      subjectId: context.subjectId,
      sessionId: context.sessionId,
      actorKind: 'HUMAN_OPERATOR',
      reason: input.reason,
      decidedAt: input.now,
      accepted: true,
    }),
  );
}

export function modelsApprovedForPromotion(
  registry: ModelRegistry,
  refs: readonly { readonly modelId: string; readonly version: string }[],
): boolean {
  return refs.every((ref) => {
    const model = registry.get(ref.modelId as never, ref.version as never);
    return model?.lifecycle === 'APPROVED_FOR_SIMULATION';
  });
}
