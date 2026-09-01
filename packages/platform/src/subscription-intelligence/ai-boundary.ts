import type { SubscriptionActionProposal } from './models.ts';

export type AiBoundaryViolation = {
  readonly code: 'AI_CANNOT_EXECUTE';
  readonly message: string;
};

/**
 * AI may classify, summarize, explain, rank, and propose.
 * AI may NOT cancel, dispute, modify accounts, negotiate, or move funds.
 */
export function assertAiCannotExecute(actorKind: string): AiBoundaryViolation | null {
  if (actorKind === 'AGENT' || actorKind === 'AI' || actorKind === 'SYSTEM') {
    return Object.freeze({
      code: 'AI_CANNOT_EXECUTE',
      message: 'AI cannot directly execute subscription actions; user authorization is required',
    });
  }
  return null;
}

export function aiMayProposeOnly(): true {
  return true;
}

export function rejectAiDirectExecution(
  actorKind: string,
  action: SubscriptionActionProposal,
): AiBoundaryViolation | null {
  const violation = assertAiCannotExecute(actorKind);
  if (violation && action.state !== 'PROPOSED') {
    return violation;
  }
  return violation;
}
