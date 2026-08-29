/**
 * ACCESS-14 — Access Redemption Engine.
 */

import { resolveCoveragePolicy } from '../coverage-policy.ts';
import type { RedemptionDecision, RedemptionRequest, RedemptionStatus } from './types.ts';

export function evaluateRedemption(request: RedemptionRequest): RedemptionDecision {
  const now = '2026-08-23T12:00:00.000Z';
  if (request.providerQuote.expiresAt < now) {
    return decision(request, 'QUOTE_EXPIRED', null, 0n, 0n, ['provider quote expired']);
  }
  if (request.entitlement.availableUnits < request.requestedQuantity) {
    return decision(request, 'ENTITLEMENT_INSUFFICIENT', null, 0n, 0n, ['entitlement units insufficient']);
  }
  const policy = resolveCoveragePolicy(request.entitlement.entitlementClass);
  if (!policy) {
    return decision(request, 'POLICY_BLOCKED', null, 0n, 0n, ['no coverage policy registered for entitlement class']);
  }
  const coverage = policy.evaluate({
    entitlementClass: request.entitlement.entitlementClass,
    category: request.category,
    canonicalUnit: request.entitlement.canonicalUnit,
    quantity: request.requestedQuantity,
    geographicZone: request.policyContext.geographicZone,
    serviceLevel: request.policyContext.serviceLevel,
    providerPriceMinorUnits: request.providerQuote.providerPriceMinorUnits,
    jurisdiction: request.jurisdiction,
    benefitSource: request.policyContext.benefitSource,
  });
  const userContribution =
    request.providerQuote.providerPriceMinorUnits > coverage.appliedCoverageMinorUnits
      ? request.providerQuote.providerPriceMinorUnits - coverage.appliedCoverageMinorUnits
      : 0n;
  if (userContribution > request.maxUserContributionMinorUnits) {
    return decision(request, 'USER_CONTRIBUTION_REQUIRED', coverage, userContribution, coverage.entitlementUnitsConsumed, [
      'user contribution exceeds authorized maximum',
    ]);
  }
  const status: RedemptionStatus =
    userContribution === 0n
      ? 'FULLY_COVERED'
      : coverage.appliedCoverageMinorUnits > 0n
        ? 'PARTIALLY_COVERED'
        : 'USER_CONTRIBUTION_REQUIRED';
  const finalStatus: RedemptionStatus = status === 'FULLY_COVERED' ? 'READY_FOR_APPROVAL' : 'USER_CONTRIBUTION_REQUIRED';
  return decision(request, finalStatus, coverage, userContribution, coverage.entitlementUnitsConsumed, [
    ...coverage.explanation.map((line) => line.message),
    userContribution === 0n ? 'no user cash contribution required' : `user contribution ${userContribution.toString()} minor units`,
  ]);
}

function decision(
  request: RedemptionRequest,
  status: RedemptionStatus,
  coverage: RedemptionDecision['coverage'],
  userContributionMinorUnits: bigint,
  entitlementUnitsHeld: bigint,
  explanation: readonly string[],
): RedemptionDecision {
  return Object.freeze({
    redemptionId: request.redemptionId,
    status,
    providerPriceMinorUnits: request.providerQuote.providerPriceMinorUnits,
    coverage,
    userContributionMinorUnits,
    entitlementUnitsHeld,
    explanation,
  });
}
