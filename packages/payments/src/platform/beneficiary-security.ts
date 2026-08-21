/**
 * Beneficiary add/change security. Frontend cannot mark a beneficiary
 * verified — only Kernel + screening + this policy can.
 */

import type { UtcInstant } from '../../../domain/src/time.ts';
import type { AuthenticationAssurance } from '../../../identity/src/assurance.ts';
import { evaluateStepUp } from '../../../identity/src/step-up.ts';
import { requiredAssuranceFor } from '../../../identity/src/capability.ts';
import type { IdentitySession } from '../../../identity/src/auth.ts';

export const BENEFICIARY_SECURITY_POLICY_ID = 'payments.beneficiary.security.v1' as const;

export type DeviceRiskLevel = 'LOW' | 'STANDARD' | 'ELEVATED' | 'HIGH' | 'BLOCKED';

export type BeneficiarySecurityPolicy = {
  readonly policyId: typeof BENEFICIARY_SECURITY_POLICY_ID;
  readonly requiredAssurance: AuthenticationAssurance;
  readonly cooldownMs: number;
  readonly maxCreatesPerDay: number;
  readonly maxCreatesPerWeek: number;
  readonly blockedDeviceRisk: readonly DeviceRiskLevel[];
};

export const DEFAULT_BENEFICIARY_SECURITY_POLICY: BeneficiarySecurityPolicy = Object.freeze({
  policyId: BENEFICIARY_SECURITY_POLICY_ID,
  requiredAssurance: requiredAssuranceFor('MANAGE_BENEFICIARY'),
  cooldownMs: 0,
  maxCreatesPerDay: 20,
  maxCreatesPerWeek: 50,
  blockedDeviceRisk: Object.freeze(['HIGH', 'BLOCKED'] as const),
});

export type BeneficiarySecurityContext = {
  readonly ownerId: string;
  readonly actorId: string;
  readonly session: IdentitySession | null;
  readonly deviceRisk: DeviceRiskLevel;
  readonly now: UtcInstant;
  readonly recentCreates: readonly UtcInstant[];
};

export type BeneficiarySecurityDecision =
  | { readonly outcome: 'ALLOW' }
  | { readonly outcome: 'STEP_UP_REQUIRED'; readonly needed: AuthenticationAssurance; readonly current: AuthenticationAssurance }
  | { readonly outcome: 'COOLDOWN'; readonly retryAfterMs: number }
  | { readonly outcome: 'FREQUENCY_EXCEEDED'; readonly window: 'DAY' | 'WEEK'; readonly limit: number }
  | { readonly outcome: 'DEVICE_RISK_BLOCKED'; readonly deviceRisk: DeviceRiskLevel }
  | { readonly outcome: 'UNAUTHENTICATED' };

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

export function evaluateBeneficiarySecurity(
  context: BeneficiarySecurityContext,
  policy: BeneficiarySecurityPolicy = DEFAULT_BENEFICIARY_SECURITY_POLICY,
): BeneficiarySecurityDecision {
  if (!context.session || context.session.revocationState !== 'ACTIVE') {
    return Object.freeze({ outcome: 'UNAUTHENTICATED' });
  }
  if (policy.blockedDeviceRisk.includes(context.deviceRisk)) {
    return Object.freeze({ outcome: 'DEVICE_RISK_BLOCKED', deviceRisk: context.deviceRisk });
  }
  const stepUp = evaluateStepUp(context.session, policy.requiredAssurance);
  if (!stepUp.ok) {
    return Object.freeze({ outcome: 'UNAUTHENTICATED' });
  }
  if (stepUp.value.required) {
    return Object.freeze({
      outcome: 'STEP_UP_REQUIRED',
      needed: stepUp.value.needed,
      current: stepUp.value.current,
    });
  }
  const nowMs = Date.parse(context.now);
  const last = context.recentCreates[context.recentCreates.length - 1];
  if (last && policy.cooldownMs > 0) {
    const elapsed = nowMs - Date.parse(last);
    if (elapsed < policy.cooldownMs) {
      return Object.freeze({ outcome: 'COOLDOWN', retryAfterMs: policy.cooldownMs - elapsed });
    }
  }
  const dayCount = context.recentCreates.filter((at) => nowMs - Date.parse(at) < DAY_MS).length;
  if (dayCount >= policy.maxCreatesPerDay) {
    return Object.freeze({ outcome: 'FREQUENCY_EXCEEDED', window: 'DAY', limit: policy.maxCreatesPerDay });
  }
  const weekCount = context.recentCreates.filter((at) => nowMs - Date.parse(at) < WEEK_MS).length;
  if (weekCount >= policy.maxCreatesPerWeek) {
    return Object.freeze({ outcome: 'FREQUENCY_EXCEEDED', window: 'WEEK', limit: policy.maxCreatesPerWeek });
  }
  return Object.freeze({ outcome: 'ALLOW' });
}

/**
 * Client-supplied verification flags are ignored. Only screening + Kernel
 * can produce ACTIVE/CLEAR.
 */
export function rejectClientVerificationMark(input: unknown): boolean {
  if (!input || typeof input !== 'object') {
    return false;
  }
  const rec = input as Record<string, unknown>;
  return (
    rec.verified === true ||
    rec.verificationStatus === 'VERIFIED' ||
    rec.status === 'ACTIVE' ||
    rec.screeningStatus === 'CLEAR'
  );
}
