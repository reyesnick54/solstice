/**
 * Wave 4 Task 4 — purpose-aware access for federated queries.
 *
 * Integrates Wave 3 rights/purpose concepts. A query authorized for RESEARCH
 * must not automatically be reusable for ECONOMIC_VALUATION or MONETARY_PROPOSAL.
 */

import type { FederationQueryPurpose, FederationRejection, FederationRightsContext } from './types.ts';
import { federationRejection } from './types.ts';

/** Purposes that may never be inferred from a narrower authorization. */
export const HEIGHTENED_FEDERATION_PURPOSES = [
  'ECONOMIC_VALUATION',
  'MONETARY_PROPOSAL',
] as const satisfies readonly FederationQueryPurpose[];

/** Purposes that do not automatically permit heightened downstream use. */
export const NON_INHERITING_PURPOSES = [
  'RESEARCH',
  'PRODUCT_IMPROVEMENT',
  'AGGREGATED_ANALYTICS',
  'OPERATIONAL_MONITORING',
  'FEDERATED_CORRELATION',
] as const satisfies readonly FederationQueryPurpose[];

const PURPOSE_COMPATIBILITY = Object.freeze({
  RESEARCH: ['RESEARCH', 'FEDERATED_CORRELATION', 'AGGREGATED_ANALYTICS'] as const,
  OPERATIONAL_MONITORING: ['OPERATIONAL_MONITORING', 'FEDERATED_CORRELATION'] as const,
  FEDERATED_CORRELATION: ['FEDERATED_CORRELATION', 'RESEARCH', 'AGGREGATED_ANALYTICS'] as const,
  ECONOMIC_AWARENESS: [
    'ECONOMIC_AWARENESS',
    'FEDERATED_CORRELATION',
    'OPERATIONAL_MONITORING',
    'AGGREGATED_ANALYTICS',
  ] as const,
  PRODUCT_IMPROVEMENT: ['PRODUCT_IMPROVEMENT', 'AGGREGATED_ANALYTICS'] as const,
  AGGREGATED_ANALYTICS: ['AGGREGATED_ANALYTICS', 'FEDERATED_CORRELATION'] as const,
  ECONOMIC_VALUATION: ['ECONOMIC_VALUATION', 'ECONOMIC_AWARENESS'] as const,
  MONETARY_PROPOSAL: ['MONETARY_PROPOSAL'] as const,
}) as Readonly<Record<FederationQueryPurpose, readonly FederationQueryPurpose[]>>;

export function purposePermitsUse(
  licensed: FederationQueryPurpose,
  requested: FederationQueryPurpose,
): boolean {
  if (licensed === requested) {
    return true;
  }
  return PURPOSE_COMPATIBILITY[licensed]?.includes(requested) ?? false;
}

export function refusePurposeExpansion(
  from: FederationQueryPurpose,
  to: FederationQueryPurpose,
): FederationRejection {
  return federationRejection(
    'PURPOSE_NOT_INHERITED',
    `a ${from} authorization does not automatically permit ${to}`,
  );
}

export function evaluateFederationPurpose(input: {
  readonly requestedPurpose: FederationQueryPurpose;
  readonly rightsContext: FederationRightsContext;
}): FederationRejection | null {
  const { requestedPurpose, rightsContext } = input;

  if (rightsContext.permittedPurposes.length === 0) {
    return federationRejection('RIGHTS_DENIED', 'no permitted purposes in rights context');
  }

  const authorized = rightsContext.permittedPurposes.some((licensed) =>
    purposePermitsUse(licensed, requestedPurpose),
  );
  if (!authorized) {
    if (
      HEIGHTENED_FEDERATION_PURPOSES.includes(requestedPurpose as (typeof HEIGHTENED_FEDERATION_PURPOSES)[number])
    ) {
      const narrow = rightsContext.permittedPurposes.find((purpose) =>
        NON_INHERITING_PURPOSES.includes(purpose as (typeof NON_INHERITING_PURPOSES)[number]),
      );
      if (narrow) {
        return refusePurposeExpansion(narrow, requestedPurpose);
      }
    }
    return federationRejection(
      'PURPOSE_DENIED',
      `rights context does not authorize purpose ${requestedPurpose}`,
    );
  }

  if (
    requestedPurpose === 'MONETARY_PROPOSAL' &&
    !rightsContext.permittedPurposes.includes('MONETARY_PROPOSAL')
  ) {
    return federationRejection(
      'PURPOSE_DENIED',
      'MONETARY_PROPOSAL requires explicit authorization; cannot be inferred',
    );
  }

  if (
    requestedPurpose === 'ECONOMIC_VALUATION' &&
    rightsContext.permittedPurposes.includes('RESEARCH') &&
    !rightsContext.permittedPurposes.includes('ECONOMIC_VALUATION')
  ) {
    return refusePurposeExpansion('RESEARCH', 'ECONOMIC_VALUATION');
  }

  return null;
}

export function propagateQueryPurpose(
  requestPurpose: FederationQueryPurpose,
): Readonly<{ readonly purpose: FederationQueryPurpose; readonly inherited: false }> {
  return Object.freeze({ purpose: requestPurpose, inherited: false });
}
