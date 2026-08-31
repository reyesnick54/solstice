/**
 * ACCESS Wave 5 — Treasury risk limits and policy evaluation.
 *
 * Default safe test values only — no production limits invented.
 */

import type { UtcInstant } from '../../../domain/src/time.ts';
import type { AccessTreasuryExposure, AccessTreasuryLimit, AccessTreasuryPolicy } from './types.ts';

export const DEFAULT_ACCESS_TREASURY_POLICY: AccessTreasuryPolicy = Object.freeze({
  policyId: 'access-treasury-policy-simulation',
  name: 'Access Treasury Policy — Simulation Defaults',
  operationalState: 'NORMAL',
  limits: Object.freeze([
    Object.freeze({
      limitId: 'global-spending',
      dimension: 'GLOBAL',
      scope: null,
      currency: 'USD',
      maxMinorUnits: 10_000_000_00n,
      minMinorUnits: null,
      enabled: true,
    }),
    Object.freeze({
      limitId: 'daily-settlement',
      dimension: 'DAILY_SETTLEMENT',
      scope: null,
      currency: 'USD',
      maxMinorUnits: 1_000_000_00n,
      minMinorUnits: null,
      enabled: true,
    }),
    Object.freeze({
      limitId: 'transaction-max',
      dimension: 'TRANSACTION',
      scope: null,
      currency: 'USD',
      maxMinorUnits: 50_000_00n,
      minMinorUnits: null,
      enabled: true,
    }),
    Object.freeze({
      limitId: 'unsettled-exposure',
      dimension: 'UNSETTLED_EXPOSURE',
      scope: null,
      currency: 'USD',
      maxMinorUnits: 500_000_00n,
      minMinorUnits: null,
      enabled: true,
    }),
    Object.freeze({
      limitId: 'refund-reserve-min',
      dimension: 'REFUND_RESERVE_MINIMUM',
      scope: null,
      currency: 'USD',
      maxMinorUnits: null,
      minMinorUnits: 0n,
      enabled: true,
    }),
    Object.freeze({
      limitId: 'max-outstanding-auth',
      dimension: 'MAX_OUTSTANDING_AUTHORIZATIONS',
      scope: null,
      currency: 'USD',
      maxMinorUnits: 250_000_00n,
      minMinorUnits: null,
      enabled: true,
    }),
  ]),
  effectiveFrom: '2026-01-01T00:00:00.000Z' as UtcInstant,
  notes: 'Simulation defaults for testing; production values require treasury approval',
});

export type TreasuryLimitEvaluation = {
  readonly limitId: string;
  readonly dimension: AccessTreasuryLimit['dimension'];
  readonly withinLimit: boolean;
  readonly detail: string;
};

export function evaluateTreasuryLimits(input: {
  readonly policy: AccessTreasuryPolicy;
  readonly exposure: AccessTreasuryExposure;
  readonly transactionAmountMinorUnits?: bigint;
  readonly dailySettlementMinorUnits?: bigint;
  readonly outstandingAuthorizationsMinorUnits?: bigint;
}): readonly TreasuryLimitEvaluation[] {
  const results: TreasuryLimitEvaluation[] = [];
  for (const limit of input.policy.limits) {
    if (!limit.enabled || limit.currency !== input.exposure.currency) {
      continue;
    }
    switch (limit.dimension) {
      case 'GLOBAL':
        if (limit.maxMinorUnits !== null) {
          const within = input.exposure.maximumPotentialExposure <= limit.maxMinorUnits;
          results.push({
            limitId: limit.limitId,
            dimension: limit.dimension,
            withinLimit: within,
            detail: within
              ? 'global exposure within limit'
              : `maximumPotentialExposure ${input.exposure.maximumPotentialExposure} exceeds ${limit.maxMinorUnits}`,
          });
        }
        break;
      case 'DAILY_SETTLEMENT':
        if (limit.maxMinorUnits !== null && input.dailySettlementMinorUnits !== undefined) {
          const within = input.dailySettlementMinorUnits <= limit.maxMinorUnits;
          results.push({
            limitId: limit.limitId,
            dimension: limit.dimension,
            withinLimit: within,
            detail: within
              ? 'daily settlement within limit'
              : `daily settlement ${input.dailySettlementMinorUnits} exceeds ${limit.maxMinorUnits}`,
          });
        }
        break;
      case 'TRANSACTION':
        if (limit.maxMinorUnits !== null && input.transactionAmountMinorUnits !== undefined) {
          const within = input.transactionAmountMinorUnits <= limit.maxMinorUnits;
          results.push({
            limitId: limit.limitId,
            dimension: limit.dimension,
            withinLimit: within,
            detail: within
              ? 'transaction within limit'
              : `transaction ${input.transactionAmountMinorUnits} exceeds ${limit.maxMinorUnits}`,
          });
        }
        break;
      case 'UNSETTLED_EXPOSURE':
        if (limit.maxMinorUnits !== null) {
          const within = input.exposure.unsettledProviderExposure <= limit.maxMinorUnits;
          results.push({
            limitId: limit.limitId,
            dimension: limit.dimension,
            withinLimit: within,
            detail: within
              ? 'unsettled exposure within limit'
              : `unsettled ${input.exposure.unsettledProviderExposure} exceeds ${limit.maxMinorUnits}`,
          });
        }
        break;
      case 'REFUND_RESERVE_MINIMUM':
        if (limit.minMinorUnits !== null) {
          const within = input.exposure.refundReserve >= limit.minMinorUnits;
          results.push({
            limitId: limit.limitId,
            dimension: limit.dimension,
            withinLimit: within,
            detail: within
              ? 'refund reserve meets minimum'
              : `refund reserve ${input.exposure.refundReserve} below minimum ${limit.minMinorUnits}`,
          });
        }
        break;
      case 'MAX_OUTSTANDING_AUTHORIZATIONS':
        if (
          limit.maxMinorUnits !== null &&
          input.outstandingAuthorizationsMinorUnits !== undefined
        ) {
          const within = input.outstandingAuthorizationsMinorUnits <= limit.maxMinorUnits;
          results.push({
            limitId: limit.limitId,
            dimension: limit.dimension,
            withinLimit: within,
            detail: within
              ? 'outstanding authorizations within limit'
              : `outstanding authorizations ${input.outstandingAuthorizationsMinorUnits} exceeds ${limit.maxMinorUnits}`,
          });
        }
        break;
      case 'CATEGORY':
      case 'GEOGRAPHY':
      case 'PROVIDER':
        break;
      default:
        break;
    }
  }
  return Object.freeze(results);
}

export function allTreasuryLimitsWithin(results: readonly TreasuryLimitEvaluation[]): boolean {
  return results.every((row) => row.withinLimit);
}

export function canCommitNewFunding(policy: AccessTreasuryPolicy): boolean {
  return (
    policy.operationalState === 'NORMAL' || policy.operationalState === 'LIMITED'
  );
}

export function canSettleProviderPayment(policy: AccessTreasuryPolicy): boolean {
  return (
    policy.operationalState === 'NORMAL' ||
    policy.operationalState === 'LIMITED'
  );
}

export function allowsExistingServicing(_policy: AccessTreasuryPolicy): boolean {
  return true;
}
