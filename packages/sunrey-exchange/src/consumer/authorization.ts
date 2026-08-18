import { createHash } from 'node:crypto';

import type {
  ConsumerAgentMandate,
  ConsumerAuthorization,
  ConsumerAuthorizationDecision,
  ConsumerTradingProfile,
  ConsumerWalletAuthorization,
} from './types.ts';

const PRIVATE_KEY_PATTERN = /private[_-]?key|mnemonic|seedphrase|keystore/i;

export function sessionCannotSpend(): { readonly sessionSufficientToSpend: false } {
  return Object.freeze({ sessionSufficientToSpend: false });
}

export function humanReadableTradeIntent(input: {
  readonly flow: string;
  readonly side: string;
  readonly quantity: bigint;
  readonly assetSpent: string;
  readonly assetReceived: string;
  readonly estimatedPrice: bigint | null;
  readonly protectionBps: bigint | null;
}): string {
  const price = input.estimatedPrice === null ? 'indicative price unavailable' : `estimated price ${input.estimatedPrice.toString()}`;
  const protection = input.protectionBps === null ? 'limit' : `max adverse ${input.protectionBps.toString()} bps`;
  return `Review before authorization: ${input.flow} ${input.side} ${input.quantity.toString()} spend ${input.assetSpent} receive ${input.assetReceived}; ${price}; ${protection}. This is not a guaranteed price.`;
}

export function intentDigest(display: string): string {
  return createHash('sha256').update(display).digest('hex');
}

export function walletPayloadContainsSecret(raw: string): boolean {
  return PRIVATE_KEY_PATTERN.test(raw);
}

export function verifyWalletAuthorization(
  wallet: ConsumerWalletAuthorization | null,
  expectedDisplay: string | null,
): readonly string[] {
  if (!wallet) {
    return Object.freeze(['WALLET_AUTHORIZATION_REQUIRED']);
  }
  if (walletPayloadContainsSecret(wallet.signedIntentHex) || walletPayloadContainsSecret(wallet.walletId)) {
    return Object.freeze(['PRIVATE_KEY_REJECTED']);
  }
  if (wallet.signedIntentHex.length < 16) {
    return Object.freeze(['WALLET_SIGNATURE_INVALID']);
  }
  if (expectedDisplay && wallet.intentDisplay !== expectedDisplay) {
    return Object.freeze(['INTENT_DISPLAY_MISMATCH']);
  }
  if (wallet.authorizationKind !== 'WALLET_SIGNATURE' && wallet.authorizationKind !== 'MOBILE_CONFIRMATION') {
    return Object.freeze(['WALLET_AUTHORIZATION_REQUIRED']);
  }
  return Object.freeze([]);
}

export function verifyAgentMandate(
  origin: ConsumerAuthorization['origin'],
  mandate: ConsumerAgentMandate | null,
): readonly string[] {
  if (origin !== 'AGENT') {
    return Object.freeze([]);
  }
  if (!mandate || mandate.capability !== 'CONSUMER_TRADE') {
    return Object.freeze(['AGENT_MANDATE_REQUIRED']);
  }
  if (mandate.matchingPriority !== 'NONE' || mandate.privilegedPrice !== false) {
    return Object.freeze(['AGENT_PRIVILEGE_FORBIDDEN']);
  }
  return Object.freeze([]);
}

export function evaluateConsumerAuthorization(input: {
  readonly profile: ConsumerTradingProfile;
  readonly authorization: ConsumerAuthorization;
  readonly expectedIntentDisplay: string | null;
}): ConsumerAuthorizationDecision {
  const reasons: string[] = [];
  if (!input.authorization.sessionAuthenticated) {
    reasons.push('SESSION_UNAUTHENTICATED');
  }
  if (!input.authorization.wallet) {
    reasons.push('SESSION_WITHOUT_FINANCIAL_AUTHORITY');
  }
  reasons.push(...verifyWalletAuthorization(input.authorization.wallet, input.expectedIntentDisplay));
  reasons.push(...verifyAgentMandate(input.authorization.origin, input.authorization.agentMandate));
  if (input.profile.environment === 'SANDBOX' && input.profile.accountStatus !== 'ACTIVE_SIMULATION') {
    reasons.push('SANDBOX_CANNOT_TRADE_PRODUCTION');
  }
  return Object.freeze({
    allowed: reasons.length === 0,
    reasonCodes: Object.freeze([...new Set(reasons)]),
    sessionSufficientToSpend: false,
  });
}

export function sandboxCannotTradeProduction(environment: ConsumerTradingProfile['environment']): {
  readonly allowed: boolean;
  readonly reason: string | null;
} {
  if (environment === 'PRODUCTION') {
    return Object.freeze({ allowed: false, reason: 'SANDBOX_CANNOT_TRADE_PRODUCTION' });
  }
  return Object.freeze({ allowed: true, reason: null });
}
