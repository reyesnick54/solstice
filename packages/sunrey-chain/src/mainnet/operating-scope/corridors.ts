/**
 * Corridor eligibility records. Extends the existing payment corridor
 * model by reference (string IDs) without importing packages/payments.
 *
 * Unknown corridors are disabled. Fixtures are RESEARCH_REQUIRED.
 * No real legal claims are encoded.
 */

import type { CorridorEligibilityRecord } from './types.ts';
import { FIXTURE_JURISDICTION_XA, FIXTURE_JURISDICTION_XB } from './jurisdictions.ts';
import { FIXTURE_ENTITY_XA } from './products.ts';

export const FIXTURE_CORRIDOR_XA_XB = 'XA-XB-USD-XTS' as const;
export const PAYMENTS_CORRIDOR_US_SA = 'US-SA-USD-SAR' as const;
export const KERNEL_POLICY_REF_RESEARCH = 'kernel.policy.pack.RESEARCH_REQUIRED' as const;

const CORRIDORS: readonly CorridorEligibilityRecord[] = Object.freeze([
  Object.freeze({
    corridorId: FIXTURE_CORRIDOR_XA_XB,
    sourceJurisdiction: FIXTURE_JURISDICTION_XA,
    destinationJurisdiction: FIXTURE_JURISDICTION_XB,
    sourceCurrency: 'USD',
    destinationCurrency: 'XTS',
    customerClass: 'ALL',
    paymentPurposeClass: 'UNSPECIFIED',
    servingLegalEntityRef: FIXTURE_ENTITY_XA,
    requiredProviders: Object.freeze(['FIAT_BANKING', 'PAYMENT_RAIL', 'FX_LIQUIDITY', 'KYC_AML', 'REGULATED_PARTNER'] as const),
    requiredEvidenceClasses: Object.freeze([
      'LICENSE_OR_REGISTRATION',
      'PARTNER_AGREEMENT',
      'KYC_AML_PROGRAM',
    ] as const),
    kernelPolicyRef: KERNEL_POLICY_REF_RESEARCH,
    fixture: true,
    researchRequired: true,
    liveStatus: 'DISABLED',
    legalConclusionInvented: false,
  }),
  Object.freeze({
    corridorId: PAYMENTS_CORRIDOR_US_SA,
    sourceJurisdiction: 'US',
    destinationJurisdiction: 'SA',
    sourceCurrency: 'USD',
    destinationCurrency: 'SAR',
    customerClass: 'ALL',
    paymentPurposeClass: 'UNSPECIFIED',
    servingLegalEntityRef: 'le_solstice_us_inc',
    requiredProviders: Object.freeze(['FIAT_BANKING', 'PAYMENT_RAIL', 'FX_LIQUIDITY', 'KYC_AML', 'REGULATED_PARTNER'] as const),
    requiredEvidenceClasses: Object.freeze([
      'LICENSE_OR_REGISTRATION',
      'PARTNER_AGREEMENT',
      'KYC_AML_PROGRAM',
    ] as const),
    kernelPolicyRef: KERNEL_POLICY_REF_RESEARCH,
    fixture: true,
    researchRequired: true,
    liveStatus: 'DISABLED',
    legalConclusionInvented: false,
  }),
]);

export function listCorridors(): readonly CorridorEligibilityRecord[] {
  return CORRIDORS;
}

export function findCorridor(corridorId: string): CorridorEligibilityRecord | undefined {
  return CORRIDORS.find((row) => row.corridorId === corridorId);
}

export function corridorIsUnknown(corridorId: string): boolean {
  return findCorridor(corridorId) === undefined;
}
