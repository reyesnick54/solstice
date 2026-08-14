import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import type { CapabilityTokenClaims } from '../../../contracts/src/capability-claims.ts';
import { tokenIsExpired, tokenIsRevoked } from '../../../contracts/src/capability-claims.ts';
import { Money } from '../../../contracts/src/money.ts';
import type { UtcInstant } from '../../../contracts/src/time.ts';
import type { AgentId, CustomerId, TokenId } from '../../../contracts/src/ids.ts';
import { asTokenId } from '../../../contracts/src/ids.ts';
import type { ProductAccountClass, RiskCeiling } from '../../../contracts/src/account-class.ts';
import type { DataCategory, ForbiddenAction, ProposalActionType } from '../../../contracts/src/proposal-types.ts';

/**
 * Signed Agent Capability Token. Issued and verified in infrastructure.
 * The agent never holds the signing secret and never validates itself.
 */
export type AgentCapabilityToken = CapabilityTokenClaims & {
  readonly signature: string;
};

export type IssueTokenInput = {
  readonly tokenId?: TokenId;
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
};

export class CapabilityTokenIssuer {
  private readonly revoked = new Set<string>();
  readonly #secret: string;

  constructor(secret: string) {
    if (secret.length === 0) {
      throw new Error('CapabilityTokenIssuer requires a non-empty signing secret');
    }
    this.#secret = secret;
  }

  issue(input: IssueTokenInput): AgentCapabilityToken {
    const tokenId = input.tokenId ?? asTokenId(`tok_${randomUUID()}`);
    const claims: CapabilityTokenClaims = Object.freeze({
      tokenId,
      agentId: input.agentId,
      customerId: input.customerId,
      allowedProposalTypes: Object.freeze([...input.allowedProposalTypes]),
      forbiddenActions: Object.freeze([...input.forbiddenActions]),
      perTransactionLimit: input.perTransactionLimit,
      dailyLimit: input.dailyLimit,
      allowedAccountClasses: Object.freeze([...input.allowedAccountClasses]),
      forbiddenDataCategories: Object.freeze([...input.forbiddenDataCategories]),
      maxRisk: input.maxRisk,
      issuedAt: input.issuedAt,
      expiresAt: input.expiresAt,
      revokedAt: null,
    });
    return Object.freeze({
      ...claims,
      signature: this.sign(claims),
    });
  }

  revoke(token: AgentCapabilityToken, revokedAt: UtcInstant): AgentCapabilityToken {
    this.revoked.add(token.tokenId);
    return Object.freeze({
      ...token,
      revokedAt,
      signature: this.sign({ ...token, revokedAt }),
    });
  }

  isRevoked(tokenId: TokenId): boolean {
    return this.revoked.has(tokenId);
  }

  verify(token: AgentCapabilityToken, now: UtcInstant): TokenVerification {
    const expected = this.sign({
      tokenId: token.tokenId,
      agentId: token.agentId,
      customerId: token.customerId,
      allowedProposalTypes: token.allowedProposalTypes,
      forbiddenActions: token.forbiddenActions,
      perTransactionLimit: token.perTransactionLimit,
      dailyLimit: token.dailyLimit,
      allowedAccountClasses: token.allowedAccountClasses,
      forbiddenDataCategories: token.forbiddenDataCategories,
      maxRisk: token.maxRisk,
      issuedAt: token.issuedAt,
      expiresAt: token.expiresAt,
      revokedAt: token.revokedAt,
    });
    if (!safeEqualHex(expected, token.signature)) {
      return { ok: false, code: 'TOKEN_SIGNATURE_INVALID' };
    }
    if (this.revoked.has(token.tokenId) || tokenIsRevoked(token)) {
      return { ok: false, code: 'TOKEN_REVOKED' };
    }
    if (tokenIsExpired(token, now)) {
      return { ok: false, code: 'TOKEN_EXPIRED' };
    }
    return { ok: true, claims: publicClaims(token) };
  }

  private sign(claims: CapabilityTokenClaims): string {
    const canonical = [
      claims.tokenId,
      claims.agentId,
      claims.customerId,
      claims.allowedProposalTypes.join(','),
      claims.forbiddenActions.join(','),
      claims.perTransactionLimit.minorUnits.toString(),
      claims.perTransactionLimit.currency,
      claims.dailyLimit.minorUnits.toString(),
      claims.dailyLimit.currency,
      claims.allowedAccountClasses.join(','),
      claims.forbiddenDataCategories.join(','),
      claims.maxRisk,
      claims.issuedAt,
      claims.expiresAt,
      claims.revokedAt ?? '',
    ].join('\n');
    return createHmac('sha256', this.#secret).update(canonical).digest('hex');
  }
}

export type TokenVerification =
  | { readonly ok: true; readonly claims: CapabilityTokenClaims }
  | { readonly ok: false; readonly code: 'TOKEN_SIGNATURE_INVALID' | 'TOKEN_REVOKED' | 'TOKEN_EXPIRED' };

export function publicClaims(token: AgentCapabilityToken): CapabilityTokenClaims {
  return Object.freeze({
    tokenId: token.tokenId,
    agentId: token.agentId,
    customerId: token.customerId,
    allowedProposalTypes: token.allowedProposalTypes,
    forbiddenActions: token.forbiddenActions,
    perTransactionLimit: token.perTransactionLimit,
    dailyLimit: token.dailyLimit,
    allowedAccountClasses: token.allowedAccountClasses,
    forbiddenDataCategories: token.forbiddenDataCategories,
    maxRisk: token.maxRisk,
    issuedAt: token.issuedAt,
    expiresAt: token.expiresAt,
    revokedAt: token.revokedAt,
  });
}

function safeEqualHex(a: string, b: string): boolean {
  try {
    const left = Buffer.from(a, 'hex');
    const right = Buffer.from(b, 'hex');
    if (left.length === 0 || left.length !== right.length) {
      return false;
    }
    return timingSafeEqual(left, right);
  } catch {
    return false;
  }
}
