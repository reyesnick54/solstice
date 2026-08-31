/**
 * ACCESS Wave 5 — Consumer-facing regulatory projection for BFF.
 */

import { asUtcInstant } from '../../domain/src/time.ts';
import {
  AccessDisclosureRegistry,
  buildPriceComponents,
  coveragePromiseBoundary,
  resolveCheckoutDisclosures,
  type AccessCheckoutDisclosureRequirement,
  type AccessPriceComponents,
} from '../../access-economy/src/regulatory-controls/index.ts';

export type AccessCheckoutRegulatoryView = Readonly<{
  readonly disclosures: readonly AccessCheckoutDisclosureRequirement[];
  readonly price: AccessPriceComponents;
  readonly coverageBoundary: ReturnType<typeof coveragePromiseBoundary>;
  readonly terminology: Readonly<{
    readonly useAccessCovers: true;
    readonly avoidCashValueLanguage: true;
    readonly avoidTokenRedemptionLanguage: true;
  }>;
}>;

export function projectCheckoutRegulatoryView(input: {
  readonly basePriceMinorUnits: bigint;
  readonly taxMinorUnits: bigint;
  readonly mandatoryFeesMinorUnits: bigint;
  readonly optionalFeesMinorUnits: bigint;
  readonly depositMinorUnits: bigint;
  readonly accessCoverageMinorUnits: bigint;
  readonly userContributionMinorUnits: bigint;
  readonly currency: string;
  readonly category: string;
  readonly jurisdiction: string;
  readonly entitlementUnitsRemaining: bigint;
  readonly fundedRedemptionAvailability: 'HEALTHY' | 'LIMITED' | 'EXHAUSTED' | 'SUSPENDED';
  readonly hasProviderTerms?: boolean;
  readonly at?: string;
}): AccessCheckoutRegulatoryView {
  const at = asUtcInstant(input.at ?? '2026-08-31T12:00:00.000Z');
  const registry = new AccessDisclosureRegistry();
  const price = buildPriceComponents({
    basePriceMinorUnits: input.basePriceMinorUnits,
    taxMinorUnits: input.taxMinorUnits,
    mandatoryFeesMinorUnits: input.mandatoryFeesMinorUnits,
    optionalFeesMinorUnits: input.optionalFeesMinorUnits,
    depositMinorUnits: input.depositMinorUnits,
    accessCoverageMinorUnits: input.accessCoverageMinorUnits,
    userContributionMinorUnits: input.userContributionMinorUnits,
    currency: input.currency,
  });
  const disclosures = resolveCheckoutDisclosures({
    registry,
    at,
    jurisdiction: input.jurisdiction,
    category: input.category,
    price,
    fundingAvailabilityLimited: input.fundedRedemptionAvailability !== 'HEALTHY',
    hasSecurityDeposit: input.depositMinorUnits > 0n,
    hasProviderTerms: input.hasProviderTerms ?? true,
  });
  return Object.freeze({
    disclosures,
    price,
    coverageBoundary: coveragePromiseBoundary({
      entitlementUnitsRemaining: input.entitlementUnitsRemaining,
      fundedRedemptionAvailability: input.fundedRedemptionAvailability,
    }),
    terminology: Object.freeze({
      useAccessCovers: true,
      avoidCashValueLanguage: true,
      avoidTokenRedemptionLanguage: true,
    }),
  });
}
