/**
 * Strict auth rate limits. Buckets are keyed by purpose + IP hash and/or
 * login-handle hash. Later risk-aware policies can replace the limiter
 * implementation without changing AuthenticationService call sites.
 */

export const AUTH_RATE_LIMIT_POLICIES = Object.freeze({
  register: Object.freeze({ windowMs: 60 * 60 * 1000, max: 5 }),
  login: Object.freeze({ windowMs: 15 * 60 * 1000, max: 5 }),
  loginHandle: Object.freeze({ windowMs: 60 * 60 * 1000, max: 10 }),
  refresh: Object.freeze({ windowMs: 60 * 60 * 1000, max: 30 }),
  mfa: Object.freeze({ windowMs: 15 * 60 * 1000, max: 5 }),
  recovery: Object.freeze({ windowMs: 60 * 60 * 1000, max: 3 }),
  passkey: Object.freeze({ windowMs: 60 * 60 * 1000, max: 20 }),
});

export type AuthRateLimitPurpose = keyof typeof AUTH_RATE_LIMIT_POLICIES;

export type AuthRateLimitDecision = {
  readonly allowed: boolean;
  readonly remaining: number;
  readonly retryAfterMs: number;
  readonly purpose: AuthRateLimitPurpose;
};

export type AuthRateLimitPort = {
  consume(purpose: AuthRateLimitPurpose, key: string, nowMs: number): AuthRateLimitDecision;
};

export class AuthRateLimiter implements AuthRateLimitPort {
  private readonly buckets = new Map<string, { readonly resetAt: number; count: number }>();

  consume(purpose: AuthRateLimitPurpose, key: string, nowMs: number): AuthRateLimitDecision {
    const policy = AUTH_RATE_LIMIT_POLICIES[purpose];
    const bucketKey = `${purpose}:${key}`;
    const existing = this.buckets.get(bucketKey);
    if (!existing || existing.resetAt <= nowMs) {
      this.buckets.set(bucketKey, { resetAt: nowMs + policy.windowMs, count: 1 });
      return { allowed: true, remaining: policy.max - 1, retryAfterMs: 0, purpose };
    }
    if (existing.count >= policy.max) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs: existing.resetAt - nowMs,
        purpose,
      };
    }
    existing.count += 1;
    return { allowed: true, remaining: policy.max - existing.count, retryAfterMs: 0, purpose };
  }
}
