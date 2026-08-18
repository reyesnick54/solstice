import type { ActorKind, SecurityRiskAcceptance } from './types.ts';

export function createSecurityRiskAcceptance(input: {
  readonly acceptanceId: string;
  readonly findingId: string;
  readonly reason: string;
  readonly impact: string;
  readonly compensatingControls: readonly string[];
  readonly expirationOrReviewDateUtc: string;
  readonly humanSecurityAuthority: string;
  readonly releaseScope: string;
  readonly actor: ActorKind;
}): SecurityRiskAcceptance {
  if (input.actor !== 'HUMAN') {
    throw new Error('AI cannot accept security risk');
  }
  if (!input.humanSecurityAuthority.trim()) {
    throw new Error('SecurityRiskAcceptance requires a human security authority');
  }
  if (!input.reason.trim() || !input.impact.trim() || !input.releaseScope.trim()) {
    throw new Error('SecurityRiskAcceptance requires reason, impact, and release scope');
  }
  if (input.compensatingControls.length === 0) {
    throw new Error('SecurityRiskAcceptance requires compensating controls');
  }
  if (!/^\d{4}-\d{2}-\d{2}/.test(input.expirationOrReviewDateUtc)) {
    throw new Error('SecurityRiskAcceptance requires an expiration or review date');
  }
  return Object.freeze({
    acceptanceId: input.acceptanceId,
    findingId: input.findingId,
    reason: input.reason,
    impact: input.impact,
    compensatingControls: Object.freeze([...input.compensatingControls]),
    expirationOrReviewDateUtc: input.expirationOrReviewDateUtc,
    humanSecurityAuthority: input.humanSecurityAuthority,
    releaseScope: input.releaseScope,
    actor: 'HUMAN',
    aiAccepted: false,
  });
}

export function aiAcceptSecurityRisk(): never {
  throw new Error('AI cannot accept security risk');
}
