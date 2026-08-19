import { err, ok, type Result } from '../../../domain/src/result.ts';
import { isMethodEligibleForClass } from './eligibility.ts';
import type { PermittedValuationMethod } from './methods.ts';
import type { HumanContributionValuationPolicy } from './policy.ts';
import { valuationFailure, type ValuationFailure } from './types.ts';
import type { ContributionReferenceValue } from './value.ts';

/**
 * Multiple available methods are never averaged.
 * Precedence is only the explicit policy methodPriority list.
 * Contractual settlement may precede a governed schedule only when
 * the active policy says so.
 */
export function selectMethodByPolicyPriority(
  policy: HumanContributionValuationPolicy,
  availableMethods: readonly PermittedValuationMethod[],
): Result<PermittedValuationMethod, ValuationFailure> {
  if (availableMethods.length === 0) {
    return err(valuationFailure('CLASS_METHOD_NOT_ELIGIBLE', 'no valuation methods are available for this event'));
  }
  const unique = [...new Set(availableMethods)];
  for (const method of unique) {
    if (!isMethodEligibleForClass(policy.contributionClass, method)) {
      return err(valuationFailure('CLASS_METHOD_NOT_ELIGIBLE', `${method} is not eligible for ${policy.contributionClass}`));
    }
  }
  const priority = policy.methodPriority.length > 0 ? policy.methodPriority : [policy.method];
  for (const candidate of priority) {
    if (unique.includes(candidate)) {
      return ok(candidate);
    }
  }
  if (unique.length === 1 && unique[0] === policy.method) {
    return ok(policy.method);
  }
  return err(
    valuationFailure(
      'VALUATION_REVIEW_REQUIRED',
      'available methods do not match the active policy priority; do not average or guess',
    ),
  );
}

export function compareReferenceValues(
  policy: HumanContributionValuationPolicy,
  left: ContributionReferenceValue,
  right: ContributionReferenceValue,
): Result<ContributionReferenceValue, ValuationFailure> {
  if (left.denomination !== right.denomination || left.valueClass !== right.valueClass) {
    return err(valuationFailure('REFERENCE_CONFLICT', 'unlike reference denominations or classes cannot be averaged'));
  }
  if (left.amount === right.amount) {
    return ok(left);
  }
  if (policy.conflictToleranceBasisPoints === null) {
    return err(valuationFailure('VALUATION_REVIEW_REQUIRED', 'conflicting references require review when no tolerance is configured'));
  }
  const higher = left.amount > right.amount ? left.amount : right.amount;
  const lower = left.amount > right.amount ? right.amount : left.amount;
  const delta = higher - lower;
  const tolerated = (higher * policy.conflictToleranceBasisPoints) / 10_000n;
  if (delta > tolerated) {
    return err(valuationFailure('VALUATION_REVIEW_REQUIRED', 'references conflict beyond the permitted tolerance; do not guess'));
  }
  return ok(left.amount >= right.amount ? left : right);
}
