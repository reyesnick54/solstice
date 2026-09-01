import type { UtcInstant } from '../../../domain/src/time.ts';

export type AbuseControlConfig = {
  readonly maxIntentsPerUserPerDay: number;
  readonly maxOffersPerMerchantPerIntent: number;
  readonly maxOffersPerMerchantPerHour: number;
  readonly minOfferResubmitIntervalMs: bigint;
  readonly maxWithdrawRepostPerDay: number;
};

export const DEFAULT_ABUSE_CONTROLS: AbuseControlConfig = Object.freeze({
  maxIntentsPerUserPerDay: 20,
  maxOffersPerMerchantPerIntent: 1,
  maxOffersPerMerchantPerHour: 50,
  minOfferResubmitIntervalMs: 60_000n,
  maxWithdrawRepostPerDay: 10,
});

export type RateLimitState = {
  readonly userIntentCounts: ReadonlyMap<string, { readonly count: number; readonly windowStart: UtcInstant }>;
  readonly merchantOfferCounts: ReadonlyMap<string, { readonly count: number; readonly windowStart: UtcInstant }>;
  readonly merchantLastOfferAt: ReadonlyMap<string, UtcInstant>;
  readonly withdrawRepostCounts: ReadonlyMap<string, { readonly count: number; readonly windowStart: UtcInstant }>;
};

export function createRateLimitState(): RateLimitState {
  return Object.freeze({
    userIntentCounts: new Map(),
    merchantOfferCounts: new Map(),
    merchantLastOfferAt: new Map(),
    withdrawRepostCounts: new Map(),
  });
}

export type AbuseCheckResult = {
  readonly allowed: boolean;
  readonly reason: string | null;
};

export function checkUserIntentRate(
  state: RateLimitState,
  userId: string,
  now: UtcInstant,
  config: AbuseControlConfig,
): AbuseCheckResult {
  const key = userId;
  const windowMs = 86_400_000n;
  const entry = state.userIntentCounts.get(key);
  if (!entry || now > addMs(entry.windowStart, windowMs)) {
    return allow();
  }
  if (entry.count >= config.maxIntentsPerUserPerDay) {
    return deny('USER_INTENT_RATE_LIMIT');
  }
  return allow();
}

export function checkMerchantOfferRate(
  state: RateLimitState,
  merchantId: string,
  now: UtcInstant,
  config: AbuseControlConfig,
): AbuseCheckResult {
  const key = merchantId;
  const windowMs = 3_600_000n;
  const entry = state.merchantOfferCounts.get(key);
  if (!entry || now > addMs(entry.windowStart, windowMs)) {
    return allow();
  }
  if (entry.count >= config.maxOffersPerMerchantPerHour) {
    return deny('MERCHANT_OFFER_RATE_LIMIT');
  }
  const lastOffer = state.merchantLastOfferAt.get(key);
  if (lastOffer && now < addMs(lastOffer, config.minOfferResubmitIntervalMs)) {
    return deny('OFFER_RESUBMIT_TOO_FAST');
  }
  return allow();
}

export function checkSelfDealing(userId: string, merchantOwnerId: string | null): AbuseCheckResult {
  if (merchantOwnerId && userId === merchantOwnerId) {
    return deny('SELF_DEALING_FORBIDDEN');
  }
  return allow();
}

export function checkWithdrawRepost(
  state: RateLimitState,
  merchantId: string,
  now: UtcInstant,
  config: AbuseControlConfig,
): AbuseCheckResult {
  const key = merchantId;
  const windowMs = 86_400_000n;
  const entry = state.withdrawRepostCounts.get(key);
  if (!entry || now > addMs(entry.windowStart, windowMs)) {
    return allow();
  }
  if (entry.count >= config.maxWithdrawRepostPerDay) {
    return deny('WITHDRAW_REPOST_LIMIT');
  }
  return allow();
}

function addMs(instant: UtcInstant, ms: bigint): UtcInstant {
  const date = new Date(instant);
  return new Date(date.getTime() + Number(ms)).toISOString() as UtcInstant;
}

function allow(): AbuseCheckResult {
  return Object.freeze({ allowed: true, reason: null });
}

function deny(reason: string): AbuseCheckResult {
  return Object.freeze({ allowed: false, reason });
}
