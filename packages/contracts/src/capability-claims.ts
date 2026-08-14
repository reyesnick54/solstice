import type { Money } from './money.ts';
import type { ProductAccountClass, RiskCeiling } from './account-class.ts';
import type { AgentId, CustomerId, TokenId } from './ids.ts';
import type { DataCategory, ForbiddenAction, ProposalActionType } from './proposal-types.ts';
import type { UtcInstant } from './time.ts';

/**
 * Public claims an agent may read. This is NOT the signed token and
 * cannot be used to construct an ExecutionAuthority.
 *
 * Enforcement of these claims happens in the control-plane ProposalGate
 * against the signed AgentCapabilityToken, not against this view.
 */
export type CapabilityTokenClaims = {
  readonly tokenId: TokenId;
  readonly agentId: AgentId;
  readonly customerId: CustomerId;
  readonly allowedProposalTypes: readonly ProposalActionType[];
  readonly forbiddenActions: readonly ForbiddenAction[];
  readonly perTransactionLimit: Money;
  readonly dailyLimit: Money;
  readonly allowedAccountClasses: readonly ProductAccountClass[];
  readonly forbiddenDataCategories: readonly DataCategory[];
  readonly maxRisk: RiskCeiling;
  readonly issuedAt: UtcInstant;
  readonly expiresAt: UtcInstant;
  readonly revokedAt: UtcInstant | null;
};

export function tokenIsRevoked(claims: CapabilityTokenClaims): boolean {
  return claims.revokedAt !== null;
}

export function tokenIsExpired(claims: CapabilityTokenClaims, now: UtcInstant): boolean {
  return Date.parse(now) >= Date.parse(claims.expiresAt);
}
