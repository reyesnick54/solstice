/**
 * ACCESS Wave 5 — Configurable jurisdiction policy controls.
 *
 * Not legal conclusions — dimensions for compliance/legal approval.
 */

import type { UtcInstant } from '../../../domain/src/time.ts';
import type { AccessJurisdictionPolicyRule } from './types.ts';

export const DEFAULT_JURISDICTION_POLICY_RULES: readonly AccessJurisdictionPolicyRule[] = Object.freeze([
  Object.freeze({
    ruleId: 'us-mobility-enabled',
    dimension: 'COUNTRY',
    scope: 'US',
    allowed: true,
    category: 'MOBILITY',
    paymentRail: null,
    providerId: null,
    programId: null,
    notes: 'simulation placeholder — requires legal approval',
    effectiveFrom: '2026-01-01T00:00:00.000Z' as UtcInstant,
  }),
  Object.freeze({
    ruleId: 'us-fl-experiences',
    dimension: 'STATE_PROVINCE',
    scope: 'US-FL',
    allowed: true,
    category: 'EXPERIENCES',
    paymentRail: null,
    providerId: null,
    programId: 'sponsor-demo',
    notes: 'sponsor program geography restriction example',
    effectiveFrom: '2026-01-01T00:00:00.000Z' as UtcInstant,
  }),
  Object.freeze({
    ruleId: 'sandbox-card-rail-simulation',
    dimension: 'PAYMENT_RAIL',
    scope: 'RESTRICTED_VIRTUAL_CARD',
    allowed: true,
    category: null,
    paymentRail: 'RESTRICTED_VIRTUAL_CARD',
    providerId: null,
    programId: null,
    notes: 'simulation only until payment provider production gate passes',
    effectiveFrom: '2026-01-01T00:00:00.000Z' as UtcInstant,
  }),
]);

export class AccessJurisdictionPolicyRegistry {
  private readonly rules: AccessJurisdictionPolicyRule[];

  constructor(seed: readonly AccessJurisdictionPolicyRule[] = DEFAULT_JURISDICTION_POLICY_RULES) {
    this.rules = [...seed];
  }

  evaluate(input: {
    readonly country: string;
    readonly stateProvince?: string | null;
    readonly category: string;
    readonly paymentRail?: string | null;
    readonly providerId?: string | null;
    readonly programId?: string | null;
    readonly at: UtcInstant;
  }): { readonly allowed: boolean; readonly matchedRules: readonly AccessJurisdictionPolicyRule[]; readonly reason: string } {
    const applicable = this.rules.filter(
      (rule) => rule.effectiveFrom <= input.at && rule.allowed,
    );
    const matched: AccessJurisdictionPolicyRule[] = [];

    for (const rule of applicable) {
      if (rule.category !== null && rule.category !== input.category) {
        continue;
      }
      if (rule.providerId !== null && rule.providerId !== input.providerId) {
        continue;
      }
      if (rule.programId !== null && rule.programId !== input.programId) {
        continue;
      }
      if (rule.paymentRail !== null && rule.paymentRail !== input.paymentRail) {
        continue;
      }
      switch (rule.dimension) {
        case 'COUNTRY':
          if (rule.scope === input.country) {
            matched.push(rule);
          }
          break;
        case 'STATE_PROVINCE':
          if (input.stateProvince !== undefined && input.stateProvince !== null && rule.scope === input.stateProvince) {
            matched.push(rule);
          }
          break;
        case 'CATEGORY':
          if (rule.scope === input.category) {
            matched.push(rule);
          }
          break;
        case 'PAYMENT_RAIL':
          if (input.paymentRail !== undefined && input.paymentRail !== null && rule.scope === input.paymentRail) {
            matched.push(rule);
          }
          break;
        case 'PROVIDER':
          if (input.providerId !== undefined && input.providerId !== null && rule.scope === input.providerId) {
            matched.push(rule);
          }
          break;
        case 'PROGRAM':
          if (input.programId !== undefined && input.programId !== null && rule.scope === input.programId) {
            matched.push(rule);
          }
          break;
        case 'USER_ELIGIBILITY':
          matched.push(rule);
          break;
        default:
          break;
      }
    }

    const denied = this.rules.some(
      (rule) =>
        rule.effectiveFrom <= input.at &&
        !rule.allowed &&
        ((rule.dimension === 'COUNTRY' && rule.scope === input.country) ||
          (rule.dimension === 'CATEGORY' && rule.scope === input.category)),
    );

    if (denied) {
      return Object.freeze({
        allowed: false,
        matchedRules: Object.freeze(matched),
        reason: 'jurisdiction policy denies this combination',
      });
    }

    return Object.freeze({
      allowed: matched.length > 0 || applicable.length === 0,
      matchedRules: Object.freeze(matched),
      reason:
        matched.length > 0
          ? `matched ${matched.length} jurisdiction rule(s)`
          : 'no explicit jurisdiction rule matched; default deny-safe posture applies',
    });
  }

  list(): readonly AccessJurisdictionPolicyRule[] {
    return Object.freeze([...this.rules]);
  }

  add(rule: AccessJurisdictionPolicyRule): void {
    this.rules.push(rule);
  }
}
